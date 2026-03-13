type TargetKind = "user" | "admin";

export type WhatsappTemplateConfig = {
  eventType: string;
  targetKind: TargetKind;
  label: string | null;
  templateName: string | null;
  sampleMessage: string | null;
  var1Default: string | null;
  var2Default: string | null;
  var3Default: string | null;
  variations: Record<string, string>;
  isActive: boolean;
};

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

const USER_EVENT_TEMPLATE_DEFAULTS: Record<string, string> = {
  new_contact_interest_user: "hcm_user_contact_interest",
  support_new_message_user: "hcm_user_support_update",
  support_ticket_closed_user: "hcm_user_support_update",
  verification_request_user_confirmation: "hcm_user_verification_update",
  verification_approved_user: "hcm_user_verification_update",
  verification_rejected_user: "hcm_user_verification_update",
  subscription_renewal_reminder_user: "hcm_user_subscription_reminder",
};

const USER_EVENT_TEMPLATE_ENV_KEYS: Record<string, string> = {
  new_contact_interest_user: "WHATSAPP_TEMPLATE_USER_CONTACT_INTEREST",
  support_new_message_user: "WHATSAPP_TEMPLATE_USER_SUPPORT_UPDATE",
  support_ticket_closed_user: "WHATSAPP_TEMPLATE_USER_SUPPORT_UPDATE",
  verification_request_user_confirmation: "WHATSAPP_TEMPLATE_USER_VERIFICATION_UPDATE",
  verification_approved_user: "WHATSAPP_TEMPLATE_USER_VERIFICATION_UPDATE",
  verification_rejected_user: "WHATSAPP_TEMPLATE_USER_VERIFICATION_UPDATE",
  subscription_renewal_reminder_user: "WHATSAPP_TEMPLATE_USER_SUBSCRIPTION_REMINDER",
};

const readTemplateFromEnv = (envKey: string) => String(Deno.env.get(envKey) || "").trim();
const toOptionalText = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
};

const normalizeVariations = (input: unknown): Record<string, string> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const entries = Object.entries(input as Record<string, unknown>);
  const result: Record<string, string> = {};
  for (const [key, value] of entries) {
    const safeKey = String(key || "").trim();
    const safeValue = String(value ?? "").trim();
    if (!safeKey || !safeValue) continue;
    result[safeKey] = safeValue.slice(0, 2000);
  }
  return result;
};

let whatsappTemplateConfigTableState: "unknown" | "available" | "missing" = "unknown";

export const getWhatsappTemplateConfig = async (
  supabaseAdmin: any,
  eventType: string,
  targetKind?: TargetKind,
): Promise<WhatsappTemplateConfig | null> => {
  if (!supabaseAdmin) return null;
  if (!eventType) return null;
  if (whatsappTemplateConfigTableState === "missing") return null;

  try {
    let query = supabaseAdmin
      .from("whatsapp_template_configs")
      .select(
        "event_type,target_kind,label,template_name,sample_message,var1_default,var2_default,var3_default,variations,is_active",
      )
      .eq("event_type", eventType)
      .limit(1);

    if (targetKind) {
      query = query.eq("target_kind", targetKind);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      const message = String(error.message || "").toLowerCase();
      if (message.includes("does not exist") || message.includes("relation")) {
        whatsappTemplateConfigTableState = "missing";
        return null;
      }
      return null;
    }

    if (!data) {
      whatsappTemplateConfigTableState = "available";
      return null;
    }

    const parsedTargetKind = data.target_kind === "admin" ? "admin" : "user";
    whatsappTemplateConfigTableState = "available";

    return {
      eventType: String(data.event_type || eventType).trim(),
      targetKind: parsedTargetKind,
      label: toOptionalText(data.label),
      templateName: toOptionalText(data.template_name),
      sampleMessage: toOptionalText(data.sample_message),
      var1Default: toOptionalText(data.var1_default),
      var2Default: toOptionalText(data.var2_default),
      var3Default: toOptionalText(data.var3_default),
      variations: normalizeVariations(data.variations),
      isActive: data.is_active !== false,
    };
  } catch {
    return null;
  }
};

export const getWhatsappTemplateVariation = (
  config: WhatsappTemplateConfig | null,
  key: string,
  fallback = "",
) => {
  if (!config) return fallback;
  const safeKey = String(key || "").trim();
  if (!safeKey) return fallback;
  const value = config.variations[safeKey];
  return value && value.trim() ? value.trim() : fallback;
};

export const getConfiguredTemplateNameForEvent = async (
  supabaseAdmin: any,
  targetKind: TargetKind,
  eventType: string,
) => {
  const config = await getWhatsappTemplateConfig(supabaseAdmin, eventType, targetKind);
  if (!config || !config.isActive) return null;
  return config.templateName;
};

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

export const getTemplateNameForTarget = (targetKind: TargetKind, eventType?: string | null) => {
  const normalizedEventType = String(eventType || "").trim().toLowerCase();

  if (targetKind === "user" && normalizedEventType) {
    const envKey = USER_EVENT_TEMPLATE_ENV_KEYS[normalizedEventType];
    const defaultTemplate = USER_EVENT_TEMPLATE_DEFAULTS[normalizedEventType];
    if (defaultTemplate) {
      return (envKey ? readTemplateFromEnv(envKey) : "") || defaultTemplate;
    }
  }

  if (targetKind === "admin") {
    return readTemplateFromEnv("WHATSAPP_TEMPLATE_ADMIN") || "hcm_admin_notification";
  }
  return readTemplateFromEnv("WHATSAPP_TEMPLATE_USER") || "hcm_user_notification_v2";
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

  const configuredTemplateName = await getConfiguredTemplateNameForEvent(supabaseAdmin, "user", eventType);

  return enqueueWhatsappQueueEntry({
    supabaseAdmin,
    eventType,
    targetKind: "user",
    recipientUserId: profile.id,
    recipientPhoneE164: phoneE164,
    templateName: templateName || configuredTemplateName || getTemplateNameForTarget("user", eventType),
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

  const configuredTemplateName = await getConfiguredTemplateNameForEvent(supabaseAdmin, "admin", eventType);

  return enqueueWhatsappQueueEntry({
    supabaseAdmin,
    eventType,
    targetKind: "admin",
    recipientPhoneE164: adminPhoneE164,
    templateName: templateName || configuredTemplateName || getTemplateNameForTarget("admin", eventType),
    templateParams,
    payload,
    maxAttempts,
  });
};
