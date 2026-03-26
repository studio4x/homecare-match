export type SupportTicketCategory = "payment" | "technical" | "account" | "general";
export type SupportSlaStatus = "on_time" | "at_risk" | "overdue" | "answered";

export type SupportSlaCategoryConfig = {
  key: SupportTicketCategory;
  label: string;
  first_response_hours: number;
  position: number;
  description: string;
};

export type SupportSlaConfig = {
  categories: SupportSlaCategoryConfig[];
  public_note: string;
};

export type SupportBusinessHoursConfig = {
  timezone: string;
  days_of_week: number[];
  start_hour: number;
  end_hour: number;
};

export type CrisisProtocolContact = {
  role: string;
  name: string;
  email: string;
  phone: string;
};

export type CrisisProtocolConfig = {
  triage_checklist: string[];
  escalation_criteria: string[];
  evidence_preservation: string[];
  safety_hold_flow: string[];
  complainant_communication: string[];
  media_holding_statement: string;
  contacts: CrisisProtocolContact[];
};

export const DEFAULT_SUPPORT_SLA_CONFIG: SupportSlaConfig = {
  categories: [
    {
      key: "payment",
      label: "Pagamentos",
      first_response_hours: 2,
      position: 1,
      description: "Primeira resposta em até 2 horas úteis.",
    },
    {
      key: "technical",
      label: "Problema técnico",
      first_response_hours: 24,
      position: 2,
      description: "Primeira resposta em até 24 horas úteis.",
    },
    {
      key: "account",
      label: "Conta e acesso",
      first_response_hours: 24,
      position: 3,
      description: "Primeira resposta em até 24 horas úteis.",
    },
    {
      key: "general",
      label: "Dúvida geral",
      first_response_hours: 24,
      position: 4,
      description: "Primeira resposta em até 24 horas úteis.",
    },
  ],
  public_note:
    "Os prazos acima se referem ao tempo da primeira resposta humana da equipe. Não representam prazo de resolução final.",
};

export const DEFAULT_SUPPORT_BUSINESS_HOURS_CONFIG: SupportBusinessHoursConfig = {
  timezone: "America/Sao_Paulo",
  days_of_week: [1, 2, 3, 4, 5],
  start_hour: 8,
  end_hour: 18,
};

export const DEFAULT_CRISIS_PROTOCOL_CONFIG: CrisisProtocolConfig = {
  triage_checklist: [
    "Receber o relato e registrar data, hora, IDs envolvidos e canal de entrada.",
    "Classificar a severidade inicial com base em risco à vida, indícios de crime, fraude ou repercussão pública.",
    "Preservar evidências disponíveis antes de qualquer contato externo.",
  ],
  escalation_criteria: [
    "Elevar imediatamente para nível crítico quando houver risco à integridade física, abuso, violência, fraude relevante ou indício criminal.",
    "Escalar para jurídico/compliance quando houver pedido formal, ameaça de litígio, imprensa ou autoridade pública.",
  ],
  evidence_preservation: [
    "Preservar tickets, mensagens, anexos, denúncias, logs administrativos e notificações relacionadas.",
    "Evitar exclusão ou alteração de registros até a conclusão da triagem.",
  ],
  safety_hold_flow: [
    "Aplicar suspensão cautelar manual quando a triagem indicar risco atual para usuários ou para a plataforma.",
    "Registrar motivo, responsável e data da medida no perfil e na denúncia.",
  ],
  complainant_communication: [
    "Confirmar recebimento do relato com linguagem objetiva e sem prometer conclusão antecipada.",
    "Informar que a plataforma pode solicitar evidências adicionais e que medidas internas poderão ser adotadas.",
  ],
  media_holding_statement:
    "Estamos apurando os fatos com prioridade, preservando os registros relevantes e colaborando com as autoridades competentes quando aplicável.",
  contacts: [
    { role: "Operacao", name: "", email: "", phone: "" },
    { role: "Juridico/Compliance", name: "", email: "", phone: "" },
    { role: "Porta-voz", name: "", email: "", phone: "" },
  ],
};

const isCategoryKey = (value: unknown): value is SupportTicketCategory =>
  value === "payment" || value === "technical" || value === "account" || value === "general";

const toPositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

export const normalizeSupportBusinessHoursConfig = (
  value: unknown,
): SupportBusinessHoursConfig => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawDays = Array.isArray(source.days_of_week) ? source.days_of_week : DEFAULT_SUPPORT_BUSINESS_HOURS_CONFIG.days_of_week;
  const days = rawDays
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);

  return {
    timezone:
      typeof source.timezone === "string" && source.timezone.trim().length > 0
        ? source.timezone.trim()
        : DEFAULT_SUPPORT_BUSINESS_HOURS_CONFIG.timezone,
    days_of_week: days.length > 0 ? Array.from(new Set(days)) : DEFAULT_SUPPORT_BUSINESS_HOURS_CONFIG.days_of_week,
    start_hour: Math.min(23, Math.max(0, toPositiveInteger(source.start_hour, DEFAULT_SUPPORT_BUSINESS_HOURS_CONFIG.start_hour))),
    end_hour: Math.min(23, Math.max(1, toPositiveInteger(source.end_hour, DEFAULT_SUPPORT_BUSINESS_HOURS_CONFIG.end_hour))),
  };
};

export const normalizeSupportSlaConfig = (value: unknown): SupportSlaConfig => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawCategories = Array.isArray(source.categories) ? source.categories : [];
  const categories: SupportSlaCategoryConfig[] = rawCategories
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const key = String(item.key || "").trim().toLowerCase();
      if (!isCategoryKey(key)) return null;

      const fallback = DEFAULT_SUPPORT_SLA_CONFIG.categories.find((category) => category.key === key);
      return {
        key,
        label:
          typeof item.label === "string" && item.label.trim().length > 0
            ? item.label.trim()
            : fallback?.label || key,
        first_response_hours: toPositiveInteger(
          item.first_response_hours,
          fallback?.first_response_hours || 24,
        ),
        position: toPositiveInteger(item.position, fallback?.position || index + 1),
        description:
          typeof item.description === "string" && item.description.trim().length > 0
            ? item.description.trim()
            : fallback?.description || "Primeira resposta em até 24 horas úteis.",
      } satisfies SupportSlaCategoryConfig;
    })
    .filter((entry): entry is SupportSlaCategoryConfig => Boolean(entry))
    .sort((a, b) => a.position - b.position);

  const mergedCategories =
    categories.length > 0
      ? DEFAULT_SUPPORT_SLA_CONFIG.categories.map((fallback) => {
          const found = categories.find((entry) => entry.key === fallback.key);
          return found || fallback;
        }).sort((a, b) => a.position - b.position)
      : DEFAULT_SUPPORT_SLA_CONFIG.categories;

  return {
    categories: mergedCategories,
    public_note:
      typeof source.public_note === "string" && source.public_note.trim().length > 0
        ? source.public_note.trim()
        : DEFAULT_SUPPORT_SLA_CONFIG.public_note,
  };
};

export const normalizeCrisisProtocolConfig = (value: unknown): CrisisProtocolConfig => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const parseStringList = (field: string, fallback: string[]) => {
    const raw = source[field];
    if (!Array.isArray(raw)) return fallback;
    const values = raw
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return values.length > 0 ? values : fallback;
  };

  const rawContacts = Array.isArray(source.contacts) ? source.contacts : [];
  const contacts = rawContacts
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const role = String(item.role || "").trim();
      if (!role) return null;
      return {
        role,
        name: String(item.name || "").trim(),
        email: String(item.email || "").trim(),
        phone: String(item.phone || "").trim(),
      } satisfies CrisisProtocolContact;
    })
    .filter((entry): entry is CrisisProtocolContact => Boolean(entry));

  return {
    triage_checklist: parseStringList("triage_checklist", DEFAULT_CRISIS_PROTOCOL_CONFIG.triage_checklist),
    escalation_criteria: parseStringList("escalation_criteria", DEFAULT_CRISIS_PROTOCOL_CONFIG.escalation_criteria),
    evidence_preservation: parseStringList(
      "evidence_preservation",
      DEFAULT_CRISIS_PROTOCOL_CONFIG.evidence_preservation,
    ),
    safety_hold_flow: parseStringList("safety_hold_flow", DEFAULT_CRISIS_PROTOCOL_CONFIG.safety_hold_flow),
    complainant_communication: parseStringList(
      "complainant_communication",
      DEFAULT_CRISIS_PROTOCOL_CONFIG.complainant_communication,
    ),
    media_holding_statement:
      typeof source.media_holding_statement === "string" && source.media_holding_statement.trim().length > 0
        ? source.media_holding_statement.trim()
        : DEFAULT_CRISIS_PROTOCOL_CONFIG.media_holding_statement,
    contacts: contacts.length > 0 ? contacts : DEFAULT_CRISIS_PROTOCOL_CONFIG.contacts,
  };
};

