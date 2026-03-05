// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASE_URL = "https://www.homecarematch.com.br";
const SEO_TITLE_MIN_CHARS = 30;
const SEO_TITLE_MAX_CHARS = 60;
const SEO_DESCRIPTION_MIN_CHARS = 70;
const SEO_DESCRIPTION_MAX_CHARS = 155;
const SEO_CONTENT_MIN_CHARS = 8000;
const SEO_CONTENT_MAX_CHARS = 12000;

const ALLOWED_FIELDS = new Set([
  "title",
  "slug",
  "excerpt",
  "content_html",
  "focus_keyword",
  "seo_title",
  "seo_description",
  "seo_canonical_url",
  "seo_robots",
  "seo_og_title",
  "seo_og_description",
  "seo_og_image_url",
  "schema_json",
]);

const cleanJsonText = (text: string) =>
  String(text || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const toSlug = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 75);

const compactText = (value: unknown, max = 180) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);

const fitLengthRange = (value: string, min: number, max: number, fallbackPad: string) => {
  const safePad =
    String(fallbackPad || "").trim() || "Conteudo informativo para orientar decisoes com qualidade e seguranca.";
  let text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) text = safePad;
  while (text.length < min) {
    text = `${text} ${safePad}`.replace(/\s+/g, " ").trim();
    if (text.length >= min) break;
  }
  if (text.length > max) return text.slice(0, max).trim();
  return text;
};

const stripHtml = (html: string) =>
  String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const countMatches = (value: string, regex: RegExp) => (String(value || "").match(regex) || []).length;

const sanitizeHtml = (html: string) =>
  String(html || "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .trim();

const escapeHtml = (value: string) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripContentH1Tags = (html: string) =>
  String(html || "")
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeSeoContentHtml = (html: string) => stripContentH1Tags(sanitizeHtml(html || ""));

const FAQ_HEADING_KEYWORDS = ["perguntas frequentes", "duvidas frequentes", "faq"];

const extractFaqSectionData = (html: string) => {
  const source = String(html || "");
  const headingRegex = /<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: Array<{ level: number; start: number; end: number; text: string }> = [];

  let match: RegExpExecArray | null = null;
  while ((match = headingRegex.exec(source))) {
    headings.push({
      level: Number(match[1] || 0),
      start: match.index,
      end: headingRegex.lastIndex,
      text: normalizeText(stripHtml(match[2] || "")),
    });
  }

  const faqHeadingIndex = headings.findIndex((heading) =>
    FAQ_HEADING_KEYWORDS.some((keyword) => heading.text.includes(keyword)),
  );
  if (faqHeadingIndex < 0) return { hasFaqSection: false, faqQuestions: 0 };

  const faqHeading = headings[faqHeadingIndex];
  let sectionEnd = source.length;
  for (let i = faqHeadingIndex + 1; i < headings.length; i += 1) {
    if (headings[i].level <= faqHeading.level) {
      sectionEnd = headings[i].start;
      break;
    }
  }

  const faqBlock = source.slice(faqHeading.end, sectionEnd);
  const headingQuestions = countMatches(faqBlock, /<h([3-6])\b[^>]*>[\s\S]*?<\/h\1>/gi);
  const listQuestions = Array.from(faqBlock.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)).filter((item) =>
    stripHtml(String(item?.[1] || "")).includes("?"),
  ).length;
  const paragraphQuestions = Array.from(faqBlock.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).filter((item) =>
    stripHtml(String(item?.[1] || "")).includes("?"),
  ).length;

  return {
    hasFaqSection: true,
    faqQuestions: headingQuestions || listQuestions || paragraphQuestions,
  };
};

const hasRequiredSeoStructure = (html: string) => {
  const source = String(html || "");
  const h2Count = countMatches(source, /<h2\b/gi);
  const h3Count = countMatches(source, /<h3\b/gi);
  const pCount = countMatches(source, /<p\b/gi);
  const listCount = countMatches(source, /<(ul|ol)\b/gi);
  const faqData = extractFaqSectionData(source);
  return h2Count >= 3 && h3Count >= 3 && pCount >= 10 && listCount >= 1 && faqData.hasFaqSection && faqData.faqQuestions >= 3;
};

