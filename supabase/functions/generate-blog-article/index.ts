// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_CONTENT_CHARS = 3000;
const MAX_CONTENT_CHARS = 8000;
const TARGET_CONTENT_CHARS = 6500;
const MIN_H2 = 3;
const MAX_H2 = 8;
const MIN_H3 = 3;
const MIN_INTERNAL_LINKS = 3;
const MIN_EXTERNAL_LINKS = 2;
const MAX_EXTERNAL_LINKS = 3;
const MIN_INTRO_CHARS = 500;
const MAX_INTRO_CHARS = 800;
const MIN_CONCLUSION_CHARS = 400;
const MAX_CONCLUSION_CHARS = 700;
const MIN_KEYWORD_DENSITY = 0.8;
const MAX_KEYWORD_DENSITY = 1.5;
const MAX_SLUG_LENGTH = 75;

const INTERNAL_LINK_SUGGESTIONS = [
  "/",
  "/buscar",
  "/empresas",
  "/familias",
  "/funcionalidades",
  "/blog",
];

const EXTERNAL_LINK_SUGGESTIONS = [
  "https://www.gov.br/saude/pt-br",
  "https://www.who.int/health-topics/home-care",
  "https://scholar.google.com/",
];

const cleanJsonText = (text: string) =>
  String(text || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

const toSlug = (text: string) =>
  String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .replace(/-+$/, "")
    .trim();

const normalizeText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (value: string) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripHtml = (html: string) =>
  String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const estimateReadingTime = (html: string) => {
  const plain = stripHtml(html);
  const words = plain ? plain.split(" ").filter(Boolean).length : 0;
  return Math.max(1, Math.ceil(words / 220));
};

const countMatches = (value: string, regex: RegExp) => (String(value || "").match(regex) || []).length;

const extractFirstParagraphText = (html: string) => {
  const match = String(html || "").match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return match ? stripHtml(match[1]) : "";
};

const extractSectionText = (html: string, sectionKeyword: string) => {
  const lowerKeyword = normalizeText(sectionKeyword);
  const sections = String(html || "").split(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi);
  const headings = String(html || "").match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi) || [];

  for (let i = 0; i < headings.length; i += 1) {
    const headingText = stripHtml(headings[i]);
    if (normalizeText(headingText).includes(lowerKeyword)) {
      return stripHtml(sections[i + 1] || "");
    }
  }
  return "";
};

const extractHrefList = (html: string) => {
  const links: string[] = [];
  const regex = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(String(html || "")))) {
    links.push(String(match[1] || "").trim());
  }
  return links.filter(Boolean);
};

const isInternalLink = (href: string) => {
  const value = String(href || "").trim().toLowerCase();
  if (!value) return false;
  if (value.startsWith("#")) return true;
  if (value.startsWith("/")) return true;
  return value.includes("homecarematch.com.br");
};

const isExternalLink = (href: string) => {
  const value = String(href || "").trim().toLowerCase();
  if (!value.startsWith("http://") && !value.startsWith("https://")) return false;
  return !value.includes("homecarematch.com.br");
};

const countKeywordOccurrences = (text: string, keyword: string) => {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedText || !normalizedKeyword) return 0;
  const pattern = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, "gi");
  const matches = normalizedText.match(pattern);
  return matches ? matches.length : 0;
};

const toMetaLength = (value: string, min: number, max: number, fallback: string) => {
  const text = String(value || "").trim() || String(fallback || "").trim();
  if (!text) return "";
  if (text.length > max) return text.slice(0, max).trim();
  return text;
};

