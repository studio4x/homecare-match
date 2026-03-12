type TargetKind = "user" | "admin";

type QueueInsertArgs = {
  supabaseAdmin: any;
  eventType: string;
  targetKind: TargetKind;
  recipientUserId?: string | null;
  recipientPhoneE164: string;
  templateName: string;
  templateParams?: unknown[];
  payload?: Record<string, unknown>;
  maxAttempts?: number;
};

type UserEnqueueArgs = {
  supabaseAdmin: any;
  userId: string | null | undefined;
  eventType: string;
  templateParams?: unknown[];
  payload?: Record<string, unknown>;
  templateName?: string | null;
  maxAttempts?: number;
};

type AdminEnqueueArgs = {
  supabaseAdmin: any;
  eventType: string;
  templateParams?: unknown[];
  payload?: Record<string, unknown>;
  templateName?: string | null;
  maxAttempts?: number;
};

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export const isWhatsappEnabled = () => {
  const raw = String(Deno.env.get("WHATSAPP_ENABLED") || "").trim().toLowerCase();
  return TRUE_VALUES.has(raw);
};

export const normalizeBrazilPhoneToE164 = (value: unknown): string | null => {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.replace(/^00+/, "");
  }

  if (digits.startsWith("0") && digits.length > 11) {
    digits = digits.replace(/^0+/, "");
  }

  if (digits.startsWith("55")) {
    const local = digits.slice(2);
    if (local.length !== 10 && local.length !== 11) return null;
    return `+55${local}`;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  return null;
};

export const getTemplateNameForTarget = (targetKind: TargetKind) => {
  if (targetKind === "admin") {
    return String(Deno.env.get("WHATSAPP_TEMPLATE_ADMIN") || "hcm_admin_notification").trim();
  }
  return String(Deno.env.get("WHATSAPP_TEMPLATE_USER") || "hcm_user_notification").trim();
};

const sanitizeTemplateParam = (value: unknown): string | null => {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.slice(0, 1024);
};

export const normalizeTemplateParams = (input: unknown) => {
  if (!Array.isArray(input)) return [] as string[];
  return input.map(sanitizeTemplateParam).filter(Boolean).slice(0, 10) as string[];
};

export const getDestinationDigits = (e164: string) => String(e164 || "").replace(/\D/g, "");

export const enqueueWhatsappQueueEntry = async ({
  supabaseAdmin,
  eventType,
  targetKind,
  recipientUserId = null,
  recipientPhoneE164,
  templateName,
  templateParams = [],
  payload = {},
  maxAttempts = 5,
}: QueueInsertArgs) => {
  const safeParams = normalizeTemplateParams(templateParams);

  const { error } = await supabaseAdmin.from("whatsapp_notification_queue").insert({
    event_type: eventType,
    target_kind: targetKind,
    recipient_user_id: recipientUserId,
    recipient_phone_e164: recipientPhoneE164,
    template_name: templateName,
    template_params: safeParams,
    payload,
    status: "pending",
    attempt_count: 0,
    max_attempts: Math.max(1, Number(maxAttempts || 5)),
    next_retry_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[whatsapp] falha ao inserir na fila:", error.message);
    return { queued: false, reason: error.message };
  }

  return { queued: true };
};

export const enqueueUserWhatsappNotification = async ({
  supabaseAdmin,
  userId,
  eventType,
  templateParams = [],
  payload = {},
  templateName,
  maxAttempts = 5,
}: UserEnqueueArgs) => {
  if (!isWhatsappEnabled()) return { queued: false, reason: "whatsapp_disabled" };
  if (!userId) return { queued: false, reason: "missing_user_id" };

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, phone, whatsapp_opt_in")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return { queued: false, reason: error?.message || "profile_not_found" };
  }

  if (!profile.whatsapp_opt_in) {
    return { queued: false, reason: "opt_in_disabled" };
  }

  const phoneE164 = normalizeBrazilPhoneToE164(profile.phone);
  if (!phoneE164) {
    return { queued: false, reason: "invalid_phone" };
  }

  return enqueueWhatsappQueueEntry({
    supabaseAdmin,
    eventType,
    targetKind: "user",
    recipientUserId: profile.id,
    recipientPhoneE164: phoneE164,
    templateName: templateName || getTemplateNameForTarget("user"),
    templateParams,
    payload,
    maxAttempts,
  });
};

export const enqueueAdminWhatsappNotification = async ({
  supabaseAdmin,
  eventType,
  templateParams = [],
  payload = {},
  templateName,
  maxAttempts = 5,
}: AdminEnqueueArgs) => {
  if (!isWhatsappEnabled()) return { queued: false, reason: "whatsapp_disabled" };

  const rawAdminDestination = String(Deno.env.get("WHATSAPP_ADMIN_DESTINATION_E164") || "").trim();
  const adminPhoneE164 = normalizeBrazilPhoneToE164(rawAdminDestination);
  if (!adminPhoneE164) {
    return { queued: false, reason: "invalid_admin_destination" };
  }

  return enqueueWhatsappQueueEntry({
    supabaseAdmin,
    eventType,
    targetKind: "admin",
    recipientPhoneE164: adminPhoneE164,
    templateName: templateName || getTemplateNameForTarget("admin"),
    templateParams,
    payload,
    maxAttempts,
  });
};