const splitIntoParagraphs = (plain: string) => {
  const sentences = String(plain || "").match(/[^.!?]+[.!?]?/g) || [];
  const paragraphs: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const next = `${current} ${sentence}`.trim();
    if (next.length > 520 && current) {
      paragraphs.push(current.trim());
      current = sentence.trim();
    } else {
      current = next;
    }
  }
  if (current.trim()) paragraphs.push(current.trim());
  return paragraphs.filter(Boolean);
};

const buildStructuredHtmlFromPlain = (html: string, context: Record<string, string>) => {
  const plain = stripHtml(html);
  const keyword = compactText(context.focus_keyword || context.title || "home care", 90);
  const paragraphs = splitIntoParagraphs(plain);
  const getPara = (index: number, fallback: string) => escapeHtml(paragraphs[index] || fallback);

  const intro1 =
    getPara(0, `Este conteudo apresenta fundamentos praticos sobre ${keyword} no contexto de Home Care.`) ||
    `Este conteudo apresenta fundamentos praticos sobre ${keyword} no contexto de Home Care.`;
  const intro2 =
    getPara(1, "Ao longo do artigo, voce encontrara orientacoes para melhorar qualidade assistencial e eficiencia operacional.") ||
    "Ao longo do artigo, voce encontrara orientacoes para melhorar qualidade assistencial e eficiencia operacional.";

  return `
<p>${intro1}</p>
<p>${intro2}</p>

<h2 id="sumario">Neste artigo voce vera</h2>
<ul>
  <li><a href="#fundamentos">Fundamentos de ${escapeHtml(keyword)}</a></li>
  <li><a href="#aplicacao">Aplicacao pratica no dia a dia</a></li>
  <li><a href="#conclusao">Conclusao</a></li>
  <li><a href="#faq">Perguntas frequentes</a></li>
</ul>

<h2 id="fundamentos">Fundamentos de ${escapeHtml(keyword)}</h2>
<p>${getPara(2, `A implementacao de ${keyword} exige protocolo claro, comunicacao ativa e monitoramento continuo de resultados.`)}</p>
<p>${getPara(3, "Processos padronizados reduzem variacao de conduta e aumentam previsibilidade da assistencia.")}</p>
<h3>Boas praticas essenciais</h3>
<p>${getPara(4, "Defina papeis, indicadores e rotina de revisao para garantir consistencia na execucao da equipe.")}</p>

<h2 id="aplicacao">Aplicacao pratica no dia a dia</h2>
<p>${getPara(5, "A operacao deve alinhar agenda, registro clinico e comunicacao com pacientes e familiares.")}</p>
<p>${getPara(6, "Acompanhamento frequente e feedback estruturado ajudam a corrigir desvios rapidamente.")}</p>
<h3>Erros comuns e como evitar</h3>
<p>${getPara(7, "As falhas mais comuns incluem ausencia de padrao e baixa rastreabilidade das decisoes assistenciais.")}</p>
<h3>Indicadores para melhoria continua</h3>
<p>${getPara(8, "Monitore adesao ao plano, eventos evitaveis, tempo de resposta e satisfacao da familia.")}</p>

<h2 id="conclusao">Conclusao</h2>
<p>${getPara(9, `Com metodo, acompanhamento e foco no paciente, ${keyword} gera ganhos de qualidade e seguranca.`)}</p>
<p>${getPara(10, "A evolucao consistente depende de revisao periodica de processos e capacitacao continua da equipe.")}</p>

<h2 id="faq">Perguntas frequentes</h2>
<h3>Qual o primeiro passo para melhorar ${escapeHtml(keyword)}?</h3>
<p>O primeiro passo e definir protocolo assistencial claro com metas, responsaveis e revisao recorrente.</p>
<h3>Como garantir qualidade na rotina operacional?</h3>
<p>Use indicadores objetivos, registro estruturado e rituais de acompanhamento com toda a equipe.</p>
<h3>Quais resultados esperar com boa implementacao?</h3>
<p>E esperado maior previsibilidade, reducao de falhas e melhor experiencia para paciente e familia.</p>
`.trim();
};

