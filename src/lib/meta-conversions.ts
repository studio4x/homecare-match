"use client";

import { supabase } from "@/integrations/supabase/client";

type MetaEventName = "Purchase" | "CompleteRegistration";

type MetaConversionsPayload = {
  eventName: MetaEventName;
  eventId: string;
  customData?: Record<string, unknown>;
  userData?: {
    email?: string | null;
    externalId?: string | null;
  };
  eventSourceUrl?: string;
};

let cachedIdentity: { userId: string | null; email: string | null } | null = null;
let isIdentityLoading = false;

const getCookieValue = (name: string) => {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const resolveIdentity = async () => {
  if (cachedIdentity && (cachedIdentity.userId || cachedIdentity.email)) return cachedIdentity;
  if (isIdentityLoading) return cachedIdentity;

  isIdentityLoading = true;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      cachedIdentity = { userId: null, email: null };
      return cachedIdentity;
    }

    cachedIdentity = {
      userId: data.user.id || null,
      email: data.user.email || null,
    };
    return cachedIdentity;
  } catch {
    cachedIdentity = { userId: null, email: null };
    return cachedIdentity;
  } finally {
    isIdentityLoading = false;
  }
};

export const sendMetaConversionsEvent = async (payload: MetaConversionsPayload) => {
  if (typeof window === "undefined") return;

  try {
    const identity = await resolveIdentity();
    const eventSourceUrl = payload.eventSourceUrl || window.location.href;
    const fbp = getCookieValue("_fbp");
    const fbc = getCookieValue("_fbc");

    await supabase.functions.invoke("meta-conversions", {
      body: {
        eventName: payload.eventName,
        eventId: payload.eventId,
        eventTime: Math.floor(Date.now() / 1000),
        actionSource: "website",
        eventSourceUrl,
        customData: payload.customData || {},
        userData: {
          email: payload.userData?.email || identity?.email || null,
          externalId: payload.userData?.externalId || identity?.userId || null,
          fbp: fbp || null,
          fbc: fbc || null,
          clientUserAgent: navigator.userAgent || null,
        },
      },
    });
  } catch (error) {
    console.warn("[meta-conversions] Falha ao enviar evento CAPI:", error);
  }
};