const escapeHtml = (value: string) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeArticlePayload = (parsed: any) => {
  const title = String(parsed?.title || "").trim();
  const focusKeyword = String(parsed?.focus_keyword || "").trim() || String(title || "").split(":")[0].trim();
  const normalizedKeywordSlug = toSlug(focusKeyword);
  let slug = toSlug(String(parsed?.slug || title || focusKeyword));
  if (normalizedKeywordSlug && !slug.includes(normalizedKeywordSlug)) {
    slug = toSlug(`${focusKeyword} ${slug}`);
  }
  if (slug.length > MAX_SLUG_LENGTH) slug = slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");

  const contentHtml = String(parsed?.content_html || "").trim();
  const plainContent = stripHtml(contentHtml);
  const excerpt = String(parsed?.excerpt || "").trim() || plainContent.slice(0, 180).trim();
  const seoTitleRaw = String(parsed?.seo_title || title).trim() || title;
  const seoDescriptionRaw = String(parsed?.seo_description || excerpt).trim() || excerpt;
  const seoOgTitle = String(parsed?.seo_og_title || seoTitleRaw).trim() || seoTitleRaw;
  const seoOgDescription = String(parsed?.seo_og_description || seoDescriptionRaw).trim() || seoDescriptionRaw;
  const tagsSuggested = Array.isArray(parsed?.tags_suggested)
    ? parsed.tags_suggested.map((item: unknown) => String(item || "").trim()).filter(Boolean).slice(0, 8)
    : [];

  return {
    title,
    slug,
    excerpt: excerpt.slice(0, 180),
    content_html: contentHtml,
    focus_keyword: focusKeyword,
    seo_title: seoTitleRaw,
    seo_description: toMetaLength(seoDescriptionRaw, 140, 160, excerpt),
    seo_og_title: seoOgTitle,
    seo_og_description: toMetaLength(seoOgDescription, 140, 180, seoDescriptionRaw),
    tags_suggested: tagsSuggested,
    reading_time_minutes: Number(parsed?.reading_time_minutes || 0) || estimateReadingTime(contentHtml),
  };
};

const extractFaqQuestions = (html: string) => {
  const result: string[] = [];
  const regex = /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(String(html || "")))) {
    const question = stripHtml(match[1]);
    if (!question) continue;
    result.push(question.slice(0, 220));
    if (result.length >= 5) break;
  }
  return result;
};

const buildSchemaJson = (article: any) => {
  const faqQuestions = extractFaqQuestions(article.content_html);
  const schemas: any[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description: article.seo_description || article.excerpt,
      keywords: article.focus_keyword,
      wordCount: stripHtml(article.content_html).split(/\s+/).filter(Boolean).length,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `https://www.homecarematch.com.br/blog/artigo/${article.slug}`,
      },
    },
  ];

  const hasFaqHeading = /<h2\b[^>]*>[\s\S]*?(perguntas frequentes|faq)[\s\S]*?<\/h2>/i.test(article.content_html);
  if (hasFaqHeading && faqQuestions.length >= 3) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqQuestions.map((question) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Resposta detalhada disponivel no conteudo do artigo.",
        },
      })),
    });
  }

  return schemas;
};