const adjustContentLengthLocally = (html: string, context: Record<string, string>) => {
  let normalized = normalizeSeoContentHtml(html);
  let plain = stripHtml(normalized);

  if (plain.length < SEO_CONTENT_MIN_CHARS) {
    const keyword = compactText(context.focus_keyword || context.title || "home care", 90);
    const filler =
      `Na pratica, a melhoria continua de ${keyword} depende de protocolos claros, registro estruturado, ` +
      "indicadores de desempenho, comunicacao efetiva da equipe e revisao periodica de condutas assistenciais.";
    let round = 1;
    while (plain.length < SEO_CONTENT_MIN_CHARS && round <= 40) {
      normalized += `<h3>Boas praticas complementares ${round}</h3><p>${escapeHtml(filler)}</p>`;
      plain = stripHtml(normalized);
      round += 1;
    }
  }

  if (plain.length > SEO_CONTENT_MAX_CHARS) {
    const truncated = plain.slice(0, SEO_CONTENT_MAX_CHARS).trim();
    const sentences = truncated.match(/[^.!?]+[.!?]?/g) || [truncated];
    const paragraphs: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      const next = `${current} ${sentence}`.trim();
      if (next.length >= 650 && current) {
        paragraphs.push(current.trim());
        current = sentence.trim();
      } else {
        current = next;
      }
    }
    if (current.trim()) paragraphs.push(current.trim());
    normalized = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  }

  return normalizeSeoContentHtml(normalized);
};

const callGeminiJson = async ({
  apiKey,
  modelName,
  prompt,
}: {
  apiKey: string;
  modelName: string;
  prompt: string;
}) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Falha ao chamar API do Gemini.");
  }

  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Resposta vazia da IA.");
  }

  return JSON.parse(cleanJsonText(rawText));
};

const getSafeExternalUrl = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
};

const buildDefaultCanonicalUrl = (slugLike: string) => {
  const safeSlug = toSlug(slugLike || "");
  return safeSlug ? `${BASE_URL}/blog/artigo/${safeSlug}` : `${BASE_URL}/blog`;
};

const buildDefaultSchemaJson = (context: Record<string, string>) => {
  const title = compactText(context.title || "", 120);
  const slug = toSlug(context.slug || context.title || "");
  const description = compactText(context.seo_description || context.excerpt || "", SEO_DESCRIPTION_MAX_CHARS);
  const keyword = compactText(context.focus_keyword || "", 120);
  return JSON.stringify(
    [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        description,
        keywords: keyword,
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": buildDefaultCanonicalUrl(slug),
        },
      },
    ],
    null,
    2,
  );
};