export const getSupportCategoryOptions = (config?: SupportSlaConfig | null) =>
  normalizeSupportSlaConfig(config).categories;

export const getSupportCategoryConfig = (
  category: string | null | undefined,
  config?: SupportSlaConfig | null,
): SupportSlaCategoryConfig => {
  const normalized = normalizeSupportSlaConfig(config);
  const key = String(category || "").trim().toLowerCase();
  return (
    normalized.categories.find((entry) => entry.key === key) ||
    normalized.categories.find((entry) => entry.key === "general") ||
    DEFAULT_SUPPORT_SLA_CONFIG.categories[DEFAULT_SUPPORT_SLA_CONFIG.categories.length - 1]
  );
};

export const formatSupportHoursLabel = (hours: number) => {
  if (hours === 1) return "1 hora útil";
  return `${hours} horas úteis`;
};

export const formatSupportSlaPromise = (
  category: string | null | undefined,
  config?: SupportSlaConfig | null,
) => {
  const categoryConfig = getSupportCategoryConfig(category, config);
  return `Primeira resposta em até ${formatSupportHoursLabel(categoryConfig.first_response_hours)}.`;
};

export const computeLiveSupportSlaStatus = ({
  createdAt,
  dueAt,
  firstResponseAt,
}: {
  createdAt?: string | null;
  dueAt?: string | null;
  firstResponseAt?: string | null;
}): SupportSlaStatus => {
  if (firstResponseAt) return "answered";
  if (!dueAt) return "on_time";

  const dueTs = new Date(dueAt).getTime();
  const createdTs = createdAt ? new Date(createdAt).getTime() : NaN;
  const nowTs = Date.now();

  if (!Number.isFinite(dueTs)) return "on_time";
  if (nowTs > dueTs) return "overdue";

  const totalWindow = Number.isFinite(createdTs) ? dueTs - createdTs : 0;
  const quarterWindow = totalWindow > 0 ? totalWindow / 4 : 0;
  const warningWindow = Math.min(Math.max(quarterWindow, 30 * 60 * 1000), 6 * 60 * 60 * 1000);

  if (warningWindow > 0 && nowTs >= dueTs - warningWindow) return "at_risk";
  return "on_time";
};

export const getSupportSlaStatusMeta = (status: SupportSlaStatus) => {
  switch (status) {
    case "answered":
      return {
        label: "Respondido",
        className: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    case "overdue":
      return {
        label: "Atrasado",
        className: "bg-rose-100 text-rose-800 border-rose-200",
      };
    case "at_risk":
      return {
        label: "Em risco",
        className: "bg-amber-100 text-amber-800 border-amber-200",
      };
    default:
      return {
        label: "No prazo",
        className: "bg-sky-100 text-sky-800 border-sky-200",
      };
  }
};

export const formatSupportDueDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
};

export const formatSupportBusinessHoursSummary = (
  value?: SupportBusinessHoursConfig | null,
) => {
  const config = normalizeSupportBusinessHoursConfig(value);
  const weekdays =
    config.days_of_week.length === 5 &&
    config.days_of_week.every((day, index) => day === index + 1)
      ? "Segunda a sexta"
      : "Dias úteis configurados";

  const formatHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

  return `${weekdays}, ${formatHour(config.start_hour)} as ${formatHour(config.end_hour)} (${config.timezone})`;
};

export const splitTextareaLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export const joinTextareaLines = (value: string[]) => value.join("\n");