const validateArticleSeoRules = (article: any) => {
  const issues: string[] = [];
  const plain = stripHtml(article.content_html);
  const keyword = String(article.focus_keyword || "").trim();
  const keywordNorm = normalizeText(keyword);
  const slugKeyword = toSlug(keyword);

  if (!article.title) issues.push("title ausente");
  if (!article.slug) issues.push("slug ausente");
  if (!article.content_html) issues.push("content_html ausente");

  if (plain.length < MIN_CONTENT_CHARS) {
    issues.push(`conteudo abaixo do minimo (${plain.length} < ${MIN_CONTENT_CHARS} caracteres)`);
  }
  if (plain.length > MAX_CONTENT_CHARS) {
    issues.push(`conteudo acima do maximo (${plain.length} > ${MAX_CONTENT_CHARS} caracteres)`);
  }

  const h1Count = countMatches(article.content_html, /<h1\b/gi);
  const h2Count = countMatches(article.content_html, /<h2\b/gi);
  const h3Count = countMatches(article.content_html, /<h3\b/gi);
  if (h1Count !== 1) issues.push(`deve ter exatamente 1 H1 (atual: ${h1Count})`);
  if (h2Count < MIN_H2 || h2Count > MAX_H2) issues.push(`H2 fora do intervalo ${MIN_H2}-${MAX_H2} (atual: ${h2Count})`);
  if (h3Count < MIN_H3) issues.push(`deve ter ao menos ${MIN_H3} H3 (atual: ${h3Count})`);

  const faqHeading = /<h2\b[^>]*>[\s\S]*?(perguntas frequentes|faq)[\s\S]*?<\/h2>/i.test(article.content_html);
  if (!faqHeading) issues.push("secao FAQ/Perguntas Frequentes ausente");

  const introText = extractFirstParagraphText(article.content_html);
  if (introText.length < MIN_INTRO_CHARS || introText.length > MAX_INTRO_CHARS) {
    issues.push(`introducao deve ter ${MIN_INTRO_CHARS}-${MAX_INTRO_CHARS} caracteres (atual: ${introText.length})`);
  }

  const conclusionText = extractSectionText(article.content_html, "conclusao");
  if (
    conclusionText &&
    (conclusionText.length < MIN_CONCLUSION_CHARS || conclusionText.length > MAX_CONCLUSION_CHARS)
  ) {
    issues.push(
      `conclusao deve ter ${MIN_CONCLUSION_CHARS}-${MAX_CONCLUSION_CHARS} caracteres (atual: ${conclusionText.length})`,
    );
  }

  const tocAnchors = countMatches(article.content_html, /href\s*=\s*["']#[^"']+["']/gi);
  if (tocAnchors < 4) issues.push("sumario clicavel insuficiente (minimo 4 links internos de ancora)");

  const links = extractHrefList(article.content_html);
  const internalLinks = links.filter(isInternalLink).length;
  const externalLinks = links.filter(isExternalLink).length;
  if (internalLinks < MIN_INTERNAL_LINKS) issues.push(`deve ter ao menos ${MIN_INTERNAL_LINKS} links internos`);
  if (externalLinks < MIN_EXTERNAL_LINKS || externalLinks > MAX_EXTERNAL_LINKS) {
    issues.push(`links externos fora do intervalo ${MIN_EXTERNAL_LINKS}-${MAX_EXTERNAL_LINKS}`);
  }

  if (article.slug.length > MAX_SLUG_LENGTH) issues.push(`slug acima de ${MAX_SLUG_LENGTH} caracteres`);

  if (keywordNorm) {
    const h1TextMatch = String(article.content_html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    const h1Text = normalizeText(h1TextMatch ? stripHtml(h1TextMatch[1]) : "");
    if (!h1Text.includes(keywordNorm)) issues.push("palavra-chave principal ausente no H1");

    const firstParagraphNorm = normalizeText(introText);
    if (!firstParagraphNorm.includes(keywordNorm)) issues.push("palavra-chave principal ausente no primeiro paragrafo");

    const h2Headings = String(article.content_html).match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi) || [];
    const hasKeywordInH2 = h2Headings.some((heading) => normalizeText(stripHtml(heading)).includes(keywordNorm));
    if (!hasKeywordInH2) issues.push("palavra-chave principal ausente em pelo menos um H2");

    if (conclusionText && !normalizeText(conclusionText).includes(keywordNorm)) {
      issues.push("palavra-chave principal ausente na conclusao");
    }

    if (slugKeyword && !article.slug.includes(slugKeyword)) {
      issues.push("slug sem a palavra-chave principal");
    }

    const seoDescriptionNorm = normalizeText(article.seo_description);
    if (!seoDescriptionNorm.includes(keywordNorm)) {
      issues.push("meta description sem palavra-chave principal");
    }

    const seoTitleNorm = normalizeText(article.seo_title);
    if (!seoTitleNorm.includes(keywordNorm)) {
      issues.push("seo title sem palavra-chave principal");
    }

    const occurrences = countKeywordOccurrences(plain, keyword);
    const words = normalizeText(plain).split(" ").filter(Boolean).length || 1;
    const density = (occurrences / words) * 100;
    if (density < MIN_KEYWORD_DENSITY || density > MAX_KEYWORD_DENSITY) {
      issues.push(
        `densidade da palavra-chave fora de ${MIN_KEYWORD_DENSITY}%-${MAX_KEYWORD_DENSITY}% (atual: ${density.toFixed(
          2,
        )}%)`,
      );
    }
  } else {
    issues.push("focus_keyword ausente");
  }

  if (article.seo_title.length < 50 || article.seo_title.length > 60) {
    issues.push(`seo_title deve ter 50-60 caracteres (atual: ${article.seo_title.length})`);
  }
  if (article.seo_description.length < 140 || article.seo_description.length > 160) {
    issues.push(`seo_description deve ter 140-160 caracteres (atual: ${article.seo_description.length})`);
  }

  if (!Array.isArray(article.tags_suggested) || article.tags_suggested.length < 4 || article.tags_suggested.length > 8) {
    issues.push("tags_suggested deve conter de 4 a 8 tags");
  }

  return issues;
};

