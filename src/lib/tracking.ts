"use client";

export type SignupRole = "professional" | "company" | "family";
const SIGNUP_TRACKED_PREFIX = "hcm_signup_tracked:";

const getSignupCategory = (role: SignupRole) => {
  if (role === "professional") return "profissional";
  if (role === "company") return "empresa";
  return "familia";
};

export const trackAccountCreated = (role: SignupRole, options?: { dedupeKey?: string | null }) => {
  if (typeof window === "undefined") return;

  const dedupeKey = String(options?.dedupeKey || "").trim();
  if (dedupeKey) {
    const storageKey = `${SIGNUP_TRACKED_PREFIX}${dedupeKey}`;
    if (window.sessionStorage.getItem(storageKey) === "1") return;
    window.sessionStorage.setItem(storageKey, "1");
  }

  const category = getSignupCategory(role);
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
    });

    window.fbq("trackCustom", "hcm_account_created", {
      event_name: "hcm_account_created",
      ...eventPayload,
    });
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: "hcm_account_created",
    ...eventPayload,
  });
};
