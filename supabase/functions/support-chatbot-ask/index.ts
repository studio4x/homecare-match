// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildClarificationAnswer,
  buildCompanyContextAnswer,
  isCompetitorIntent,
  isLikelyConfirmationLoopAnswer,
  resolveConversationSignals,
  resolveDecisionPath,
  shouldForceConcreteFollowup,
} from "./intent-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-chatbot-visitor-id, x-chatbot-page-path",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STOP_WORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "como",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "eu",
  "ela",
  "ele",
  "essa",
  "esse",
  "esta",
  "este",
  "isso",
  "mais",
  "me",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "por",
  "pra",
  "qual",
  "que",
  "se",
  "sem",
  "ser",
  "sua",
  "suas",
  "seu",
  "seus",
  "um",
  "uma",
  "uns",
  "umas",
  "vou",
  "pode",
  "poderia",
  "quero",
  "quais",
  "quais",
  "sobre",
]);

const FEATURE_CATALOG = [
  {
    feature_key: "busca-inteligente-de-profissionais",
    title: "Busca Inteligente de Profissionais",
    description: "Filtre especialistas por bairro, cidade, especialidade e disponibilidade imediata.",
    profiles: ["company", "family"],
  },
  {
    feature_key: "perfil-profissional-completo",
    title: "Perfil Profissional Completo",
    description: "Exibicao de curriculo, formacoes, experiencias e biografia humanizada.",
    profiles: ["professional"],
  },
  {
    feature_key: "selo-de-verificacao-profissional",
    title: "Selo de Verificacao Profissional",
    description: "Analise manual de documentos para reforcar seguranca na contratacao.",
    profiles: ["professional"],
  },
  {
    feature_key: "academy-cursos-de-capacitacao",
    title: "Academy (Cursos de Capacitacao)",
    description: "Catalogo de cursos com certificados e selos de conquista.",
    profiles: ["professional"],
  },
  {
    feature_key: "validacao-publica-de-conquistas",
    title: "Validacao Publica de Conquistas",
    description: "Pagina para validar autenticidade de certificados e selos da Academy.",
    profiles: ["professional"],
  },
  {
    feature_key: "programa-de-indicacoes-embaixador",
    title: "Programa de Indicacoes",
    description: "Profissionais podem indicar colegas e ganhar maior visibilidade.",
    profiles: ["professional"],
  },
  {
    feature_key: "mural-de-avisos-e-comunicados",
    title: "Mural de Avisos e Comunicados",
    description: "Central de informacoes e avisos no painel.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "notificacoes-em-tempo-real",
    title: "Notificacoes em Tempo Real",
    description: "Avisos de interacoes e eventos importantes no fluxo da plataforma.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "ia-para-biografia-profissional",
    title: "IA para Biografia Profissional",
    description: "Gera biografia humanizada para perfil profissional com Gemini.",
    profiles: ["professional"],
  },
  {
    feature_key: "gestao-de-pagamentos-e-faturas",
    title: "Gestao de Pagamentos e Faturas",
    description: "Historico de pagamentos e controle da assinatura.",
    profiles: ["professional"],
  },
  {
    feature_key: "destaque-premium-na-busca",
    title: "Destaque Premium na Busca",
    description: "Planos premium recebem prioridade de exibicao na busca.",
    profiles: ["professional"],
  },
  {
    feature_key: "controle-de-visibilidade-nas-buscas",
    title: "Controle de Visibilidade nas Buscas",
    description: "Define visibilidade do perfil conforme status da assinatura.",
    profiles: ["professional"],
  },
  {
    feature_key: "contato-direto-via-whatsapp",
    title: "Contato Direto via WhatsApp",
    description: "Conexao direta entre recrutadores e profissionais sem intermediacao.",
    profiles: ["company", "family"],
  },
  {
    feature_key: "cadastro-de-pacientes-para-empresas",
    title: "Cadastro de Pacientes para Empresas",
    description: "Empresas podem organizar pacientes e vagas de atendimento.",
    profiles: ["company"],
  },
  {
    feature_key: "perfil-publico-de-recrutador",
    title: "Perfil Publico de Recrutador",
    description: "Exibe informacoes de quem esta recrutando para facilitar alinhamento.",
    profiles: ["company", "family", "professional"],
  },
  {
    feature_key: "gestao-de-contatos",
    title: "Gestao de Contatos",
    description: "Historico centralizado de contatos e interacoes.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "sistema-de-avaliacoes",
    title: "Sistema de Avaliacoes",
    description: "Usuarios podem avaliar experiencias e consultar feedbacks.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "busca-por-geolocalizacao",
    title: "Busca por Geolocalizacao",
    description: "Mapa com profissionais proximos da localizacao informada.",
    profiles: ["company", "family"],
  },
  {
    feature_key: "tutorial-de-boas-vindas",
    title: "Tutorial de Boas-vindas",
    description: "Onboarding para orientar o primeiro uso da plataforma.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "blog-de-conteudo-especializado",
    title: "Blog de Conteudo Especializado",
    description: "Artigos sobre home care, boas praticas e atualizacoes do setor.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "instalacao-do-app-pwa",
    title: "Instalacao do App (PWA)",
    description: "Permite instalar o site como app no celular.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "recuperacao-de-senha-segura",
    title: "Recuperacao de Senha Segura",
    description: "Fluxo de redefinicao de senha por e-mail.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "suporte-via-ticket",
    title: "Suporte via Ticket",
    description: "Abertura e acompanhamento de chamados de suporte.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "pagina-de-duvidas-frequentes",
    title: "Pagina de Duvidas Frequentes (FAQ)",
    description: "Base de conhecimento com perguntas e respostas publicadas.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "seguranca-e-denuncias",
    title: "Seguranca e Denuncias",
    description: "Recursos de report e protecao da comunidade.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "canal-de-sugestoes",
    title: "Canal de Sugestoes",
    description: "Canal para envio de ideias e melhorias da plataforma.",
    profiles: ["professional", "company", "family"],
  },
  {
    feature_key: "servico-de-concierge",
    title: "Servico de Concierge",
    description: "Busca manual assistida para cenarios de urgencia.",
    profiles: ["company", "family"],
  },
];

const LEGACY_OUT_OF_SCOPE_MESSAGE =
  "Posso responder apenas sobre funcionalidades da plataforma e como usa-las. Se precisar, posso te direcionar para o suporte.";
const LEGACY_PLATFORM_SCOPE_OUT_OF_SCOPE_MESSAGE =
  "Posso responder apenas sobre assuntos da plataforma HomeCare Match (funcionalidades, planos, pagamentos, conta e fluxos de uso). Se precisar, posso te direcionar para o suporte.";
const PLATFORM_SCOPE_OUT_OF_SCOPE_MESSAGE =
  "Posso te ajudar com duvidas da HomeCare Match: funcionalidades, planos, pagamentos, conta e uso da plataforma. Se quiser, tambem te encaminho para o suporte.";

const SUBSCRIPTION_POLICY_DOCS = [
  {
    id: "policy:subscription-renewal",
    type: "policy",
    title: "Como funciona a renovacao dos planos",
    content:
      "Plano mensal renova automaticamente. Plano anual tem renovacao manual no painel em /dashboard/pagamentos e pode ter parcelamento conforme configuracao do plano.",
    route: "/dashboard/pagamentos",
    tags: ["renovacao", "renovacao manual", "plano mensal", "plano anual", "assinatura", "parcelamento"],
    audience: ["professional"],
  },
  {
    id: "policy:subscription-cancellation",
    type: "policy",
    title: "Politica de cancelamento de assinatura",
    content:
      "Cancelamento e permitido em ate 7 dias apos o pagamento confirmado. O fluxo de cancelamento fica em /dashboard/pagamentos.",
    route: "/dashboard/pagamentos",
    tags: ["cancelamento", "estorno", "prazo", "7 dias", "assinatura", "fidelidade"],
    audience: ["professional"],
  },
  {
    id: "policy:courses-annual-access",
    type: "policy",
    title: "Acesso aos cursos e plano anual",
    content:
      "Cursos gratuitos da Academy sao exclusivos para assinantes do Plano Anual. O upgrade pode ser feito pelo fluxo de assinatura.",
    route: "/cursos",
    tags: ["cursos", "academy", "plano anual", "assinatura", "upgrade"],
    audience: ["professional"],
  },
];

const DEFAULTS = {
  chatbot_enabled: true,
  chatbot_use_ai: true,
  chatbot_ai_first: true,
  chatbot_welcome_message:
    "Ola! Sou o assistente da plataforma. Posso ajudar com funcionalidades e como usar cada recurso.",
  chatbot_out_of_scope_message: PLATFORM_SCOPE_OUT_OF_SCOPE_MESSAGE,
  chatbot_error_message: "Tive um problema para responder agora. Tente de novo em instantes ou abra um chamado no suporte.",
  chatbot_max_requests_anon_per_day: 20,
  chatbot_max_requests_auth_per_day: 80,
  chatbot_history_window: 12,
  chatbot_retention_days: 30,
  gemini_model: "gemini-2.0-flash",
};

const HIGH_CONFIDENCE = 0.7;
const MEDIUM_CONFIDENCE = 0.45;
const SOURCE_MIN_SCORE = 0.12;
const STRICT_CHATBOT_MODE = true;