const enforceH2Limit = (html: string) => {
  const source = String(html || "");
  const regex = /<h2(\b[^>]*)>([\s\S]*?)<\/h2>/gi;
  const matches: Array<{
    index: number;
    full: string;
    attrs: string;
    inner: string;
  }> = [];

  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(source))) {
    matches.push({
      index: match.index,
      full: match[0],
      attrs: String(match[1] || ""),
      inner: String(match[2] || ""),
    });
  }

  if (matches.length <= MAX_H2) return source;

  const keep = new Set<number>(Array.from({ length: Math.min(MAX_H2, matches.length) }, (_, i) => i));
  const faqIndex = matches.findIndex((item) => {
    const headingText = normalizeText(stripHtml(item.full));
    return headingText.includes("perguntas frequentes") || headingText.includes("faq");
  });

  if (faqIndex >= 0 && !keep.has(faqIndex) && keep.size > 0) {
    const lastKept = Array.from(keep).sort((a, b) => a - b)[keep.size - 1];
    keep.delete(lastKept);
    keep.add(faqIndex);
  }

  let rebuilt = "";
  let cursor = 0;
  matches.forEach((item, idx) => {
    rebuilt += source.slice(cursor, item.index);
    if (keep.has(idx)) {
      rebuilt += item.full;
    } else {
      rebuilt += `<h3${item.attrs}>${item.inner}</h3>`;
    }
    cursor = item.index + item.full.length;
  });
  rebuilt += source.slice(cursor);
  return rebuilt;
};

const enforceConclusionLength = (html: string, keyword: string) => {
  const source = String(html || "");
  const h2Regex = /<h2\b[^>]*>[\s\S]*?<\/h2>/gi;
  const headings: Array<{ index: number; full: string }> = [];
  let match: RegExpExecArray | null = null;
  while ((match = h2Regex.exec(source))) {
    headings.push({ index: match.index, full: match[0] });
  }
  if (!headings.length) return source;

  const conclusionHeadingIndex = headings.findIndex((item) =>
    normalizeText(stripHtml(item.full)).includes("conclusao"),
  );
  if (conclusionHeadingIndex < 0) return source;

  const heading = headings[conclusionHeadingIndex];
  const sectionStart = heading.index + heading.full.length;
  const nextHeading = headings[conclusionHeadingIndex + 1];
  const sectionEnd = nextHeading ? nextHeading.index : source.length;
  const sectionHtml = source.slice(sectionStart, sectionEnd);
  const sectionPlain = stripHtml(sectionHtml);

  if (sectionPlain.length >= MIN_CONCLUSION_CHARS && sectionPlain.length <= MAX_CONCLUSION_CHARS) {
    return source;
  }

  let fixedText = sectionPlain;
  if (fixedText.length > MAX_CONCLUSION_CHARS) {
    fixedText = fixedText.slice(0, MAX_CONCLUSION_CHARS).trim();
  }
  if (fixedText.length < MIN_CONCLUSION_CHARS) {
    const padSentence =
      " Na pratica, a execucao consistente, o registro estruturado e a comunicacao entre equipe e familia elevam a qualidade assistencial.";
    while (fixedText.length < MIN_CONCLUSION_CHARS) {
      fixedText += padSentence;
      if (fixedText.length > MAX_CONCLUSION_CHARS) break;
    }
  }

  const keywordNorm = normalizeText(keyword || "");
  if (keywordNorm && !normalizeText(fixedText).includes(keywordNorm)) {
    fixedText += ` ${String(keyword || "").trim()}.`;
  }
  if (fixedText.length > MAX_CONCLUSION_CHARS) {
    fixedText = fixedText.slice(0, MAX_CONCLUSION_CHARS).trim();
  }

  const replacement = `<p>${escapeHtml(fixedText)}</p>`;
  return `${source.slice(0, sectionStart)}${replacement}${source.slice(sectionEnd)}`;
};

