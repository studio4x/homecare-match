type DeliveryChannel = "email" | "widget" | "whatsapp";
type DeliveryStatus = "queued" | "pending" | "retry" | "sent" | "failed" | "skipped";
type RecipientKind = "user" | "admin" | "external";

type LogDeliveryArgs = {
  supabaseAdmin: any;
  eventType: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  recipientKind: RecipientKind;
  recipientUserId?: string | null;
  recipientContact?: string | null;
  title?: string | null;
  content?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

const truncate = (value: unknown, maxLen: number) => {
  const text = String(value ?? "");
  if (!text) return null;
  return text.length > maxLen ? text.slice(0, maxLen) : text;
};

export const logNotificationDelivery = async ({
  supabaseAdmin,
  eventType,
  channel,
  status,
  recipientKind,
  recipientUserId = null,
  recipientContact = null,
  title = null,
  content = null,
  errorMessage = null,
  metadata = {},
}: LogDeliveryArgs) => {
  try {
    const { error } = await supabaseAdmin.from("notification_delivery_logs").insert({
      event_type: truncate(eventType, 120),
      channel,
      status,
      recipient_kind: recipientKind,
      recipient_user_id: recipientUserId,
      recipient_contact: truncate(recipientContact, 255),
      title: truncate(title, 255),
      content: truncate(content, 4000),
      error_message: truncate(errorMessage, 4000),
      metadata,
    });

    if (error) {
      console.warn("[notification-log] falha ao inserir log:", error.message);
    }
  } catch (e) {
    console.warn("[notification-log] erro inesperado:", e instanceof Error ? e.message : e);
  }
};
