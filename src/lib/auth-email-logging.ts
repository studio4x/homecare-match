import { supabase } from "@/integrations/supabase/client";

type AuthEmailLogStatus = "sent" | "failed";
type AuthEmailLogEventType =
  | "auth_signup_confirmation_email_requested"
  | "auth_signup_confirmation_email_resent";

type LogAuthEmailEventArgs = {
  eventType: AuthEmailLogEventType;
  status: AuthEmailLogStatus;
  email: string;
  userId?: string | null;
  errorMessage?: string | null;
};

const EVENT_TITLES: Record<AuthEmailLogEventType, string> = {
  auth_signup_confirmation_email_requested: "E-mail de confirmacao de conta solicitado",
  auth_signup_confirmation_email_resent: "E-mail de confirmacao de conta reenviado",
};

export const logAuthEmailEvent = async ({
  eventType,
  status,
  email,
  userId = null,
  errorMessage = null,
}: LogAuthEmailEventArgs) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return;

  try {
    const { error } = await supabase.functions.invoke("log-auth-email-event", {
      body: {
        event_type: eventType,
        status,
        email: normalizedEmail,
        user_id: userId,
        error_message: errorMessage,
        title: EVENT_TITLES[eventType],
      },
    });

    if (error) {
      console.warn("[auth-email-logging] failed to persist auth email log:", error.message);
    }
  } catch (error) {
    console.warn("[auth-email-logging] unexpected error:", error);
  }
};