const buildNeutralSeoFiller = (requiredWords: number) => {
  const baseSentence =
    "Para ampliar resultados de forma sustentavel, vale revisar processos, reforcar protocolos, padronizar registros, acompanhar indicadores, alinhar responsabilidades e manter comunicacao clara com toda a equipe e com os familiares.";
  const wordsPerSentence = baseSentence.split(/\s+/).filter(Boolean).length || 1;
  const repeats = Math.max(2, Math.ceil((requiredWords + 40) / wordsPerSentence));
  return Array.from({ length: repeats }, () => baseSentence).join(" ");
};

const diluteKeywordDensity = (html: string, keyword: string) => {
  const source = String(html || "");
  const key = String(keyword || "").trim();
  if (!key) return source;

  const plain = stripHtml(source);
  const words = normalizeText(plain).split(" ").filter(Boolean).length || 1;
  const occurrences = countKeywordOccurrences(plain, key);
  if (!occurrences) return source;

  const density = (occurrences / words) * 100;
  if (density <= MAX_KEYWORD_DENSITY) return source;

  const targetWords = Math.ceil((occurrences * 100) / (MAX_KEYWORD_DENSITY - 0.05));
  const neededWords = Math.max(120, targetWords - words);
  const filler = buildNeutralSeoFiller(neededWords);
  const fillerBlock = `<h3>Boas praticas operacionais complementares</h3><p>${escapeHtml(filler)}</p>`;

  const faqMatch = /<h2\b[^>]*>[\s\S]*?(perguntas frequentes|faq)[\s\S]*?<\/h2>/i.exec(source);
  if (faqMatch && typeof faqMatch.index === "number") {
    return `${source.slice(0, faqMatch.index)}${fillerBlock}${source.slice(faqMatch.index)}`;
  }

  return `${source}${fillerBlock}`;
};

const applyLocalSeoCorrections = (article: any) => {
  const base = { ...article };
  let html = String(base.content_html || "");
  html = enforceH2Limit(html);
  html = enforceConclusionLength(html, base.focus_keyword);
  html = diluteKeywordDensity(html, base.focus_keyword);

  return normalizeArticlePayload({
    ...base,
    content_html: html,
    reading_time_minutes: estimateReadingTime(html),
  });
};

