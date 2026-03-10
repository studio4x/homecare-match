"use client";

import { useCallback, useEffect, useState } from "react";
import ReferralLinkCard from "@/components/ReferralLinkCard";
import ReferredUsersList from "@/components/ReferredUsersList";
import { Award, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

interface ReferralStages {
  signup_created: boolean;
  email_confirmed: boolean;
  profile_completed: boolean;
  documents_verified: boolean;
}

interface ReferralRegisteredUser {
  id: string;
  full_name: string;
  email?: string | null;
  created_at: string;
  role: string;
  current_status: string;
  is_valid_referral: boolean;
  stages: ReferralStages;
}

interface ReferralStatsResponse {
  count: number;
  totalRegistered: number;
  currentTier?: { badge_label?: string; threshold?: number } | null;
  nextTier?: { badge_label?: string; threshold?: number } | null;
  registeredUsers: ReferralRegisteredUser[];
}

const EMPTY_STATS: ReferralStatsResponse = {
  count: 0,
  totalRegistered: 0,
  currentTier: null,
  nextTier: null,
  registeredUsers: [],
};

const ReferralsPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStatsResponse>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async (options?: { silent?: boolean }) => {
    if (!user?.id) {
      setStats(EMPTY_STATS);
      setLoading(false);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const invokeOptions: {
        body: { referrerId: string };
        headers?: Record<string, string>;
      } = {
        body: { referrerId: user.id },
      };

      if (accessToken) {
        invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
      }

      const { data, error } = await supabase.functions.invoke("referral-stats", invokeOptions);
      if (error) throw error;

      setStats((data as ReferralStatsResponse) || EMPTY_STATS);
    } catch (err) {
      console.error("Erro ao buscar estatísticas de indicação:", err);
      setStats(EMPTY_STATS);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!user?.id) return;

    const refreshSilently = () => {
      fetchStats({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    };

    const intervalId = window.setInterval(refreshSilently, 15000);
    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSilently);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchStats, user?.id]);

  if (!user) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando dados de indicação...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-6 w-6 text-primary" />
          Programa de Indicações
        </h1>
        <p className="text-muted-foreground">Indique colegas e ganhe destaque no topo das buscas.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ReferralLinkCard stats={stats} loadingStats={loading} onRefreshStats={fetchStats} />
        </div>
        <div className="lg:col-span-2">
          <ReferredUsersList users={stats.registeredUsers || []} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default ReferralsPage;
