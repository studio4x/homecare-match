"use client";

export type SignupRole = "professional" | "company" | "family";

const getSignupCategory = (role: SignupRole) => {
  if (role === "professional") return "profissional";
  if (role === "company") return "empresa";
  return "familia";
};

export const trackAccountCreated = (role: SignupRole) => {
  if (typeof window === "undefined") return;

  const category = getSignupCategory(role);
  const metaPayload = {
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
      ...metaPayload,
    });

    window.fbq("trackCustom", "hcm_account_created", {
      event_name: "hcm_account_created",
      ...metaPayload,
    });
  }
};
