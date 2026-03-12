"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const ensureFreshSession = async (currentSession: Session | null) => {
      if (!currentSession) return null;

      const nowInSeconds = Math.floor(Date.now() / 1000);
      const expiresAt = currentSession.expires_at ?? 0;
      const isExpiringSoon = expiresAt > 0 && expiresAt - nowInSeconds < 60;

      if (!isExpiringSoon) return currentSession;

      const { data, error } = await supabase.auth.refreshSession();
      if (error) return currentSession;
      return data.session ?? currentSession;
    };

    const getAuthTypeFromUrl = () => {
      if (typeof window === "undefined") return "";
      const search = window.location.search || "";
      const hash = window.location.hash || "";
      const combined = `${search}&${hash}`;
      const match = combined.match(/(?:^|[?&#])type=([^&#]+)/i);
      return decodeURIComponent(match?.[1] || "").toLowerCase();
    };

    const isSignupFallbackRedirect = () => {
      if (typeof window === "undefined") return false;
      const currentPath = window.location.pathname || "/";
      if (currentPath !== "/") return false;

      const referrer = document.referrer || "";
      if (!referrer) return false;

      try {
        const refUrl = new URL(referrer);
        const isSupabaseVerifyEndpoint =
          refUrl.hostname.endsWith(".supabase.co") && refUrl.pathname.includes("/auth/v1/verify");
        const isSignupType = (refUrl.searchParams.get("type") || "").toLowerCase() === "signup";
        return isSupabaseVerifyEndpoint && isSignupType;
      } catch {
        return false;
      }
    };

    const shouldShowEmailConfirmedGuide = (currentUser: User | null) => {
      if (!currentUser || typeof window === "undefined") return false;
      const currentPath = window.location.pathname || "/";
      if (currentPath !== "/") return false;

      const seenKey = `emailConfirmedGuideShown:${currentUser.id}`;
      if (localStorage.getItem(seenKey) === "true") return false;

      const createdAt = Date.parse(String(currentUser.created_at || ""));
      const lastSignInAt = Date.parse(String(currentUser.last_sign_in_at || ""));
      const emailConfirmedAt = Date.parse(String((currentUser as any).email_confirmed_at || ""));
      if (!Number.isFinite(createdAt) || !Number.isFinite(lastSignInAt) || !Number.isFinite(emailConfirmedAt)) {
        return false;
      }

      const createdToSignInMs = Math.abs(lastSignInAt - createdAt);
      const signInToConfirmMs = Math.abs(emailConfirmedAt - lastSignInAt);

      // "Primeiro login após confirmação": timestamps muito próximos.
      return createdToSignInMs <= 10 * 60 * 1000 && signInToConfirmMs <= 10 * 60 * 1000;
    };

    const markEmailConfirmedGuideSeen = (userId: string | undefined) => {
      if (!userId || typeof window === "undefined") return;
      localStorage.setItem(`emailConfirmedGuideShown:${userId}`, "true");
    };

    const maybeRedirectByAuthType = (authType: string, currentSession: Session | null) => {
      if (!currentSession || typeof window === "undefined") return;
      const currentPath = window.location.pathname;
      const shouldUseSignupFallback =
        authType !== "recovery" &&
        authType !== "signup" &&
        (isSignupFallbackRedirect() || shouldShowEmailConfirmedGuide(currentSession.user));

      if (authType === "recovery" && currentPath !== "/redefinir-senha") {
        navigate("/redefinir-senha", { replace: true });
        return;
      }

      if ((authType === "signup" || shouldUseSignupFallback) && currentPath !== "/email-confirmado") {
        markEmailConfirmedGuideSeen(currentSession.user?.id);
        navigate("/email-confirmado", { replace: true });
      }
    };

    const bootstrapAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const freshSession = await ensureFreshSession(data.session);
      const authType = getAuthTypeFromUrl();

      if (!isMounted) return;
      setSession(freshSession);
      setUser(freshSession?.user ?? null);
      setLoading(false);
      maybeRedirectByAuthType(authType, freshSession);
    };

    bootstrapAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      const freshSession = await ensureFreshSession(nextSession);
      const authType = getAuthTypeFromUrl();
      if (!isMounted) return;

      setSession(freshSession);
      setUser(freshSession?.user ?? null);
      setLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        navigate("/redefinir-senha", { replace: true });
        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        maybeRedirectByAuthType(authType, freshSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
