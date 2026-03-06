"use client";

import { sendMetaConversionsEvent } from "@/lib/meta-conversions";

export type SignupRole = "professional" | "company" | "family";
const SIGNUP_TRACKED_PREFIX = "hcm_signup_tracked:";

const getSignupCategory = (role: SignupRole) => {
  if (role === "professional") return "profissional";
  if (role === "company") return "empresa";
  return "familia";
};

export const trackAccountCreated = (
  role: SignupRole,
  options?: { dedupeKey?: string | null; email?: string | null },
) => {
  if (typeof window === "undefined") return;

  const dedupeKey = String(options?.dedupeKey || "").trim();
  if (dedupeKey) {
    const storageKey = `${SIGNUP_TRACKED_PREFIX}${dedupeKey}`;
    if (window.sessionStorage.getItem(storageKey) === "1") return;
    window.sessionStorage.setItem(storageKey, "1");
  }

  const category = getSignupCategory(role);
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const eventId = `signup_${dedupeKey || randomId}`;
  const eventPayload = {
    category,
    user_role: category,
    account_type: category,
    method: "email",
  };

  if (window.gtag) {
    window.gtag("event", "sign_up", {
      method: "email",
      category,
      user_role: category,
    });
  }

  if (window.fbq) {
    window.fbq("track", "CompleteRegistration", {
      content_name: "Criacao de conta",
      status: true,
      ...eventPayload,
    }, { eventID: eventId });
  }

  void sendMetaConversionsEvent({
    eventName: "CompleteRegistration",
    eventId,
    customData: {
      content_name: "Criacao de conta",
      status: true,
      ...eventPayload,
    },
    userData: {
      email: options?.email || null,
      externalId: dedupeKey || null,
    },
  });

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "hcm_account_created",
    ...eventPayload,
  });
};