const normalizeText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string) =>
  normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const compact = (value: string, max = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const CTA_FOOTER_PATTERNS = [
  /\s*ver\s+faq\s+ou\s+abrir\s+chamado\.?\s*$/i,
  /\s*voce\s+pode\s+ver\s+a?\s*faq\s+ou\s+abrir\s+chamado\.?\s*$/i,
  /\s*consulte\s+a?\s*faq\s+ou\s+abra?\s+r?\s*chamado\.?\s*$/i,
];
const META_EXPLANATION_PATTERNS = [
  /\bcom\s+base\s+(no|na|nos|nas)\s+(contexto|dados|documentos|fontes|base|faq)\b[^.]*[.:]?\s*/gi,
  /\bde\s+acordo\s+com\s+(o|a|os|as)\s+(contexto|dados|documentos|fontes|base|faq)\b[^.]*[.:]?\s*/gi,
  /\bsegundo\s+(o|a)\s+(contexto|documento|documentacao|base|faq)\b[^.]*[.:]?\s*/gi,
  /\bencontrei\s+uma\s+resposta\s+na\s+base\s+de\s+faq\b[^.]*[.:]?\s*/gi,
  /\bna\s+base\s+de\s+conhecimento\b[^.]*[.:]?\s*/gi,
  /\bcomo\s+assistente\s+virtual\b[^.]*[.:]?\s*/gi,
  /\bcomo\s+ia\b[^.]*[.:]?\s*/gi,
];

const sanitizeAnswer = (value: string) => {
  let text = String(value || "").replace(/\s+\n/g, "\n").trim();
  for (const pattern of CTA_FOOTER_PATTERNS) {
    text = text.replace(pattern, "").trim();
  }
  for (const pattern of META_EXPLANATION_PATTERNS) {
    text = text.replace(pattern, "").trim();
  }
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
};

const normalizeFirstName = (value: string | null | undefined) => {
  const normalized = String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/[^\p{L}\p{M}\s'`-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const [rawFirst = ""] = normalized.split(" ");
  const first = rawFirst.replace(/['`-]+$/g, "").replace(/^['`-]+/g, "").slice(0, 40);
  if (!first) return "";

  return first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR");
};

const firstName = (value: string | null | undefined) => {
  return normalizeFirstName(compact(String(value || "").trim(), 120));
};

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

const sha256Hex = async (value: string) => {
  const input = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", input);
  return toHex(new Uint8Array(digest));
};

const buildVisitorHashCandidates = async ({
  visitorId,
  forwardedFor,
  userAgent,
}: {
  visitorId: string;
  forwardedFor: string;
  userAgent: string;
}) => {
  const normalizedVisitorId = String(visitorId || "").trim();
  const normalizedForwardedFor = String(forwardedFor || "").trim();
  const normalizedUserAgent = String(userAgent || "").trim();

  const rawCandidates = [
    normalizedVisitorId,
    [normalizedVisitorId, normalizedUserAgent].filter(Boolean).join("|"),
    [normalizedVisitorId, normalizedForwardedFor, normalizedUserAgent].filter(Boolean).join("|"),
    [normalizedForwardedFor, normalizedUserAgent].filter(Boolean).join("|"),
  ].filter((value) => value.length > 0);

  const uniqueRaw = Array.from(new Set(rawCandidates));
  const hashed = await Promise.all(uniqueRaw.map((value) => sha256Hex(value)));
  return Array.from(new Set(hashed.filter((value) => value.length > 0)));
};

const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());

const buildSupportActions = (isLoggedIn: boolean) => {
  if (isLoggedIn) {
    return [
      { type: "link", label: "Ver FAQ", url: "/suporte" },
      { type: "link", label: "Abrir chamado", url: "/dashboard/suporte?openTicketModal=1&ticketStep=form" },
    ];
  }

  return [
    { type: "link", label: "Ver FAQ", url: "/suporte" },
    { type: "link", label: "Entrar para abrir chamado", url: "/login" },
  ];
};

const buildHandoffPausedAnswer = (userName?: string | null, adminName?: string | null) => {
  const prefix = userName ? `${userName}, ` : "";
  const owner = adminName ? `por ${adminName}` : "pela equipe de atendimento";
  return `${prefix}seu atendimento foi assumido ${owner}. O chatbot automatico esta pausado. Pode continuar enviando suas mensagens por aqui que o admin responde em seguida.`;
};

const ROUTE_META = [
  { path: "/dashboard/pagamentos", label: "Dashboard > Pagamentos", authRequired: true },
  { path: "/dashboard/perfil", label: "Dashboard > Perfil", authRequired: true },
  { path: "/dashboard/contatos", label: "Dashboard > Contatos", authRequired: true },
  { path: "/dashboard/suporte", label: "Dashboard > Suporte", authRequired: true },
  { path: "/dashboard/pacientes", label: "Dashboard > Pacientes", authRequired: true },
  { path: "/dashboard/avisos", label: "Dashboard > Avisos", authRequired: true },
  { path: "/dashboard/cursos", label: "Dashboard > Cursos", authRequired: true },
  { path: "/dashboard", label: "Dashboard", authRequired: true },
  { path: "/cadastro-empresa", label: "Cadastro de Empresa/Familia", authRequired: false },
  { path: "/buscar", label: "Busca de Profissionais", authRequired: false },
  { path: "/cursos", label: "Cursos", authRequired: false },
  { path: "/funcionalidades", label: "Funcionalidades", authRequired: false },
  { path: "/suporte", label: "FAQ", authRequired: false },
  { path: "/login", label: "Login", authRequired: false },
];

const INTERNAL_PATH_REGEX = /(^|[\s(])((\/[a-z0-9-]+(?:\/[a-z0-9-]+)*)(?:[?#][^\s)]*)?)(?=$|[\s).,;:!?])/gi;

const normalizeRoutePath = (value: string | null | undefined) => {
  let route = String(value || "").trim();
  if (!route) return "";

  if (/^https?:\/\//i.test(route)) {
    try {
      route = new URL(route).pathname || "";
    } catch (_err) {
      return "";
    }
  }

  route = route.split("?")[0].split("#")[0].trim();
  if (!route.startsWith("/")) return "";
  if (route.length > 1 && route.endsWith("/")) route = route.slice(0, -1);
  return route;
};

const titleCaseSegment = (value: string) =>
  String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const resolveRouteMeta = (rawRoute: string | null | undefined) => {
  const route = normalizeRoutePath(rawRoute);
  if (!route) return null;

  const exact = ROUTE_META.find((item) => item.path === route);
  if (exact) return exact;

  if (route.startsWith("/dashboard/")) {
    const segments = route.replace("/dashboard/", "").split("/").filter(Boolean);
    const section = segments.length > 0 ? titleCaseSegment(segments[0]) : "Dashboard";
    return {
      path: route,
      label: section ? `Dashboard > ${section}` : "Dashboard",
      authRequired: true,
    };
  }

  if (route === "/dashboard") {
    return { path: route, label: "Dashboard", authRequired: true };
  }

  const fallback = titleCaseSegment(route.replace(/^\//, ""));
  return { path: route, label: fallback || "Pagina", authRequired: false };
};

const humanizeInternalPathMentions = (text: string) => {
  return String(text || "").replace(INTERNAL_PATH_REGEX, (_match, prefix, pathToken) => {
    const routeInfo = resolveRouteMeta(pathToken);
    if (!routeInfo) return `${prefix}${pathToken}`;
    return `${prefix}${routeInfo.label}`;
  });
};

const ensureAuthAwareAnswer = (text: string, isLoggedIn: boolean) => {
  if (isLoggedIn) return String(text || "").trim();

  const normalized = normalizeText(text);
  const mentionsRestrictedArea =
    normalized.includes("dashboard") ||
    normalized.includes("pagamentos") ||
    normalized.includes("perfil") ||
    normalized.includes("contatos") ||
    normalized.includes("suporte");

  const alreadyMentionsLogin =
    normalized.includes("faca login") ||
    normalized.includes("faça login") ||
    normalized.includes("apos entrar") ||
    normalized.includes("após entrar") ||
    normalized.includes("depois de entrar") ||
    normalized.includes("entrar na sua conta");

  if (!mentionsRestrictedArea || alreadyMentionsLogin) return String(text || "").trim();
  return `${String(text || "").trim()} Para acessar essa area, primeiro entre na sua conta.`;
};

const adaptAnswerForDisplay = (answer: string, isLoggedIn: boolean) => {
  const cleaned = sanitizeAnswer(answer);
  const humanized = humanizeInternalPathMentions(cleaned);
  return ensureAuthAwareAnswer(humanized, isLoggedIn);
};

const resolvePrimaryRouteFromSources = (sources: any[]) => {
  const rows = Array.isArray(sources) ? sources : [];
  for (const source of rows) {
    const route = normalizeRoutePath(source?.route || "");
    if (!route) continue;
    if (route === "/suporte") continue;
    return route;
  }
  return "";
};

const buildContextualAction = (route: string, isLoggedIn: boolean) => {
  const routeInfo = resolveRouteMeta(route);
  if (!routeInfo) return null;
  if (routeInfo.path === "/suporte" || routeInfo.path === "/login") return null;

  if (routeInfo.authRequired && !isLoggedIn) {
    return {
      type: "link",
      label: `Entrar para acessar ${routeInfo.label}`,
      url: "/login",
    };
  }

  return {
    type: "link",
    label: `Ir para ${routeInfo.label}`,
    url: routeInfo.path,
  };
};

const buildSuggestedActions = ({
  isLoggedIn,
  primaryRoute,
  fallbackToSupport = false,
}: {
  isLoggedIn: boolean;
  primaryRoute?: string;
  fallbackToSupport?: boolean;
}) => {
  const contextualAction = buildContextualAction(primaryRoute || "", isLoggedIn);
  if (contextualAction) return [contextualAction];
  if (fallbackToSupport) return buildSupportActions(isLoggedIn).map((item) => ({ ...item }));
  return [];
};

const resolvePrimaryRouteFromAnswer = (answer: string) => {
  const normalized = normalizeText(answer);
  if (!normalized) return "";

  const matchFromPath = String(answer || "").match(INTERNAL_PATH_REGEX);
  if (matchFromPath && matchFromPath.length > 0) {
    for (const token of matchFromPath) {
      const candidate = token.trim().replace(/^[^(\/a-z0-9-]*/i, "");
      const route = normalizeRoutePath(candidate);
      if (!route) continue;
      if (route === "/suporte") continue;
      return route;
    }
  }

  const textHints: Array<{ tokens: string[]; route: string }> = [
    { tokens: ["dashboard", "pagamentos"], route: "/dashboard/pagamentos" },
    { tokens: ["dashboard", "perfil"], route: "/dashboard/perfil" },
    { tokens: ["dashboard", "contatos"], route: "/dashboard/contatos" },
    { tokens: ["dashboard", "suporte"], route: "/dashboard/suporte" },
    { tokens: ["dashboard", "cursos"], route: "/dashboard/cursos" },
    { tokens: ["dashboard", "pacientes"], route: "/dashboard/pacientes" },
    { tokens: ["dashboard", "avisos"], route: "/dashboard/avisos" },
    { tokens: ["dashboard"], route: "/dashboard" },
    { tokens: ["busca de profissionais"], route: "/buscar" },
    { tokens: ["buscar profissionais"], route: "/buscar" },
    { tokens: ["cursos"], route: "/cursos" },
    { tokens: ["funcionalidades"], route: "/funcionalidades" },
    { tokens: ["cadastro de empresa"], route: "/cadastro-empresa" },
    { tokens: ["login"], route: "/login" },
  ];

  for (const hint of textHints) {
    const ok = hint.tokens.every((token) => normalized.includes(normalizeText(token)));
    if (ok) return hint.route;
  }

  return "";
};

const SIGNUP_ACTIONS = [
  { type: "link", label: "Sou Profissional", url: "/login#auth-sign-up" },
  { type: "link", label: "Sou Empresa", url: "/cadastro-empresa?role=company" },
  { type: "link", label: "Sou Familia", url: "/cadastro-empresa?role=family" },
];

const SIGNUP_STRONG_INTENT_PATTERNS = [
  /\b(quero|preciso|gostaria)\s+(me\s+)?(cadastrar|criar\s+((uma|minha|sua|nossa)\s+)?conta)\b/,
  /\bcomo\s+(me\s+)?(cadastrar|criar\s+((uma|minha|sua|nossa)\s+)?conta)\b/,
  /\b(tipo|opcao)\s+de\s+cadastro\b/,
  /\bsou\s+(profissional|empresa|familia)\s+e\s+quero\s+(me\s+)?cadastrar\b/,
  /\bcriar\s+conta\s+de\s+(profissional|empresa|familia)\b/,
];

const SIGNUP_WEAK_INTENT_PATTERNS = [
  /\bcriar\s+((uma|minha|sua|nossa)\s+)?conta\b/,
  /\babrir\s+((uma|minha|sua|nossa)\s+)?conta\b/,
  /\bfazer\s+(o\s+)?cadastro\b/,
  /\biniciar\s+(o\s+)?cadastro\b/,
  /\brealizar\s+(o\s+)?cadastro\b/,
  /\bme\s+cadastrar\b/,
  /\bcadastrar\b/,
  /\bcomo\s+(me\s+)?cadastrar\b/,
  /\bcomo\s+criar\s+((uma|minha|sua|nossa)\s+)?conta\b/,
  /\bregistrar\s+((uma|minha|sua|nossa)\s+)?conta\b/,
  /\bquero\s+criar\s+((uma|minha|sua|nossa)\s+)?conta\b/,
  /\bquero\s+fazer\s+(meu|minha)?\s*cadastro\b/,
  /\binscrever\s+(na\s+plataforma|me)\b/,
];

const SIGNUP_INTENT_BLOCKLIST = [
  /\bcadastro\s+de\s+pacientes?\b/,
  /\b(atualizar|editar|alterar|completar)\s+(meu|minha)\s+cadastro\b/,
  /\b(meu|minha)\s+perfil\b/,
  /\b(sem|com)\s+cartao\b/,
  /\bcartao\b/,
  /\bcupom\b/,
  /\bteste\s+gratis\b/,
  /\bteste\s+gratuito\b/,
  /\bgratuit[oa]\b/,
  /\bdias?\b/,
  /\bacesso\s+(total|limitad[oa])\b/,
  /\bplano\b/,
  /\bassinatura\b/,
  /\bpagamento\b/,
  /\bfidelidade\b/,
  /\brenovacao\b/,
  /\bcancelamento\b/,
];

const classifySignupIntentWithAi = async ({
  apiKey,
  modelName,
  message,
  isLoggedIn,
  roleContext,
}: {
  apiKey: string;
  modelName: string;
  message: string;
  isLoggedIn: boolean;
  roleContext?: string | null;
}) => {
  const prompt = `
Classifique a mensagem abaixo e responda SOMENTE com SIM ou NAO.

Objetivo:
- SIM: usuario quer iniciar criacao de conta/cadastro agora e faz sentido mostrar botoes de tipo de cadastro.
- NAO: pergunta sobre politica/regra/duvida de cadastro (ex.: cartao, cupom, dias, plano), ou cadastro em outro contexto (ex.: cadastro de pacientes, editar cadastro/perfil).

Exemplos:
- "quero criar minha conta" -> SIM
- "sou empresa, como me cadastrar?" -> SIM
- "posso me cadastrar sem cartao?" -> NAO
- "quantos dias de teste gratis no cadastro?" -> NAO
- "como atualizar cadastro de pacientes?" -> NAO
- "como editar meu cadastro?" -> NAO

Contexto do usuario:
- Logado: ${isLoggedIn ? "sim" : "nao"}
- Papel: ${roleContext || "nao informado"}

Mensagem:
${message}
`.trim();

  const answer = await callGemini({
    apiKey,
    modelName,
    prompt,
  });

  const normalized = normalizeText(answer);
  if (normalized.startsWith("sim")) return true;
  if (normalized.startsWith("nao")) return false;
  return false;
};

const shouldOfferSignupActions = async ({
  message,
  config,
  isLoggedIn,
  roleContext,
}: {
  message: string;
  config: any;
  isLoggedIn: boolean;
  roleContext?: string | null;
}) => {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  if (SIGNUP_INTENT_BLOCKLIST.some((pattern) => pattern.test(normalized))) return false;

  const hasStrongSignal = SIGNUP_STRONG_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
  if (hasStrongSignal) return true;

  const hasWeakSignal = SIGNUP_WEAK_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!hasWeakSignal) return false;

  // Nos casos ambiguos, valida com IA antes de mostrar botoes de tipo de cadastro.
  if (!config?.chatbot_use_ai) return false;
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) return false;

  try {
    return await classifySignupIntentWithAi({
      apiKey: GEMINI_API_KEY,
      modelName: String(config?.gemini_model || DEFAULTS.gemini_model),
      message,
      isLoggedIn,
      roleContext,
    });
  } catch (_err) {
    return false;
  }
};

const buildSignupActions = () => SIGNUP_ACTIONS.map((action) => ({ ...action }));

const buildSignupIntentAnswer = (userName?: string | null) => {
  const prefix = userName ? `Perfeito, ${userName}. ` : "";
  return `${prefix}Qual tipo de cadastro voce quer fazer? Escolha uma opcao abaixo para iniciar seu cadastro.`;
};

const FREE_TRIAL_DEFAULT_DAYS = 30;

const resolveFreeTrialDays = (plans: any[]) => {
  // Regra oficial do chatbot: cadastro padrao = 30 dias com acesso limitado.
  // Isso evita respostas inconsistentes por conteudo legado em FAQ/plans.
  return FREE_TRIAL_DEFAULT_DAYS;
};

const TRIAL_POLICY_INTENT_PATTERNS = [
  /\bteste\s+gratis\b/,
  /\bteste\s+gratuito\b/,
  /\bperiodo\s+gratuito\b/,
  /\btrial\b/,
  /\bacesso\s+total\b/,
  /\bacesso\s+completo\b/,
  /\bacesso\s+limitad[oa]\b/,
  /\bquantos?\s+dias\b/,
  /\bquanto\s+tempo\b/,
  /\bdias?\s+gratis\b/,
  /\bcupom\b/,
  /\bbonificad[oa]\b/,
  /\bganh[ao]\s+\d+\s+dias\b/,
];

const TRIAL_POLICY_HISTORY_KEYWORDS = [
  "teste gratis",
  "teste gratuito",
  "periodo gratuito",
  "free_trial",
  "cupom",
  "dias de acesso",
  "acesso total",
  "acesso limitado",
];

const hasTrialPolicyContextInHistory = (historyMessages: any[]) => {
  const rows = Array.isArray(historyMessages) ? historyMessages : [];
  return rows.some((item: any) => {
    const normalized = normalizeText(item?.content || "");
    if (!normalized) return false;
    return TRIAL_POLICY_HISTORY_KEYWORDS.some((keyword) => normalized.includes(keyword));
  });
};

const isTrialPolicyIntent = (message: string, historyMessages: any[] = []) => {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  const directIntent = TRIAL_POLICY_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
  if (directIntent) return true;

  if (/\bacesso\b/.test(normalized) && hasTrialPolicyContextInHistory(historyMessages)) return true;
  return false;
};

const buildTrialPolicyAnswer = (freeTrialDays: number, userName?: string | null) => {
  const prefix = userName ? `${userName}, ` : "";
  return `${prefix}no cadastro padrao, o acesso gratuito e de ${freeTrialDays} dias e com acesso limitado. Se voce usar um cupom valido no cadastro, o prazo segue a quantidade de dias configurada no proprio cupom.`;
};

const PLAN_CATALOG_INTENT_PATTERNS = [
  /\bquais?\s+(sao\s+)?os?\s+planos?\b/,
  /\bplanos?\s+disponiveis\b/,
  /\bopcoes?\s+de\s+plano\b/,
  /\btipos?\s+de\s+plano\b/,
  /\bquais?\s+assinaturas?\b/,
  /\bplanos?\s+da\s+plataforma\b/,
];

const isPlanCatalogIntent = (message: string) => {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  return PLAN_CATALOG_INTENT_PATTERNS.some((pattern) => pattern.test(normalized));
};

type PlanSummary = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
};

const sanitizePlanDisplayName = (value: string | null | undefined) => {
  return String(value || "")
    .replace(/\(\s*sistema\s*\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const buildPlanSummaries = (plans: any[]): PlanSummary[] => {
  const rows = Array.isArray(plans) ? plans : [];
  const uniqueById = new Map<string, PlanSummary>();

  for (const row of rows) {
    const normalizedId = normalizePlanId(row?.id || "");
    if (!normalizedId) continue;
    if (uniqueById.has(normalizedId)) continue;

    const fallbackName =
      normalizedId === "yearly"
        ? "Plano Anual"
        : normalizedId === "monthly"
        ? "Plano Mensal"
        : normalizedId === "free_trial"
        ? "Teste Gratis"
        : "Plano";

    const resolvedName = sanitizePlanDisplayName(String(row?.name || fallbackName)) || fallbackName;

    uniqueById.set(normalizedId, {
      id: normalizedId,
      name: compact(resolvedName, 120) || fallbackName,
      price: compact(String(row?.price || "nao informado"), 120) || "nao informado",
      period: compact(String(row?.period || ""), 120),
      description: compact(String(row?.description || ""), 260),
    });
  }

  const orderWeight = (id: string) => {
    if (id === "yearly") return 0;
    if (id === "monthly") return 1;
    if (id === "free_trial") return 2;
    return 3;
  };

  return Array.from(uniqueById.values()).sort((a, b) => {
    const weightDiff = orderWeight(a.id) - orderWeight(b.id);
    if (weightDiff !== 0) return weightDiff;
    return a.name.localeCompare(b.name, "pt-BR");
  });
};

const describePlanCompact = (plan: PlanSummary | null | undefined) => {
  if (!plan) return "";
  const period = plan.period ? ` (${plan.period})` : "";
  return `${plan.name}: ${plan.price}${period}`;
};

const buildPlanCatalogAnswer = (plans: any[], userName?: string | null) => {
  const summaries = buildPlanSummaries(plans);
  const annualPlan = summaries.find((plan) => plan.id === "yearly");
  const monthlyPlan = summaries.find((plan) => plan.id === "monthly");
  const trialPlan = summaries.find((plan) => plan.id === "free_trial");

  const prefix = userName ? `${userName}, ` : "";
  if (!annualPlan && !monthlyPlan && !trialPlan && summaries.length === 0) {
    return `${prefix}agora nao consegui listar os planos com seguranca. Posso te direcionar para o FAQ enquanto atualizo isso.`;
  }

  const availableLabels = summaries.map((plan) => plan.name).join(", ");
  const annualText = annualPlan
    ? `O plano principal e o ${annualPlan.name}: ${annualPlan.price}${annualPlan.period ? ` (${annualPlan.period})` : ""}, com maior visibilidade e pacote mais completo.`
    : "";
  const monthlyText = monthlyPlan ? `Tambem temos ${describePlanCompact(monthlyPlan)}.` : "";
  const trialText = trialPlan
    ? `E existe ${describePlanCompact(trialPlan)}, com acesso limitado no periodo gratuito.`
    : "";

  return `${prefix}hoje os planos disponiveis sao: ${availableLabels}. ${annualText} ${monthlyText} ${trialText}`.replace(
    /\s+/g,
    " ",
  ).trim();
};

const buildDocTokens = (doc: any) => {
  const baseText = `${doc.title || ""} ${doc.content || ""} ${(doc.tags || []).join(" ")}`;
  return {
    ...doc,
    normalizedText: normalizeText(baseText),
    tokens: new Set(tokenize(baseText)),
    titleTokens: new Set(tokenize(doc.title || "")),
  };
};

const normalizePlanId = (value: string | null | undefined) => {
  const normalized = normalizeText(String(value || ""));
  if (normalized === "annual") return "yearly";
  return normalized;
};

const resolveDefaultInstallments = (config: any) => {
  const raw = Number(config?.asaas_default_installment_max || 12);
  if (!Number.isFinite(raw) || raw < 1) return 12;
  return Math.min(12, Math.floor(raw));
};

const resolvePlanInstallments = (plan: any, config: any) => {
  const raw = Number(plan?.asaas_installment_max || 0);
  if (Number.isFinite(raw) && raw > 0) return Math.min(12, Math.floor(raw));
  return resolveDefaultInstallments(config);
};

const buildPlanKnowledgeDocs = (plans: any[], config: any) => {
  const rows = Array.isArray(plans) ? plans : [];
  const allowCreditCard = config?.asaas_allow_credit_card !== false;

  return rows.flatMap((plan: any, index: number) => {
    const planId = normalizePlanId(plan?.id || "");
    const rawPlanName =
      plan?.name ||
      (planId === "yearly" ? "Plano Anual" : planId === "monthly" ? "Plano Mensal" : "Plano de Assinatura");
    const planName =
      compact(sanitizePlanDisplayName(String(rawPlanName)), 120) || "Plano de Assinatura";
    const price = compact(String(plan?.price || ""), 100) || "nao informado";
    const period = compact(String(plan?.period || ""), 80) || "nao informado";
    const description = compact(String(plan?.description || ""), 260);
    const installmentMax = resolvePlanInstallments(plan, config);
    const features = Array.isArray(plan?.features)
      ? plan.features
          .map((item: unknown) => compact(String(item || ""), 140))
          .filter((item: string) => item.length > 0)
          .slice(0, 8)
      : [];

    const renewalText =
      planId === "monthly"
        ? "Renovacao: automatica."
        : planId === "yearly"
        ? `Renovacao: manual em /dashboard/pagamentos com possibilidade de parcelamento em ate ${installmentMax}x.`
        : "Renovacao: consulte os detalhes em /dashboard/pagamentos.";

    const fidelityText =
      planId === "yearly"
        ? "Vigencia/fidelidade: plano anual com referencia de 12 meses."
        : planId === "monthly"
        ? "Vigencia/fidelidade: ciclo mensal."
        : "Vigencia/fidelidade: conforme periodo do plano.";

    const paymentMethodsText =
      planId === "free_trial"
        ? "Forma de pagamento: nao se aplica para teste gratis."
        : !allowCreditCard
        ? "Forma de pagamento: no momento nao ha metodo de pagamento habilitado para assinaturas."
        : planId === "monthly"
        ? "Forma de pagamento: cartao de credito com cobranca recorrente automatica."
        : planId === "yearly"
        ? `Forma de pagamento: cartao de credito, com opcao de parcelamento em ate ${installmentMax}x.`
        : "Forma de pagamento: cartao de credito para assinaturas.";

    const pixPolicyText =
      "PIX: atualmente nao disponivel para planos de assinatura (PIX e disponibilizado no fluxo de cursos).";

    const content = [
      `Plano: ${planName}.`,
      `Preco exibido: ${price}.`,
      `Periodo: ${period}.`,
      paymentMethodsText,
      pixPolicyText,
      renewalText,
      fidelityText,
      description ? `Resumo: ${description}.` : "",
      features.length > 0 ? `Beneficios principais: ${features.join(" | ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const baseDoc = buildDocTokens({
      id: `plan:${planId || compact(String(plan?.id || index), 40)}`,
      type: "plan",
      title: planName,
      content,
      route: "/dashboard/pagamentos",
      tags: [
        planId || "",
        "plano",
        "assinatura",
        "preco",
        "pagamentos",
        "fidelidade",
        "carencia",
        "cancelamento",
        "renovacao",
        "formas de pagamento",
        "metodos de pagamento",
        "cartao de credito",
        "pix",
      ],
      audience: ["professional"],
    });

    const paymentDoc = buildDocTokens({
      id: `plan-payment:${planId || compact(String(plan?.id || index), 40)}`,
      type: "policy",
      title: `Formas de pagamento do ${planName}`,
      content: `${paymentMethodsText} ${pixPolicyText} ${
        planId === "yearly"
          ? `No plano anual, a cobranca ocorre no checkout e pode ser parcelada em ate ${installmentMax}x no cartao.`
          : ""
      }`.trim(),
      route: "/dashboard/pagamentos",
      tags: [
        planId || "",
        "formas de pagamento",
        "metodo de pagamento",
        "cartao",
        "credito",
        "pix",
        "plano anual",
        "plano mensal",
        "parcelamento",
      ],
      audience: ["professional"],
    });

    return [baseDoc, paymentDoc];
  });
};

const docMatchesIntent = (doc: any, effectiveIntent: string) => {
  const intent = String(effectiveIntent || "unknown");
  if (intent === "unknown" || intent === "competitor") return true;

  const contentBlob = normalizeText(
    `${doc?.title || ""} ${doc?.content || ""} ${Array.isArray(doc?.tags) ? doc.tags.join(" ") : ""}`,
  );
  if (!contentBlob) return false;

  if (intent === "signup") {
    return (
      /\bcadastro\b/.test(contentBlob) ||
      /\bcriar conta\b/.test(contentBlob) ||
      /\bempresa\b/.test(contentBlob) ||
      /\bfamilia\b/.test(contentBlob) ||
      /\bprofissional\b/.test(contentBlob)
    );
  }

  if (intent === "company_context") {
    return (
      /\bempresa\b/.test(contentBlob) ||
      /\bhome care\b/.test(contentBlob) ||
      /\bconcierge\b/.test(contentBlob) ||
      /\bbusca\b/.test(contentBlob) ||
      /\bprofissiona/.test(contentBlob)
    );
  }

  if (intent === "plans") {
    return (
      doc?.type === "plan" ||
      doc?.type === "policy" ||
      /\bplano\b/.test(contentBlob) ||
      /\bassinatura\b/.test(contentBlob) ||
      /\bpagamento\b/.test(contentBlob) ||
      /\bmensal\b/.test(contentBlob) ||
      /\banual\b/.test(contentBlob)
    );
  }

  if (intent === "trial_policy") {
    return (
      /\bteste gratis\b/.test(contentBlob) ||
      /\bteste gratuito\b/.test(contentBlob) ||
      /\bcupom\b/.test(contentBlob) ||
      /\bacesso limitado\b/.test(contentBlob) ||
      /\bdias de acesso\b/.test(contentBlob) ||
      /\btrial\b/.test(contentBlob)
    );
  }

  return true;
};

const scoreDoc = (questionTokens: string[], normalizedQuestion: string, doc: any, roleContext?: string | null) => {
  if (!questionTokens.length) return 0;
  const uniqueQuestion = Array.from(new Set(questionTokens));
  const docTokenSet: Set<string> = doc.tokens || new Set();
  const docTitleSet: Set<string> = doc.titleTokens || new Set();

  let overlapCount = 0;
  let titleOverlapCount = 0;
  for (const token of uniqueQuestion) {
    if (docTokenSet.has(token)) overlapCount += 1;
    if (docTitleSet.has(token)) titleOverlapCount += 1;
  }

  const overlapRatio = overlapCount / Math.max(1, uniqueQuestion.length);
  const titleRatio = titleOverlapCount / Math.max(1, uniqueQuestion.length);
  const phraseBoost =
    normalizedQuestion.length >= 10 && String(doc.normalizedText || "").includes(normalizedQuestion) ? 0.2 : 0;

  let roleBoost = 0;
  const normalizedRole = normalizeText(roleContext || "");
  if (normalizedRole && Array.isArray(doc.audience) && doc.audience.length > 0) {
    const audienceMatches = doc.audience.some((aud: string) => normalizeText(aud) === normalizedRole);
    if (audienceMatches) roleBoost = 0.08;
  }

  return Math.min(1, overlapRatio * 0.75 + titleRatio * 0.2 + phraseBoost + roleBoost);
};

const buildFaqModeAnswer = (question: string, topDocs: any[], userName?: string | null) => {
  const top = topDocs[0];
  if (!top) return "Nao encontrei informacao suficiente para responder com seguranca sobre essa funcionalidade.";

  const relatedTitles = topDocs
    .slice(1, 3)
    .map((doc) => compact(String(doc.title || ""), 80))
    .filter(Boolean);

  const greeting = userName ? `Ola, ${userName}. ` : "";
  const related =
    relatedTitles.length > 0
      ? `\n\nSe quiser, tambem te explico ${relatedTitles.join(relatedTitles.length > 1 ? " e " : "")}.`
      : "";
  return `${greeting}${compact(top.content, 1200)}${related}`;
};

const selectAiContextDocs = (scoredDocs: any[]) => {
  const selected: any[] = [];
  const seen = new Set<string>();
  const tryPush = (doc: any) => {
    if (!doc?.id || seen.has(doc.id)) return;
    seen.add(doc.id);
    selected.push(doc);
  };

  scoredDocs.slice(0, 8).forEach(tryPush);
  scoredDocs
    .filter((doc) => doc.type === "faq" && Number(doc.score || 0) >= 0.08)
    .slice(0, 3)
    .forEach(tryPush);
  scoredDocs
    .filter((doc) => doc.type === "guide" && Number(doc.score || 0) >= 0.08)
    .slice(0, 3)
    .forEach(tryPush);
  scoredDocs
    .filter((doc) => doc.type === "feature" && Number(doc.score || 0) >= 0.05)
    .slice(0, 3)
    .forEach(tryPush);
  scoredDocs
    .filter((doc) => (doc.type === "plan" || doc.type === "policy") && Number(doc.score || 0) >= 0.05)
    .slice(0, 4)
    .forEach(tryPush);

  return selected.slice(0, 12);
};

const callGemini = async ({
  apiKey,
  modelName,
  prompt,
}: {
  apiKey: string;
  modelName: string;
  prompt: string;
}) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
        },
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Falha ao comunicar com o Gemini.");
  }

  const answer = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!answer) throw new Error("Resposta vazia do Gemini.");
  return String(answer).trim();
};