const buildPrompt = ({
  field,
  currentValue,
  context,
}: {
  field: string;
  currentValue: string;
  context: Record<string, string>;
}) => {
  const rulesByField: Record<string, string> = {
    title: "- Retorne um titulo claro e atrativo (max 120 caracteres).",
    slug: "- Retorne somente slug URL-friendly, sem acentos, em minusculo e com hifens (max 75 caracteres).",
    excerpt: "- Retorne um resumo curto, escaneavel e orientado a SEO (ideal 120-220 caracteres).",
    content_html: `- Retorne HTML completo SEM H1 (o titulo principal fica fora do conteudo), com 3 a 8 H2, H3 quando necessario, conclusao e FAQ. Conteudo entre ${SEO_CONTENT_MIN_CHARS} e ${SEO_CONTENT_MAX_CHARS} caracteres em texto limpo.`,
    focus_keyword: "- Retorne UMA palavra-chave foco principal, objetiva e relevante (max 90 caracteres).",
    seo_title: `- Retorne um SEO title entre ${SEO_TITLE_MIN_CHARS} e ${SEO_TITLE_MAX_CHARS} caracteres, com palavra-chave principal.`,
    seo_description: `- Retorne uma meta description entre ${SEO_DESCRIPTION_MIN_CHARS} e ${SEO_DESCRIPTION_MAX_CHARS} caracteres, com beneficio claro e CTA.`,
    seo_og_title: "- Retorne Open Graph title atrativo (ate 60 caracteres).",
    seo_og_description: "- Retorne Open Graph description concisa (ate 160 caracteres).",
  };

  return `
Voce e um especialista em SEO para blog de Home Care no Brasil.
Otimize apenas o campo solicitado.

Campo alvo: ${field}
Valor atual: ${currentValue || "(vazio)"}

Contexto do artigo:
- titulo: ${context.title || "(vazio)"}
- slug: ${context.slug || "(vazio)"}
- resumo: ${context.excerpt || "(vazio)"}
- palavra-chave foco: ${context.focus_keyword || "(vazio)"}
- seo_title: ${context.seo_title || "(vazio)"}
- seo_description: ${context.seo_description || "(vazio)"}
- canonical: ${context.seo_canonical_url || "(vazio)"}
- og_title: ${context.seo_og_title || "(vazio)"}
- og_description: ${context.seo_og_description || "(vazio)"}
- og_image: ${context.seo_og_image_url || context.cover_image_url || "(vazio)"}
- referencia: ${context.source_reference_url || "(vazio)"}
- conteudo (trecho): ${compactText(stripHtml(context.content_html || ""), 1200) || "(vazio)"}

Regras:
${rulesByField[field] || "- Retorne valor otimizado para SEO."}
- Responda APENAS JSON valido no formato: {"value":"..."}
- Nao inclua markdown.
`.trim();
};

const applyFieldRules = (field: string, rawValue: unknown, context: Record<string, string>) => {
  const value = String(rawValue || "").trim();
  switch (field) {
    case "slug":
      return toSlug(value || context.title || context.focus_keyword || "");
    case "seo_title":
      return fitLengthRange(
        value,
        SEO_TITLE_MIN_CHARS,
        SEO_TITLE_MAX_CHARS,
        String(context.focus_keyword || context.title || "Home Care").trim(),
      );
    case "seo_description":
      return fitLengthRange(
        value,
        SEO_DESCRIPTION_MIN_CHARS,
        SEO_DESCRIPTION_MAX_CHARS,
        String(context.excerpt || "Conteudo informativo para orientar com qualidade e seguranca.").trim(),
      );
    case "seo_og_title":
      return compactText(value, 60);
    case "seo_og_description":
      return compactText(value, 160);
    case "title":
      return compactText(value, 120);
    case "focus_keyword":
      return compactText(value, 90);
    case "excerpt":
      return compactText(value, 220);
    case "content_html":
      return normalizeSeoContentHtml(value);
    default:
      return compactText(value, 240);
  }
};

