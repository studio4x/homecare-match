export type ResolvedIntent =
  | "unknown"
  | "signup"
  | "company_context"
  | "plans"
  | "trial_policy"
  | "competitor";

export type DecisionPath = "faq" | "ai" | "fallback" | "clarify";

export type HistoryMessage = {
  role?: string | null;
  content?: string | null;
};

type ResolveSignalsInput = {
  historyMessages: HistoryMessage[];
  currentMessage: string;
};

type ResolveSignalsResult = {
  shortFollowup: boolean;
  directIntent: ResolvedIntent;
  effectiveIntent: ResolvedIntent;
  topicHint: string;
  previousAssistantQuestion: boolean;
  loopGuardTriggered: boolean;
  hasResolvedFollowupTopic: boolean;
};

type ResolveDecisionPathInput = {
  strictMode: boolean;
  chatbotUseAi: boolean;
  aiFirstEnabled: boolean;
  topScore: number;
  topPublicScore: number;
  hasResolvedFollowupTopic: boolean;
  shortFollowup: boolean;
  effectiveIntent: ResolvedIntent;
  highConfidence: number;
  mediumConfidence: number;
};

const normalize = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const SHORT_FOLLOWUP_WORDS = new Set([
  "sim",
  "quero",
  "ok",
  "explique",
  "explica",
  "detalhe",
  "detalhar",
  "claro",
  "pode",
  "isso",
  "entendi",
]);

const SIGNUP_PATTERNS = [
  /\bcadastro\b/,
  /\bcriar\s+conta\b/,
  /\bme\s+cadastrar\b/,
  /\bconta\b/,
  /\bempresa\s+e\s+quero\s+me\s+cadastrar\b/,
];

const COMPANY_CONTEXT_PATTERNS = [
  /\bempresa\b/,
  /\bhome\s+care\b/,
  /\bbuscar\s+profissionais\b/,
  /\bconcierge\b/,
  /\bacesso\s+gratuito\s+para\s+empresas\b/,
];

const PLAN_PATTERNS = [
  /\bplanos?\b/,
  /\bassinaturas?\b/,
  /\bplano\s+anual\b/,
  /\bplano\s+mensal\b/,
  /\bpreco\b/,
  /\bpagamentos?\b/,
];

const TRIAL_PATTERNS = [
  /\bteste\s+gratis\b/,
  /\bteste\s+gratuito\b/,
  /\bcupom\b/,
  /\bdias?\s+de\s+acesso\b/,
  /\bacesso\s+limitad[oa]\b/,
  /\btrial\b/,
];

const COMPETITOR_PATTERNS = [
  /\bconcorrentes?\b/,
  /\bcompetidores?\b/,
  /\bcompetidoras?\b/,
  /\bcompar(a|ar|acao)\s+com\s+(outras?\s+)?plataformas?\b/,
  /\bqual\s+(e|eh)\s+o\s+seu\s+concorrente\b/,
];

const CONFIRM_QUESTION_PATTERNS = [
  /\bquer\s+saber\s+mais\b/,
  /\bquer\s+que\s+eu\b/,
  /\bquer\s+os?\s+detalhes?\b/,
  /\bqual\s+tipo\s+de\s+cadastro\b/,
  /\bescolha\s+uma\s+opcao\b/,
];

const topicHintByIntent: Record<ResolvedIntent, string> = {
  unknown: "",
  competitor: "fora de escopo concorrencia comparacao plataformas",
  signup: "cadastro criar conta empresa familia profissional",
  company_context: "empresa home care busca profissionais filtros concierge acesso gratuito",
  plans: "planos assinatura plano mensal plano anual pagamentos",
  trial_policy: "teste gratis cupom dias de acesso limitado",
};

const classifyIntent = (message: string): ResolvedIntent => {
  const normalized = normalize(message);
  if (!normalized) return "unknown";
  if (COMPETITOR_PATTERNS.some((pattern) => pattern.test(normalized))) return "competitor";
  if (TRIAL_PATTERNS.some((pattern) => pattern.test(normalized))) return "trial_policy";
  if (PLAN_PATTERNS.some((pattern) => pattern.test(normalized))) return "plans";
  if (SIGNUP_PATTERNS.some((pattern) => pattern.test(normalized))) return "signup";
  if (COMPANY_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalized))) return "company_context";
  return "unknown";
};