const buildQuestionKey = (value: string) => compact(normalizeText(value), 320);

const trackUnansweredQuestion = async ({
  supabaseAdmin,
  question,
  reason,
  userId,
  visitorHash,
  sessionId,
  pagePath,
}: {
  supabaseAdmin: any;
  question: string;
  reason: "low_confidence" | "ai_out_of_scope";
  userId: string | null;
  visitorHash: string;
  sessionId: string;
  pagePath: string | null;
}) => {
  const normalizedQuestion = buildQuestionKey(question);
  const rawQuestion = compact(String(question || "").trim(), 900);
  if (!normalizedQuestion || normalizedQuestion.length < 6 || !rawQuestion) return;

  try {
    const nowIso = new Date().toISOString();
    const { data: existingRow, error: existingError } = await supabaseAdmin
      .from("chatbot_unanswered_questions")
      .select("id, occurrences")
      .eq("normalized_question", normalizedQuestion)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingRow?.id) {
      const nextCount = Math.max(1, Number(existingRow.occurrences || 0) + 1);
      const { error: updateError } = await supabaseAdmin
        .from("chatbot_unanswered_questions")
        .update({
          question: rawQuestion,
          occurrences: nextCount,
          last_asked_at: nowIso,
          last_reason: reason,
          last_user_id: userId || null,
          last_visitor_hash: visitorHash,
          last_session_id: sessionId,
          last_page_path: pagePath,
        })
        .eq("id", existingRow.id);

      if (updateError) throw updateError;
      return;
    }

    const { error: insertError } = await supabaseAdmin.from("chatbot_unanswered_questions").insert({
      normalized_question: normalizedQuestion,
      question: rawQuestion,
      occurrences: 1,
      status: "new",
      first_asked_at: nowIso,
      last_asked_at: nowIso,
      last_reason: reason,
      last_user_id: userId || null,
      last_visitor_hash: visitorHash,
      last_session_id: sessionId,
      last_page_path: pagePath,
    });

    if (insertError) throw insertError;

    await supabaseAdmin.from("admin_notifications").insert({
      title: "Nova pergunta sem resposta do chatbot",
      content: "Uma pergunta nao encontrada pelo chatbot foi registrada para avaliacao de FAQ/guia.",
      link: "/admin/sugestoes",
      type: "info",
    });
  } catch (error) {
    console.error("[support-chatbot-ask] falha ao registrar pergunta sem resposta:", error?.message || error);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const rawMessage = String(body?.message || "").trim();
    const requestedSessionId = String(body?.session_id || "").trim();
    const requestedPagePath =
      String(body?.page_path || req.headers.get("x-chatbot-page-path") || "").trim() || null;
    const requestedRoleContext = String(body?.role_context || "").trim() || null;

    if (!rawMessage) {
      return new Response(JSON.stringify({ error: "Pergunta obrigatoria." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: siteConfig } = await supabaseAdmin
      .from("site_config")
      .select(
        [
          "chatbot_enabled",
          "chatbot_use_ai",
          "chatbot_ai_first",
          "chatbot_welcome_message",
          "chatbot_out_of_scope_message",
          "chatbot_error_message",
          "chatbot_max_requests_anon_per_day",
          "chatbot_max_requests_auth_per_day",
          "chatbot_history_window",
          "chatbot_retention_days",
          "gemini_model",
          "asaas_allow_credit_card",
          "asaas_default_installment_max",
        ].join(","),
      )
      .eq("id", 1)
      .maybeSingle();

    const config = { ...DEFAULTS, ...(siteConfig || {}) };
    const currentOutOfScopeMessage = normalizeText(config.chatbot_out_of_scope_message || "");
    if (
      !currentOutOfScopeMessage ||
      currentOutOfScopeMessage === normalizeText(LEGACY_OUT_OF_SCOPE_MESSAGE) ||
      currentOutOfScopeMessage === normalizeText(LEGACY_PLATFORM_SCOPE_OUT_OF_SCOPE_MESSAGE) ||
      currentOutOfScopeMessage.includes("apenas sobre funcionalidades da plataforma") ||
      currentOutOfScopeMessage.includes("posso responder apenas sobre assuntos da plataforma")
    ) {
      config.chatbot_out_of_scope_message = PLATFORM_SCOPE_OUT_OF_SCOPE_MESSAGE;
    }

    if (!config.chatbot_enabled) {
      return new Response(
        JSON.stringify({
          error: "Chatbot desativado.",
          session_id: requestedSessionId || "",
          mode: "fallback",
          answer: config.chatbot_error_message,
          handoff_active: false,
          handoff_admin_name: null,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim() || "";

    let userId: string | null = null;
    let profileRole: string | null = null;
    let profileName: string | null = null;
    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) {
        const candidateUserId = data.user.id;
        const metadataName = compact(String(data.user.user_metadata?.full_name || data.user.user_metadata?.name || ""), 120);
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("role,full_name")
          .eq("id", candidateUserId)
          .maybeSingle();
        if (profile) {
          userId = candidateUserId;
          profileRole = profile?.role || null;
          profileName = compact(String(profile?.full_name || metadataName || ""), 120) || null;
        }
      }
    }

    const visitorId = String(req.headers.get("x-chatbot-visitor-id") || "").trim();
    const forwardedFor = String(req.headers.get("x-forwarded-for") || "").trim();
    const userAgent = String(req.headers.get("user-agent") || "").trim();
    const visitorHashCandidates = await buildVisitorHashCandidates({ visitorId, forwardedFor, userAgent });
    const visitorHash =
      visitorHashCandidates[0] ||
      (await sha256Hex(
        [
          String(visitorId || "").trim(),
          String(forwardedFor || "").trim(),
          String(userAgent || "").trim(),
        ]
          .filter(Boolean)
          .join("|"),
      ));
    const roleContext = requestedRoleContext || profileRole || null;
    const userFirstName = firstName(profileName);

    const retentionDays = Math.max(1, Number(config.chatbot_retention_days || 30));
    const retentionThresholdIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const retentionDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await Promise.all([
      supabaseAdmin.from("chatbot_messages").delete().lt("created_at", retentionThresholdIso),
      supabaseAdmin.from("chatbot_sessions").delete().lt("updated_at", retentionThresholdIso),
      supabaseAdmin.from("chatbot_usage_logs").delete().lt("request_date", retentionDate),
    ]);

    const actorKey = userId ? `user:${userId}` : `anon:${visitorHash}`;
    const requestDate = new Date().toISOString().slice(0, 10);
    const maxPerDay = userId
      ? Math.max(1, Number(config.chatbot_max_requests_auth_per_day || 80))
      : Math.max(1, Number(config.chatbot_max_requests_anon_per_day || 20));

    const { data: usageRow } = await supabaseAdmin
      .from("chatbot_usage_logs")
      .select("id, request_count")
      .eq("actor_key", actorKey)
      .eq("request_date", requestDate)
      .maybeSingle();

    if (usageRow && Number(usageRow.request_count || 0) >= maxPerDay) {
      return new Response(
        JSON.stringify({
          session_id: requestedSessionId || "",
          mode: "fallback",
          answer:
            "Voce atingiu o limite diario de perguntas do assistente. Tente novamente amanha ou abra um chamado de suporte.",
          can_open_ticket: !!userId,
          suggested_actions: buildSupportActions(!!userId),
          sources: [],
          handoff_active: false,
          handoff_admin_name: null,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (usageRow?.id) {
      await supabaseAdmin
        .from("chatbot_usage_logs")
        .update({
          request_count: Number(usageRow.request_count || 0) + 1,
          user_id: userId || null,
          visitor_hash: visitorHash,
          last_request_at: new Date().toISOString(),
        })
        .eq("id", usageRow.id);
    } else {
      await supabaseAdmin.from("chatbot_usage_logs").insert({
        actor_key: actorKey,
        user_id: userId || null,
        visitor_hash: visitorHash,
        request_date: requestDate,
        request_count: 1,
        last_request_at: new Date().toISOString(),
      });
    }

    let sessionId = "";
    let sessionHandoffActive = false;
    let sessionHandoffAdminName: string | null = null;
    if (requestedSessionId && isUuidLike(requestedSessionId)) {
      const { data: existingSession } = await supabaseAdmin
        .from("chatbot_sessions")
        .select("id, user_id, visitor_hash, human_handoff_active, human_handoff_admin_name")
        .eq("id", requestedSessionId)
        .maybeSingle();

      const isOwner =
        !!existingSession &&
        ((userId && existingSession.user_id === userId) ||
          (!userId &&
            !existingSession.user_id &&
            visitorHashCandidates.includes(String(existingSession.visitor_hash || ""))));

      if (isOwner) {
        sessionId = existingSession.id;
        sessionHandoffActive = !!existingSession.human_handoff_active;
        sessionHandoffAdminName = existingSession.human_handoff_admin_name || null;
      }
    }

    if (!sessionId) {
      const { data: createdSession, error: sessionError } = await supabaseAdmin
        .from("chatbot_sessions")
        .insert({
          user_id: userId || null,
          visitor_hash: userId ? null : visitorHash,
          page_path: requestedPagePath,
          role_context: roleContext,
          last_mode: "system",
        })
        .select("id, human_handoff_active, human_handoff_admin_name")
        .single();

      if (sessionError || !createdSession?.id) {
        throw new Error(sessionError?.message || "Falha ao criar sessao do chatbot.");
      }
      sessionId = createdSession.id;
      sessionHandoffActive = !!createdSession.human_handoff_active;
      sessionHandoffAdminName = createdSession.human_handoff_admin_name || null;
    } else {
      await supabaseAdmin
        .from("chatbot_sessions")
        .update({
          page_path: requestedPagePath,
          role_context: roleContext,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    }

    await supabaseAdmin.from("chatbot_messages").insert({
      session_id: sessionId,
      role: "user",
      content: rawMessage,
      mode: "system",
      sources: [],
    });

    if (sessionHandoffActive) {
      return new Response(
        JSON.stringify({
          session_id: sessionId,
          answer: buildHandoffPausedAnswer(userFirstName || null, sessionHandoffAdminName || null),
          sources: [],
          mode: "fallback",
          can_open_ticket: !!userId,
          suggested_actions: [],
          handoff_active: true,
          handoff_admin_name: sessionHandoffAdminName || null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const respondWithAssistantMessage = async ({
      answer,
      mode,
      sources,
      suggestedActions,
      decisionMeta,
      status = 200,
    }: {
      answer: string;
      mode: "faq" | "ai" | "fallback";
      sources: any[];
      suggestedActions: any[];
      decisionMeta: Record<string, unknown>;
      status?: number;
    }) => {
      const payloadWithMeta = {
        session_id: sessionId,
        role: "assistant",
        content: answer,
        mode,
        sources: Array.isArray(sources) ? sources : [],
        decision_meta: decisionMeta || {},
      };
      const { error: insertError } = await supabaseAdmin.from("chatbot_messages").insert(payloadWithMeta);
      if (insertError) {
        const { error: fallbackInsertError } = await supabaseAdmin.from("chatbot_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: answer,
          mode,
          sources: Array.isArray(sources) ? sources : [],
        });
        if (fallbackInsertError) throw fallbackInsertError;
      }

      await supabaseAdmin
        .from("chatbot_sessions")
        .update({
          last_mode: mode,
          page_path: requestedPagePath,
          role_context: roleContext,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          answer,
          sources: Array.isArray(sources) ? sources : [],
          mode,
          can_open_ticket: !!userId,
          suggested_actions: Array.isArray(suggestedActions) ? suggestedActions : buildSupportActions(!!userId),
          handoff_active: false,
          handoff_admin_name: null,
        }),
        {
          status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    };

    if (isCompetitorIntent(rawMessage)) {
      return await respondWithAssistantMessage({
        answer: config.chatbot_out_of_scope_message,
        mode: "fallback",
        sources: [],
        suggestedActions: buildSupportActions(!!userId),
        decisionMeta: {
          intent_detected: "competitor",
          effective_intent: "competitor",
          top_score: null,
          top_public_score: null,
          decision_path: "fallback",
          loop_guard_triggered: false,
        },
      });
    }

    const [{ data: faqs }, { data: guides }, { data: plans }, { data: historyMessages }] = await Promise.all([
      supabaseAdmin.from("support_faqs").select("id, question, answer, category").eq("is_published", true),
      supabaseAdmin
        .from("support_guides")
        .select("id, title, module, audience, question_variants, content")
        .eq("is_published", true),
      supabaseAdmin
        .from("plans")
        .select("id, name, price, period, description, features, asaas_installment_max, popular, savings"),
      supabaseAdmin
        .from("chatbot_messages")
        .select("role, content, mode, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(Math.max(2, Number(config.chatbot_history_window || 12) * 2)),
    ]);

    const freeTrialDays = resolveFreeTrialDays(plans || []);
    const planDocsForActions = buildPlanKnowledgeDocs(plans || [], config);
    const historyChronological = Array.isArray(historyMessages) ? [...historyMessages].reverse() : [];
    const conversationSignals = resolveConversationSignals({
      historyMessages: historyChronological,
      currentMessage: rawMessage,
    });
    const intentDetected = conversationSignals.directIntent;
    const effectiveIntent = conversationSignals.effectiveIntent;

    const planCatalogSources = planDocsForActions
      .filter((doc) => ["plan:yearly", "plan:monthly", "plan:free_trial"].includes(String(doc.id || "")))
      .slice(0, 3)
      .map((doc) => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        route: doc.route,
        snippet: compact(doc.content, 180),
        score: 1,
      }));

    const trialPolicyDoc = buildDocTokens({
      id: "policy:free-trial-coupon",
      type: "policy",
      title: "Politica de teste gratuito e cupom no cadastro",
      content: `No cadastro padrao, o acesso gratuito e de ${freeTrialDays} dias e com acesso limitado. Se houver cupom valido no cadastro, o prazo de acesso passa a ser a quantidade de dias configurada no cupom.`,
      route: "/login",
      tags: [
        "teste gratis",
        "teste gratuito",
        "trial",
        "dias de acesso",
        "acesso limitado",
        "cupom",
        "cadastro",
      ],
      audience: ["professional"],
    });

    if (conversationSignals.shortFollowup && effectiveIntent === "unknown") {
      return await respondWithAssistantMessage({
        answer: adaptAnswerForDisplay(buildClarificationAnswer(userFirstName || null), !!userId),
        mode: "fallback",
        sources: [],
        suggestedActions: buildSupportActions(!!userId),
        decisionMeta: {
          intent_detected: intentDetected,
          effective_intent: effectiveIntent,
          top_score: null,
          top_public_score: null,
          decision_path: "clarify",
          loop_guard_triggered: conversationSignals.loopGuardTriggered,
        },
      });
    }

    const allowSignupIntentCheck = !conversationSignals.shortFollowup || effectiveIntent === "signup";
    const signupIntentDetected = allowSignupIntentCheck
      ? await shouldOfferSignupActions({
          message: rawMessage,
          config,
          isLoggedIn: !!userId,
          roleContext,
        })
      : false;

    if (signupIntentDetected || (conversationSignals.shortFollowup && effectiveIntent === "signup")) {
      return await respondWithAssistantMessage({
        answer: sanitizeAnswer(buildSignupIntentAnswer(userFirstName || null)),
        mode: "faq",
        sources: [],
        suggestedActions: buildSignupActions(),
        decisionMeta: {
          intent_detected: signupIntentDetected ? "signup" : intentDetected,
          effective_intent: "signup",
          top_score: null,
          top_public_score: null,
          decision_path: "faq",
          loop_guard_triggered: conversationSignals.loopGuardTriggered,
        },
      });
    }

    if (shouldForceConcreteFollowup(conversationSignals.shortFollowup, effectiveIntent)) {
      if (effectiveIntent === "company_context") {
        return await respondWithAssistantMessage({
          answer: adaptAnswerForDisplay(buildCompanyContextAnswer(userFirstName || null), !!userId),
          mode: "faq",
          sources: [],
          suggestedActions: buildSuggestedActions({
            isLoggedIn: !!userId,
            primaryRoute: "/buscar",
          }),
          decisionMeta: {
            intent_detected: intentDetected,
            effective_intent: effectiveIntent,
            top_score: null,
            top_public_score: null,
            decision_path: "faq",
            loop_guard_triggered: true,
          },
        });
      }

      if (effectiveIntent === "plans") {
        return await respondWithAssistantMessage({
          answer: adaptAnswerForDisplay(buildPlanCatalogAnswer(plans || [], userFirstName || null), !!userId),
          mode: "faq",
          sources: planCatalogSources,
          suggestedActions: buildSuggestedActions({
            isLoggedIn: !!userId,
            primaryRoute: "/dashboard/pagamentos",
          }),
          decisionMeta: {
            intent_detected: intentDetected,
            effective_intent: effectiveIntent,
            top_score: null,
            top_public_score: null,
            decision_path: "faq",
            loop_guard_triggered: true,
          },
        });
      }

      if (effectiveIntent === "trial_policy") {
        const sources = [
          {
            id: trialPolicyDoc.id,
            type: trialPolicyDoc.type,
            title: trialPolicyDoc.title,
            route: trialPolicyDoc.route,
            snippet: compact(trialPolicyDoc.content, 180),
            score: 1,
          },
        ];
        return await respondWithAssistantMessage({
          answer: adaptAnswerForDisplay(buildTrialPolicyAnswer(freeTrialDays, userFirstName || null), !!userId),
          mode: "faq",
          sources,
          suggestedActions: buildSuggestedActions({
            isLoggedIn: !!userId,
            primaryRoute: resolvePrimaryRouteFromSources(sources),
          }),
          decisionMeta: {
            intent_detected: intentDetected,
            effective_intent: effectiveIntent,
            top_score: null,
            top_public_score: null,
            decision_path: "faq",
            loop_guard_triggered: true,
          },
        });
      }
    }

    if (isPlanCatalogIntent(rawMessage)) {
      return await respondWithAssistantMessage({
        answer: adaptAnswerForDisplay(buildPlanCatalogAnswer(plans || [], userFirstName || null), !!userId),
        mode: "faq",
        sources: planCatalogSources.length > 0 ? planCatalogSources : [],
        suggestedActions: buildSuggestedActions({
          isLoggedIn: !!userId,
          primaryRoute: "/dashboard/pagamentos",
        }),
        decisionMeta: {
          intent_detected: "plans",
          effective_intent: "plans",
          top_score: null,
          top_public_score: null,
          decision_path: "faq",
          loop_guard_triggered: conversationSignals.loopGuardTriggered,
        },
      });
    }

    if (isTrialPolicyIntent(rawMessage, historyMessages || [])) {
      const sources = [
        {
          id: trialPolicyDoc.id,
          type: trialPolicyDoc.type,
          title: trialPolicyDoc.title,
          route: trialPolicyDoc.route,
          snippet: compact(trialPolicyDoc.content, 180),
          score: 1,
        },
      ];
      return await respondWithAssistantMessage({
        answer: adaptAnswerForDisplay(buildTrialPolicyAnswer(freeTrialDays, userFirstName || null), !!userId),
        mode: "faq",
        sources,
        suggestedActions: buildSuggestedActions({
          isLoggedIn: !!userId,
          primaryRoute: resolvePrimaryRouteFromSources(sources),
        }),
        decisionMeta: {
          intent_detected: "trial_policy",
          effective_intent: "trial_policy",
          top_score: null,
          top_public_score: null,
          decision_path: "faq",
          loop_guard_triggered: conversationSignals.loopGuardTriggered,
        },
      });
    }

    const docs = [
      ...(faqs || []).map((faq: any) =>
        buildDocTokens({
          id: `faq:${faq.id}`,
          type: "faq",
          title: faq.question,
          content: faq.answer,
          route: "/suporte",
          tags: [faq.category || ""],
          audience: [],
        }),
      ),
      ...(guides || []).map((guide: any) =>
        buildDocTokens({
          id: `guide:${guide.id}`,
          type: "guide",
          title: guide.title,
          content: guide.content,
          route: "/suporte",
          tags: [guide.module || "", ...(guide.question_variants || [])],
          audience: Array.isArray(guide.audience) ? guide.audience : [],
        }),
      ),
      ...planDocsForActions,
      ...SUBSCRIPTION_POLICY_DOCS.map((policy) => buildDocTokens(policy)),
      trialPolicyDoc,
      ...FEATURE_CATALOG.map((feature) =>
        buildDocTokens({
          id: `feature:${feature.feature_key}`,
          type: "feature",
          title: feature.title,
          content: feature.description,
          route: "/funcionalidades",
          tags: feature.profiles || [],
          audience: feature.profiles || [],
        }),
      ),
    ];

    const retrievalMessage =
      conversationSignals.shortFollowup && conversationSignals.topicHint
        ? `${rawMessage} ${conversationSignals.topicHint}`.trim()
        : rawMessage;
    const normalizedQuestion = normalizeText(retrievalMessage);
    const questionTokens = tokenize(retrievalMessage);
    const scored = docs
      .map((doc) => ({ ...doc, score: scoreDoc(questionTokens, normalizedQuestion, doc, roleContext) }))
      .sort((a, b) => b.score - a.score);
    const topDocs = scored.slice(0, 4);
    const publicDocs = scored.filter((doc) => doc.type !== "guide");
    const topPublicDocs = publicDocs.slice(0, 4);
    const aiContextDocs = selectAiContextDocs(scored);
    const topScore = Number(topDocs[0]?.score || 0);
    const topPublicScore = Number(topPublicDocs[0]?.score || 0);

    let mode: "faq" | "ai" | "fallback" = "fallback";
    let answer = config.chatbot_out_of_scope_message;
    let unansweredReason: "low_confidence" | "ai_out_of_scope" | null = null;
    let decisionPath: "faq" | "ai" | "fallback" | "clarify" = "fallback";
    const sourceCandidates = aiContextDocs.length > 0 ? aiContextDocs : topDocs;
    const publicSourceCandidates = topPublicDocs.length > 0 ? topPublicDocs : publicDocs.slice(0, 8);
    const sources = publicSourceCandidates
      .filter((doc) => Number(doc.score || 0) >= SOURCE_MIN_SCORE)
      .filter((doc) => docMatchesIntent(doc, effectiveIntent))
      .slice(0, 4)
      .map((doc) => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        route: doc.route,
        snippet: compact(doc.content, 180),
        score: Number(doc.score.toFixed(3)),
      }));

    const runAiAnswer = async (docsForAi: any[]) => {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY ausente.");

      const modelName = String(config.gemini_model || DEFAULTS.gemini_model);
      const authState = userId ? "logado" : "deslogado";
      const history = (historyMessages || [])
        .slice()
        .reverse()
        .filter((item: any) => item.role === "user" || item.role === "assistant")
        .map((item: any) => `${item.role === "user" ? "Usuario" : "Assistente"}: ${compact(item.content, 350)}`)
        .join("\n");

      const context = docsForAi
        .slice(0, 12)
        .map(
          (doc, index) =>
            `[Fonte ${index + 1} | ${doc.type}] ${doc.title}\nRota: ${doc.route}\nScore: ${Number(
              doc.score || 0,
            ).toFixed(3)}\nConteudo: ${compact(doc.content, 700)}`,
        )
        .join("\n\n");

      const prompt = `
Voce e o assistente oficial da plataforma HomeCare Match.

Regras obrigatorias:
- Responda APENAS sobre assuntos da plataforma HomeCare Match.
- Escopo permitido: funcionalidades, planos, assinatura, pagamentos, cadastro, suporte, cursos, configuracoes e fluxos de uso existentes na plataforma.
- Se a pergunta fugir do escopo, responda exatamente com: "${config.chatbot_out_of_scope_message}"
- Nao invente telas, links, recursos ou regras.
- Resposta curta, pratica e em portugues (pt-BR), mantendo o idioma do usuario se a pergunta vier em outro idioma.
- Escreva como um especialista humano da plataforma.
- Fale em tom de conversa, natural e direto (evite linguagem corporativa ou robotica).
- Use frases curtas (preferencia: 1 a 4 frases) e foco em resolver a pergunta.
- Nao mencione "base de dados", "base de conhecimento", "documentos", "fontes", "contexto", "IA", "modelo" ou termos internos.
- Nao use frases como "com base no contexto", "encontrei na FAQ" ou equivalentes.
- Evite incluir URLs/caminhos de tela automaticamente; cite caminhos apenas quando o usuario pedir ou quando for indispensavel para executar o passo.
- Nunca escreva caminhos tecnicos com barra no corpo da resposta (ex.: /dashboard/pagamentos). Use nomes de tela naturais (ex.: "Dashboard > Pagamentos").
- Nao inclua chamadas de acao como "Ver FAQ", "Abrir chamado" ou frases equivalentes no corpo da resposta.
- Se houver nome do usuario no contexto, pode usar o nome com naturalidade no inicio da resposta, sem repetir em excesso.
- Regra fixa para cadastro/teste/cupom: no cadastro padrao sao ${freeTrialDays} dias de acesso gratuito e limitado. Se houver cupom valido no cadastro, prevalece a quantidade de dias configurada no cupom. Nunca diga acesso total nesse contexto.
- Se o usuario estiver deslogado, nao diga para acessar Dashboard como acao imediata. Explique o passo considerando que primeiro precisa entrar na conta.
- Se a mensagem do usuario for um follow-up curto (como "sim", "quero", "explique"), mantenha o assunto atual e entregue conteudo objetivo, sem fazer outra pergunta de confirmacao.

Contexto autorizado:
${context || "(nenhuma fonte especifica encontrada no momento)"}

Contexto do usuario:
Nome: ${userFirstName || "(nao informado)"}
Perfil: ${roleContext || "(nao informado)"}
Autenticacao: ${authState}
Intencao efetiva detectada: ${effectiveIntent || "unknown"}

Historico recente:
${history || "(sem historico relevante)"}

Pergunta do usuario:
${rawMessage}
`.trim();

      return await callGemini({
        apiKey: GEMINI_API_KEY,
        modelName,
        prompt,
      });
    };

    const aiFirstEnabled = config.chatbot_use_ai && config.chatbot_ai_first;
    decisionPath = resolveDecisionPath({
      strictMode: STRICT_CHATBOT_MODE,
      chatbotUseAi: !!config.chatbot_use_ai,
      aiFirstEnabled,
      topScore,
      topPublicScore,
      hasResolvedFollowupTopic: conversationSignals.hasResolvedFollowupTopic,
      shortFollowup: conversationSignals.shortFollowup,
      effectiveIntent,
      highConfidence: HIGH_CONFIDENCE,
      mediumConfidence: MEDIUM_CONFIDENCE,
    });

    if (decisionPath === "clarify") {
      mode = "fallback";
      answer = buildClarificationAnswer(userFirstName || null);
    } else if (decisionPath === "faq") {
      mode = "faq";
      answer = buildFaqModeAnswer(retrievalMessage, topPublicDocs, userFirstName || null);
    } else if (decisionPath === "ai") {
      try {
        const aiAnswer = await runAiAnswer(sourceCandidates);

        if (normalizeText(aiAnswer) === normalizeText(config.chatbot_out_of_scope_message)) {
          mode = "fallback";
          decisionPath = "fallback";
          answer = config.chatbot_out_of_scope_message;
          unansweredReason = "ai_out_of_scope";
        } else {
          mode = "ai";
          answer = aiAnswer;
        }
      } catch (_err) {
        mode = "fallback";
        decisionPath = "fallback";
        answer = config.chatbot_error_message;
      }
    } else {
      mode = "fallback";
      answer = config.chatbot_out_of_scope_message;
      unansweredReason = "low_confidence";
    }

    let loopGuardTriggered = conversationSignals.loopGuardTriggered;
    if (mode !== "fallback" && conversationSignals.shortFollowup && isLikelyConfirmationLoopAnswer(answer)) {
      loopGuardTriggered = true;
      decisionPath = effectiveIntent === "unknown" ? "clarify" : "faq";

      if (effectiveIntent === "plans") {
        mode = "faq";
        answer = buildPlanCatalogAnswer(plans || [], userFirstName || null);
      } else if (effectiveIntent === "trial_policy") {
        mode = "faq";
        answer = buildTrialPolicyAnswer(freeTrialDays, userFirstName || null);
      } else if (effectiveIntent === "company_context") {
        mode = "faq";
        answer = buildCompanyContextAnswer(userFirstName || null);
      } else {
        mode = "fallback";
        answer = buildClarificationAnswer(userFirstName || null);
      }
    }

    answer = adaptAnswerForDisplay(answer, !!userId);

    const finalSources = mode === "fallback" || decisionPath === "clarify" ? [] : sources;
    const primaryRoute =
      resolvePrimaryRouteFromSources(finalSources) || resolvePrimaryRouteFromAnswer(answer);
    const suggestedActions =
      mode === "fallback" || decisionPath === "clarify"
        ? buildSupportActions(!!userId)
        : buildSuggestedActions({
            isLoggedIn: !!userId,
            primaryRoute,
          });

    if (unansweredReason) {
      await trackUnansweredQuestion({
        supabaseAdmin,
        question: rawMessage,
        reason: unansweredReason,
        userId,
        visitorHash,
        sessionId,
        pagePath: requestedPagePath,
      });
    }

    return await respondWithAssistantMessage({
      answer,
      mode,
      sources: finalSources,
      suggestedActions,
      decisionMeta: {
        intent_detected: intentDetected,
        effective_intent: effectiveIntent,
        top_score: Number(topScore.toFixed(3)),
        top_public_score: Number(topPublicScore.toFixed(3)),
        decision_path: decisionPath,
        loop_guard_triggered: loopGuardTriggered,
      },
    });
  } catch (error) {
    console.error("[support-chatbot-ask] erro:", error?.message || error);
    return new Response(
      JSON.stringify({
        error: error?.message || "Erro ao processar pergunta do chatbot.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