const callGeminiJson = async ({
  apiKey,
  modelName,
  prompt,
  temperature = 0.6,
}: {
  apiKey: string;
  modelName: string;
  prompt: string;
  temperature?: number;
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
          temperature,
        },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Falha ao chamar API do Gemini.");
  }

  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Resposta vazia da IA.");
  return JSON.parse(cleanJsonText(rawText));
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
      return new Response(JSON.stringify({ error: "Somente administradores podem gerar artigos com IA." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mode, suggestion } = await req.json();
    const normalizedMode = mode === "automatic" ? "automatic" : "suggestion";
    const normalizedSuggestion = String(suggestion || "").trim();

    if (normalizedMode === "suggestion" && !normalizedSuggestion) {
      return new Response(JSON.stringify({ error: "Informe uma sugestao para gerar o artigo." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: config } = await supabaseAdmin
      .from("site_config")
      .select("gemini_model")
      .eq("id", 1)
      .single();

    const modelName = config?.gemini_model || "gemini-2.0-flash";
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY nao configurada no servidor.");
    }

    const topicInstruction =
      normalizedMode === "automatic"
        ? "Escolha um tema estrategico e atual para Home Care no Brasil, com foco em valor pratico para profissionais, empresas e familias."
        : `Tema sugerido pelo usuario: ${normalizedSuggestion}`;

    const generationPrompt = `
Voce e um redator senior de SEO especializado em saude Home Care.
Siga rigorosamente este padrao de artigo:

- Conteudo com no maximo ${MAX_CONTENT_CHARS} caracteres de texto limpo
- Faixa recomendada: ${MIN_CONTENT_CHARS} a ${MAX_CONTENT_CHARS} caracteres
- Meta ideal de tamanho: ${TARGET_CONTENT_CHARS} caracteres
- Palavra-chave principal com densidade aproximada de ${MIN_KEYWORD_DENSITY}% a ${MAX_KEYWORD_DENSITY}%
- Palavra-chave deve aparecer em: H1, primeiro paragrafo, ao menos 1 H2, conclusao, meta description e slug
- Slug maximo: ${MAX_SLUG_LENGTH} caracteres, sem acento, com hifens
- SEO title: 50 a 60 caracteres
- Meta description: 140 a 160 caracteres

Estrutura obrigatoria no content_html:
1) Um unico H1
2) Introducao (500-800 caracteres)
3) Sumario clicavel com ancora
4) Entre ${MIN_H2} e ${MAX_H2} H2
5) Pelo menos ${MIN_H3} H3
6) Conclusao (400-700 caracteres)
7) FAQ com 3 a 5 perguntas (H2 FAQ + H3 para perguntas)
8) Inserir listas e exemplos praticos
9) Inserir no minimo ${MIN_INTERNAL_LINKS} links internos
10) Inserir ${MIN_EXTERNAL_LINKS} a ${MAX_EXTERNAL_LINKS} links externos de autoridade

Sugestoes de links internos (use pelo menos 3 no artigo):
${INTERNAL_LINK_SUGGESTIONS.join("\n")}

Sugestoes de links externos de referencia (use 2 a 3):
${EXTERNAL_LINK_SUGGESTIONS.join("\n")}

Tema:
${topicInstruction}

Retorne APENAS JSON valido, sem markdown:
{
  "title": "string",
  "slug": "string",
  "excerpt": "string curta ate 180 caracteres",
  "content_html": "string em HTML sem script",
  "focus_keyword": "string",
  "seo_title": "string",
  "seo_description": "string",
  "seo_og_title": "string",
  "seo_og_description": "string",
  "tags_suggested": ["string", "string"],
  "reading_time_minutes": 1
}

Regras adicionais:
- Nao use promessas medicas indevidas
- Use tom profissional, pratico e confiavel
- Paragrafos curtos para boa escaneabilidade
`.trim();

    let article = normalizeArticlePayload(
      await callGeminiJson({
        apiKey: GEMINI_API_KEY,
        modelName,
        prompt: generationPrompt,
        temperature: 0.55,
      }),
    );

    const MAX_REPAIR_ATTEMPTS = 2;
    let issues = validateArticleSeoRules(article);

    for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS && issues.length > 0; attempt += 1) {
      article = applyLocalSeoCorrections(article);
      issues = validateArticleSeoRules(article);
      if (!issues.length) break;

      const repairPrompt = `
Voce deve corrigir um artigo JSON para cumprir padrao SEO estrito.
NAO resuma. EXPANDA ou AJUSTE a estrutura quando necessario.

Problemas detectados:
${issues.map((issue, index) => `${index + 1}. ${issue}`).join("\n")}

Regras criticas:
- manter H2 no intervalo ${MIN_H2}-${MAX_H2}
- manter conclusao entre ${MIN_CONCLUSION_CHARS}-${MAX_CONCLUSION_CHARS} caracteres
- manter densidade da palavra-chave em ${MIN_KEYWORD_DENSITY}%-${MAX_KEYWORD_DENSITY}%
- manter seo_title em 50-60 e seo_description em 140-160
- nao remover FAQ

Artigo atual (JSON):
${JSON.stringify(article)}

Retorne APENAS JSON valido com os mesmos campos e com todos os problemas corrigidos.
Lembre-se: conteudo deve ficar entre ${MIN_CONTENT_CHARS} e ${MAX_CONTENT_CHARS} caracteres.
`.trim();

      article = normalizeArticlePayload(
        await callGeminiJson({
          apiKey: GEMINI_API_KEY,
          modelName,
          prompt: repairPrompt,
          temperature: 0.35,
        }),
      );

      issues = validateArticleSeoRules(article);
    }

    const seoValidationPassed = issues.length === 0;
    if (!seoValidationPassed) {
      console.warn("[generate-blog-article] Artigo gerado com pendencias SEO residuais:", issues.slice(0, 10));
    }

    const schemaJson = buildSchemaJson(article);

    return new Response(
      JSON.stringify({
        ...article,
        schema_json: schemaJson,
        seo_validation_passed: seoValidationPassed,
        seo_issues: issues,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[generate-blog-article] Erro:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "Erro ao gerar artigo com IA." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
