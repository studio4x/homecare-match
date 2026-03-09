// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
const PLATFORM_SCOPE_OUT_OF_SCOPE_MESSAGE =
  "Posso responder apenas sobre assuntos da plataforma HomeCare Match (funcionalidades, planos, pagamentos, conta e fluxos de uso). Se precisar, posso te direcionar para o suporte.";

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
  chatbot_error_message: "Nao consegui responder agora. Tente novamente em instantes ou abra um chamado no suporte.",
  chatbot_max_requests_anon_per_day: 20,
  chatbot_max_requests_auth_per_day: 80,
  chatbot_history_window: 12,
  chatbot_retention_days: 30,
  gemini_model: "gemini-2.0-flash",
};

const HIGH_CONFIDENCE = 0.7;
const MEDIUM_CONFIDENCE = 0.45;

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

const sanitizeAnswer = (value: string) => {
  let text = String(value || "").replace(/\s+\n/g, "\n").trim();
  for (const pattern of CTA_FOOTER_PATTERNS) {
    text = text.replace(pattern, "").trim();
  }
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

const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());

const buildDefaultActions = (isLoggedIn: boolean) => {
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

const buildPlanKnowledgeDocs = (plans: any[]) => {
  const rows = Array.isArray(plans) ? plans : [];

  return rows.map((plan: any, index: number) => {
    const planId = normalizePlanId(plan?.id || "");
    const planName =
      compact(
        String(
          plan?.name ||
            (planId === "yearly" ? "Plano Anual" : planId === "monthly" ? "Plano Mensal" : "Plano de Assinatura"),
        ),
        120,
      ) || "Plano de Assinatura";
    const price = compact(String(plan?.price || ""), 100) || "nao informado";
    const period = compact(String(plan?.period || ""), 80) || "nao informado";
    const description = compact(String(plan?.description || ""), 260);
    const installmentMaxRaw = Number(plan?.asaas_installment_max || 0);
    const installmentMax = Number.isFinite(installmentMaxRaw) && installmentMaxRaw > 0
      ? Math.floor(installmentMaxRaw)
      : planId === "yearly"
      ? 12
      : 1;
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

    const content = [
      `Plano: ${planName}.`,
      `Preco exibido: ${price}.`,
      `Periodo: ${period}.`,
      renewalText,
      fidelityText,
      description ? `Resumo: ${description}.` : "",
      features.length > 0 ? `Beneficios principais: ${features.join(" | ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return buildDocTokens({
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
      ],
      audience: ["professional"],
    });
  });
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

  const intro =
    top.type === "faq"
      ? `Encontrei uma resposta na base de FAQ sobre "${top.title}":`
      : `Sobre "${top.title}", segue o resumo oficial da plataforma:`;

  const related = topDocs
    .slice(1, 3)
    .map((doc) => `- ${doc.title}`)
    .join("\n");

  const greeting = userName ? `Ola, ${userName}. ` : "";
  return `${greeting}${intro}\n\n${compact(top.content, 1200)}${related ? `\n\nTambem pode ajudar:\n${related}` : ""}`;
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
        ].join(","),
      )
      .eq("id", 1)
      .maybeSingle();

    const config = { ...DEFAULTS, ...(siteConfig || {}) };
    const currentOutOfScopeMessage = normalizeText(config.chatbot_out_of_scope_message || "");
    if (
      !currentOutOfScopeMessage ||
      currentOutOfScopeMessage === normalizeText(LEGACY_OUT_OF_SCOPE_MESSAGE) ||
      currentOutOfScopeMessage.includes("apenas sobre funcionalidades da plataforma")
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
    const visitorHash = await sha256Hex([visitorId, forwardedFor, userAgent].join("|"));
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
          suggested_actions: buildDefaultActions(!!userId),
          sources: [],
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
    if (requestedSessionId && isUuidLike(requestedSessionId)) {
      const { data: existingSession } = await supabaseAdmin
        .from("chatbot_sessions")
        .select("id, user_id, visitor_hash")
        .eq("id", requestedSessionId)
        .maybeSingle();

      const isOwner =
        !!existingSession &&
        ((userId && existingSession.user_id === userId) ||
          (!userId && !existingSession.user_id && existingSession.visitor_hash === visitorHash));

      if (isOwner) {
        sessionId = existingSession.id;
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
        .select("id")
        .single();

      if (sessionError || !createdSession?.id) {
        throw new Error(sessionError?.message || "Falha ao criar sessao do chatbot.");
      }
      sessionId = createdSession.id;
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
      ...buildPlanKnowledgeDocs(plans || []),
      ...SUBSCRIPTION_POLICY_DOCS.map((policy) => buildDocTokens(policy)),
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

    const normalizedQuestion = normalizeText(rawMessage);
    const questionTokens = tokenize(rawMessage);
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
    const sourceCandidates = aiContextDocs.length > 0 ? aiContextDocs : topDocs;
    const publicSourceCandidates = topPublicDocs.length > 0 ? topPublicDocs : publicDocs.slice(0, 8);
    const sources = publicSourceCandidates
      .filter((doc) => Number(doc.score || 0) >= 0.08)
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
- Evite incluir URLs/caminhos de tela automaticamente; cite caminhos apenas quando o usuario pedir ou quando for indispensavel para executar o passo.
- Nao inclua chamadas de acao como "Ver FAQ", "Abrir chamado" ou frases equivalentes no corpo da resposta.
- Se houver nome do usuario no contexto, pode usar o nome com naturalidade no inicio da resposta, sem repetir em excesso.

Contexto autorizado:
${context || "(nenhuma fonte especifica encontrada no momento)"}

Contexto do usuario:
Nome: ${userFirstName || "(nao informado)"}
Perfil: ${roleContext || "(nao informado)"}

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

    if (aiFirstEnabled) {
      try {
        const aiAnswer = await runAiAnswer(sourceCandidates);

        if (normalizeText(aiAnswer) === normalizeText(config.chatbot_out_of_scope_message)) {
          mode = "fallback";
          answer = config.chatbot_out_of_scope_message;
          unansweredReason = "ai_out_of_scope";
        } else {
          mode = "ai";
          answer = aiAnswer;
        }
      } catch (_err) {
        mode = "fallback";
        answer = config.chatbot_error_message;
      }
    } else if (config.chatbot_use_ai) {
      if (topPublicScore >= HIGH_CONFIDENCE) {
        mode = "faq";
        answer = buildFaqModeAnswer(rawMessage, topPublicDocs, userFirstName || null);
      } else if (topScore >= MEDIUM_CONFIDENCE) {
        try {
          const aiAnswer = await runAiAnswer(sourceCandidates);
          if (normalizeText(aiAnswer) === normalizeText(config.chatbot_out_of_scope_message)) {
            mode = "fallback";
            answer = config.chatbot_out_of_scope_message;
            unansweredReason = "ai_out_of_scope";
          } else {
            mode = "ai";
            answer = aiAnswer;
          }
        } catch (_err) {
          mode = "fallback";
          answer = config.chatbot_error_message;
        }
      } else {
        mode = "fallback";
        answer = config.chatbot_out_of_scope_message;
        unansweredReason = "low_confidence";
      }
    } else if (topPublicScore >= MEDIUM_CONFIDENCE) {
      mode = "faq";
      answer = buildFaqModeAnswer(rawMessage, topPublicDocs, userFirstName || null);
    } else {
      mode = "fallback";
      answer = config.chatbot_out_of_scope_message;
      unansweredReason = "low_confidence";
    }

    answer = sanitizeAnswer(answer);

    if (!sources.length && topPublicDocs.length > 0) {
      for (const doc of topPublicDocs.slice(0, 2)) {
        sources.push({
          id: doc.id,
          type: doc.type,
          title: doc.title,
          route: doc.route,
          snippet: compact(doc.content, 180),
          score: Number(Number(doc.score || 0).toFixed(3)),
        });
      }
    }

    const suggestedActions = buildDefaultActions(!!userId);

    await supabaseAdmin.from("chatbot_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: answer,
      mode,
      sources,
    });

    await supabaseAdmin
      .from("chatbot_sessions")
      .update({
        last_mode: mode,
        page_path: requestedPagePath,
        role_context: roleContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

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

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        answer,
        sources,
        mode,
        can_open_ticket: !!userId,
        suggested_actions: suggestedActions,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