const hasQuestionTone = (text: string) => {
  const normalized = normalize(text);
  if (!normalized) return false;
  if (String(text || "").includes("?")) return true;
  return CONFIRM_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const isShortFollowupMessage = (message: string) => {
  const normalized = normalize(message);
  if (!normalized) return false;
  if (["sim", "quero", "ok", "explique", "detalhe", "pode explicar", "pode detalhar"].includes(normalized)) {
    return true;
  }

  const words = normalized.split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  return words.every((word) => SHORT_FOLLOWUP_WORDS.has(word));
};

export const isCompetitorIntent = (message: string) => classifyIntent(message) === "competitor";

export const buildClarificationAnswer = (userName?: string | null) => {
  const prefix = userName ? `${userName}, ` : "";
  return `${prefix}para eu te responder com precisao, me diga o tema: 1) cadastro da empresa, 2) busca de profissionais/concierge, ou 3) planos e pagamentos.`;
};

export const buildCompanyContextAnswer = (userName?: string | null) => {
  const prefix = userName ? `${userName}, ` : "";
  return `${prefix}para empresa de home care, o uso da plataforma e gratuito para buscar profissionais, aplicar filtros por perfil/regiao e falar direto com os candidatos. Em casos urgentes, voce pode usar o Concierge para receber apoio na triagem e ganhar velocidade na contratacao.`;
};

export const isLikelyConfirmationLoopAnswer = (answer: string) => {
  const normalized = normalize(answer);
  if (!normalized) return false;
  if (!hasQuestionTone(answer)) return false;
  return CONFIRM_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const resolveConversationSignals = ({
  historyMessages,
  currentMessage,
}: ResolveSignalsInput): ResolveSignalsResult => {
  const rows = Array.isArray(historyMessages) ? historyMessages : [];
  const directIntent = classifyIntent(currentMessage);
  const shortFollowup = isShortFollowupMessage(currentMessage);

  if (!shortFollowup) {
    return {
      shortFollowup,
      directIntent,
      effectiveIntent: directIntent,
      topicHint: topicHintByIntent[directIntent],
      previousAssistantQuestion: false,
      loopGuardTriggered: false,
      hasResolvedFollowupTopic: directIntent !== "unknown",
    };
  }

  const currentUserIndex = (() => {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (String(rows[i]?.role || "") === "user") return i;
    }
    return rows.length - 1;
  })();

  let previousAssistant = "";
  let previousAssistantQuestion = false;
  let previousAssistantQuestionCount = 0;
  let previousSubstantiveUser = "";
  let previousUserWasShortFollowup = false;

  for (let i = currentUserIndex - 1; i >= 0; i -= 1) {
    const role = String(rows[i]?.role || "");
    const content = String(rows[i]?.content || "");
    if (!content) continue;

    if (role === "assistant") {
      if (!previousAssistant) {
        previousAssistant = content;
        previousAssistantQuestion = hasQuestionTone(content);
      }
      if (hasQuestionTone(content)) previousAssistantQuestionCount += 1;
      continue;
    }

    if (role === "user") {
      if (!previousSubstantiveUser && !isShortFollowupMessage(content)) {
        previousSubstantiveUser = content;
      } else if (!previousSubstantiveUser && isShortFollowupMessage(content)) {
        previousUserWasShortFollowup = true;
      }
    }
  }

  const assistantIntent = classifyIntent(previousAssistant);
  const previousUserIntent = classifyIntent(previousSubstantiveUser);
  const resolvedIntent =
    assistantIntent !== "unknown"
      ? assistantIntent
      : previousUserIntent !== "unknown"
      ? previousUserIntent
      : directIntent;

  const loopGuardTriggered =
    shortFollowup &&
    previousAssistantQuestion &&
    (previousAssistantQuestionCount >= 2 || previousUserWasShortFollowup);

  const effectiveIntent = resolvedIntent === "unknown" ? directIntent : resolvedIntent;

  return {
    shortFollowup,
    directIntent,
    effectiveIntent,
    topicHint: topicHintByIntent[effectiveIntent],
    previousAssistantQuestion,
    loopGuardTriggered,
    hasResolvedFollowupTopic: effectiveIntent !== "unknown",
  };
};

export const resolveDecisionPath = ({
  strictMode,
  chatbotUseAi,
  aiFirstEnabled,
  topScore,
  topPublicScore,
  hasResolvedFollowupTopic,
  shortFollowup,
  effectiveIntent,
  highConfidence,
  mediumConfidence,
}: ResolveDecisionPathInput): DecisionPath => {
  if (shortFollowup && effectiveIntent === "unknown") return "clarify";

  const hasRelevance = topScore >= mediumConfidence;
  if (aiFirstEnabled && chatbotUseAi) {
    if (strictMode && !hasRelevance && !hasResolvedFollowupTopic) return "fallback";
    return "ai";
  }

  if (chatbotUseAi) {
    if (topPublicScore >= highConfidence) return "faq";
    if (topScore >= mediumConfidence) return "ai";
    return "fallback";
  }

  if (topPublicScore >= mediumConfidence) return "faq";
  return "fallback";
};

export const shouldForceConcreteFollowup = (shortFollowup: boolean, effectiveIntent: ResolvedIntent) => {
  if (!shortFollowup) return false;
  return ["company_context", "plans", "trial_policy"].includes(effectiveIntent);
};