const ensureSeoContentLength = async ({
  html,
  context,
  apiKey,
  modelName,
}: {
  html: string;
  context: Record<string, string>;
  apiKey: string;
  modelName: string;
}) => {
  let candidate = normalizeSeoContentHtml(html || "");
  let plain = stripHtml(candidate);
  let hasStructure = hasRequiredSeoStructure(candidate);
  const lengthOk = plain.length >= SEO_CONTENT_MIN_CHARS && plain.length <= SEO_CONTENT_MAX_CHARS;
  if (lengthOk && hasStructure) return candidate;

  const adjustPrompt = `
Voce e um editor SEO tecnico.
Ajuste o HTML abaixo para ficar entre ${SEO_CONTENT_MIN_CHARS} e ${SEO_CONTENT_MAX_CHARS} caracteres de texto limpo.

Regras obrigatorias:
- manter SEM H1
- manter estrutura de artigo com H2/H3, conclusao e FAQ
- manter foco no tema original de Home Care
- nao usar markdown

Contexto:
- titulo: ${context.title || "(vazio)"}
- palavra-chave foco: ${context.focus_keyword || "(vazio)"}

Retorne APENAS JSON valido: {"value":"<html ajustado>"}

HTML atual:
${candidate}
`.trim();

  try {
    const adjusted = await callGeminiJson({ apiKey, modelName, prompt: adjustPrompt });
    candidate = normalizeSeoContentHtml(String(adjusted?.value || adjusted?.result || candidate));
    plain = stripHtml(candidate);
    hasStructure = hasRequiredSeoStructure(candidate);
  } catch {
    // fallback local below
  }

  if (!hasStructure) {
    candidate = buildStructuredHtmlFromPlain(candidate || plain, context);
    plain = stripHtml(candidate);
  }

  if (plain.length < SEO_CONTENT_MIN_CHARS || plain.length > SEO_CONTENT_MAX_CHARS) {
    candidate = adjustContentLengthLocally(candidate, context);
    plain = stripHtml(candidate);
  }

  if (!hasRequiredSeoStructure(candidate)) {
    candidate = buildStructuredHtmlFromPlain(candidate || plain, context);
    candidate = adjustContentLengthLocally(candidate, context);
  }

  return normalizeSeoContentHtml(candidate);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Nao autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || (!profile.is_admin && profile.role !== "admin")) {
      return new Response(JSON.stringify({ error: "Somente administradores podem usar a IA de SEO." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const field = String(body?.field || "").trim();
    const currentValue = String(body?.current_value || "").trim();
    const context = typeof body?.context === "object" && body?.context ? body.context : {};

    if (!ALLOWED_FIELDS.has(field)) {
      return new Response(JSON.stringify({ error: "Campo invalido para otimizacao." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (field === "seo_canonical_url") {
      const fallbackCanonical = buildDefaultCanonicalUrl(context.slug || context.title || "");
      const resolved = getSafeExternalUrl(currentValue) || getSafeExternalUrl(context.seo_canonical_url) || fallbackCanonical;
      return new Response(JSON.stringify({ field, value: resolved }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (field === "seo_robots") {
      const allowed = new Set(["index,follow", "index,nofollow", "noindex,follow", "noindex,nofollow"]);
      const raw = compactText(currentValue || context.seo_robots || "", 30).toLowerCase();
      const resolved = allowed.has(raw) ? raw : "index,follow";
      return new Response(JSON.stringify({ field, value: resolved }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (field === "seo_og_image_url") {
      const resolved =
        getSafeExternalUrl(currentValue) ||
        getSafeExternalUrl(context.seo_og_image_url) ||
        getSafeExternalUrl(context.cover_image_url) ||
        "";
      return new Response(JSON.stringify({ field, value: resolved }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (field === "schema_json") {
      const resolved = buildDefaultSchemaJson(context);
      return new Response(JSON.stringify({ field, value: resolved }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY nao configurada no servidor.");
    }

    const { data: siteConfig } = await supabaseAdmin
      .from("site_config")
      .select("gemini_model")
      .eq("id", 1)
      .single();
    const modelName = siteConfig?.gemini_model || "gemini-2.0-flash";

    const prompt = buildPrompt({
      field,
      currentValue,
      context,
    });

    const parsed = await callGeminiJson({
      apiKey: GEMINI_API_KEY,
      modelName,
      prompt,
    });

    let optimizedValue = applyFieldRules(field, parsed?.value || parsed?.result || "", context);
    if (field === "content_html") {
      optimizedValue = await ensureSeoContentLength({
        html: optimizedValue,
        context,
        apiKey: GEMINI_API_KEY,
        modelName,
      });
    }

    if (!optimizedValue) {
      throw new Error("A IA nao retornou valor valido para o campo.");
    }

    return new Response(
      JSON.stringify({
        field,
        value: optimizedValue,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[optimize-blog-seo-field] Erro:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "Erro ao otimizar campo SEO com IA." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

