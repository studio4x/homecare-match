// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_CONTENT_CHARS = 8000;
const MAX_CONTENT_CHARS = 12000;
const TARGET_CONTENT_CHARS = 10000;
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
const SEO_TITLE_MIN_CHARS = 30;
const SEO_TITLE_MAX_CHARS = 60;
const SEO_DESCRIPTION_MIN_CHARS = 70;
const SEO_DESCRIPTION_MAX_CHARS = 155;
const REFERENCE_FETCH_TIMEOUT_MS = 15000;
const REFERENCE_MAX_PROMPT_CHARS = 5000;

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

const compactText = (value: string, max = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const getSafeExternalUrl = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
};

const extractFirstUrlFromText = (value: string) => {
  const text = String(value || "");
  const match = text.match(/https?:\/\/[^\s<>"')]+/i);
  return getSafeExternalUrl(match?.[0] || "");
};

const normalizeComparableUrl = (value: string) => {
  const safe = getSafeExternalUrl(value);
  if (!safe) return "";
  try {
    const parsed = new URL(safe);
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${pathname}`.toLowerCase();
  } catch {
    return "";
  }
};

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

const stripContentH1Tags = (html: string) =>
  String(html || "")
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

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
  if (faqHeadingIndex < 0) {
    return {
      hasFaqSection: false,
      faqQuestions: 0,
      faqQuestionsList: [] as string[],
      faqBlock: "",
    };
  }

  const faqHeading = headings[faqHeadingIndex];
  let sectionEnd = source.length;
  for (let i = faqHeadingIndex + 1; i < headings.length; i += 1) {
    if (headings[i].level <= faqHeading.level) {
      sectionEnd = headings[i].start;
      break;
    }
  }

  const faqBlock = source.slice(faqHeading.end, sectionEnd);
  const questionHeadings = Array.from(faqBlock.matchAll(/<h([3-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi))
    .map((entry) => stripHtml(entry[2] || "").slice(0, 220).trim())
    .filter(Boolean);

  const listQuestions = Array.from(faqBlock.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
    .map((entry) => stripHtml(entry[1] || "").slice(0, 220).trim())
    .filter((question) => question.includes("?"));

  const paragraphQuestions = Array.from(faqBlock.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((entry) => stripHtml(entry[1] || "").slice(0, 220).trim())
    .filter((question) => question.includes("?"));

  const faqQuestionsList =
    questionHeadings.length > 0
      ? questionHeadings
      : listQuestions.length > 0
      ? listQuestions
      : paragraphQuestions;

  return {
    hasFaqSection: true,
    faqQuestions: faqQuestionsList.length,
    faqQuestionsList,
    faqBlock,
  };
};

const VOID_HTML_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const clampContentHtmlByPlainChars = (html: string, maxChars: number) => {
  const safeMax = Math.max(1, Number(maxChars || 0));
  const source = stripContentH1Tags(String(html || ""));
  const originalPlainLength = stripHtml(source).length;

  if (originalPlainLength <= safeMax) {
    return { html: source, chars: originalPlainLength, wasTrimmed: false };
  }

  const tokens = source.split(/(<[^>]+>)/g).filter(Boolean);
  let remaining = safeMax;
  let output = "";
  const openTags: string[] = [];

  for (const token of tokens) {
    if (remaining <= 0) break;

    if (token.startsWith("<")) {
      output += token;

      const closingMatch = token.match(/^<\s*\/\s*([a-zA-Z0-9:-]+)\s*>$/);
      if (closingMatch) {
        const closingTag = String(closingMatch[1] || "").toLowerCase();
        for (let i = openTags.length - 1; i >= 0; i -= 1) {
          if (openTags[i] === closingTag) {
            openTags.splice(i, 1);
            break;
          }
        }
        continue;
      }

      if (token.endsWith("/>")) continue;
      const openingMatch = token.match(/^<\s*([a-zA-Z0-9:-]+)\b[^>]*>$/);
      const openingTag = String(openingMatch?.[1] || "").toLowerCase();
      if (!openingTag || VOID_HTML_TAGS.has(openingTag) || token.startsWith("<!")) continue;
      openTags.push(openingTag);
      continue;
    }

    if (token.length <= remaining) {
      output += token;
      remaining -= token.length;
      continue;
    }

    output += token.slice(0, remaining);
    remaining = 0;
    break;
  }

  for (let i = openTags.length - 1; i >= 0; i -= 1) {
    output += `</${openTags[i]}>`;
  }

  const normalized = stripContentH1Tags(output).trim();
  const normalizedPlainLength = stripHtml(normalized).length;
  return {
    html: normalized,
    chars: normalizedPlainLength,
    wasTrimmed: normalizedPlainLength < originalPlainLength,
  };
};

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
  let text = String(value || "").trim() || String(fallback || "").trim();
  if (!text) return "";
  const padSource = String(fallback || "Conteudo informativo para orientar decisoes com qualidade e seguranca.").trim();
  while (text.length < min) {
    text = `${text} ${padSource}`.replace(/\s+/g, " ").trim();
    if (text.length >= min) break;
  }
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

const fetchReferenceContext = async (referenceUrl: string) => {
  const safeUrl = getSafeExternalUrl(referenceUrl);
  if (!safeUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REFERENCE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(safeUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; HomeCareMatchBot/1.0; +https://www.homecarematch.com.br)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
      },
    });

    if (!response.ok) {
      throw new Error(`Falha ao ler URL de referencia (HTTP ${response.status}).`);
    }

    const rawHtml = await response.text();
    const titleMatch = rawHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescMatch = rawHtml.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
    );

    const title = compactText(stripHtml(titleMatch?.[1] || ""), 180);
    const description = compactText(metaDescMatch?.[1] || "", 300);
    const plainContent = stripHtml(rawHtml);
    const excerpt = compactText(plainContent, REFERENCE_MAX_PROMPT_CHARS);

    if (!excerpt || excerpt.length < 300) {
      throw new Error("A URL de referencia nao possui conteudo textual suficiente.");
    }

    return {
      url: safeUrl,
      title,
      description,
      excerpt,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const ensureReferenceLinkInContent = (html: string, referenceUrl: string, referenceTitle: string) => {
  const safeUrl = getSafeExternalUrl(referenceUrl);
  if (!safeUrl) return stripContentH1Tags(html);

  const normalizedSource = normalizeComparableUrl(safeUrl);
  const existingLinks = extractHrefList(html);
  const hasReferenceLink = existingLinks.some((href) => {
    const normalizedHref = normalizeComparableUrl(href);
    return !!normalizedHref && (normalizedHref === normalizedSource || normalizedHref.startsWith(normalizedSource));
  });

  if (hasReferenceLink) return stripContentH1Tags(html);

  const anchorLabel = compactText(referenceTitle || "fonte de referencia", 120) || "fonte de referencia";
  const sourceBlock =
    `<p><strong>Fonte consultada:</strong> ` +
    `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(anchorLabel)}</a>.</p>`;

  return stripContentH1Tags(`${String(html || "").trim()}\n${sourceBlock}`);
};

const toSeoTitleLength = (value: string, fallback: string) => {
  let text = String(value || "").trim() || String(fallback || "").trim();
  if (!text) return "";
  const suffix = " | HomeCare Match";
  while (text.length < SEO_TITLE_MIN_CHARS) {
    if (text.includes("HomeCare Match")) break;
    text = `${text}${suffix}`;
    if (text.length >= SEO_TITLE_MIN_CHARS) break;
  }
  if (text.length > SEO_TITLE_MAX_CHARS) return text.slice(0, SEO_TITLE_MAX_CHARS).trim();
  return text;
};

const normalizeArticlePayload = (parsed: any) => {
  const title = String(parsed?.title || "").trim();
  const sourceReferenceUrl = getSafeExternalUrl(String(parsed?.source_reference_url || "").trim());
  const sourceReferenceTitle = compactText(String(parsed?.source_reference_title || "").trim(), 180);
  const focusKeyword = String(parsed?.focus_keyword || "").trim() || String(title || "").split(":")[0].trim();
  const normalizedKeywordSlug = toSlug(focusKeyword);
  let slug = toSlug(String(parsed?.slug || title || focusKeyword));
  if (normalizedKeywordSlug && !slug.includes(normalizedKeywordSlug)) {
    slug = toSlug(`${focusKeyword} ${slug}`);
  }
  if (slug.length > MAX_SLUG_LENGTH) slug = slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, "");

  const boundedContent = clampContentHtmlByPlainChars(String(parsed?.content_html || "").trim(), MAX_CONTENT_CHARS);
  const contentHtml = boundedContent.html;
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
    seo_title: toSeoTitleLength(seoTitleRaw, title),
    seo_description: toMetaLength(seoDescriptionRaw, SEO_DESCRIPTION_MIN_CHARS, SEO_DESCRIPTION_MAX_CHARS, excerpt),
    seo_og_title: seoOgTitle,
    seo_og_description: toMetaLength(seoOgDescription, 140, 180, seoDescriptionRaw),
    tags_suggested: tagsSuggested,
    reading_time_minutes: Number(parsed?.reading_time_minutes || 0) || estimateReadingTime(contentHtml),
    source_reference_url: sourceReferenceUrl || null,
    source_reference_title: sourceReferenceTitle || null,
  };
};

const extractFaqQuestions = (html: string) => {
  return extractFaqSectionData(html).faqQuestionsList.slice(0, 5);
};

const buildSchemaJson = (article: any) => {
  const faqQuestions = extractFaqQuestions(article.content_html);
  const faqData = extractFaqSectionData(article.content_html);
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

  if (faqData.hasFaqSection && faqQuestions.length >= 3) {
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
  const sourceReferenceUrl = getSafeExternalUrl(String(article?.source_reference_url || "").trim());

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
  if (h1Count !== 0) issues.push(`content_html nao deve ter H1 (atual: ${h1Count})`);
  if (h2Count < MIN_H2 || h2Count > MAX_H2) issues.push(`H2 fora do intervalo ${MIN_H2}-${MAX_H2} (atual: ${h2Count})`);
  if (h3Count < MIN_H3) issues.push(`deve ter ao menos ${MIN_H3} H3 (atual: ${h3Count})`);

  const faqData = extractFaqSectionData(article.content_html);
  if (!faqData.hasFaqSection) issues.push("secao FAQ/Perguntas Frequentes ausente");
  if (faqData.hasFaqSection && (faqData.faqQuestions < 3 || faqData.faqQuestions > 5)) {
    issues.push(`FAQ deve ter entre 3 e 5 perguntas (atual: ${faqData.faqQuestions})`);
  }

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
  const maxExternalLinksAllowed = sourceReferenceUrl ? MAX_EXTERNAL_LINKS + 1 : MAX_EXTERNAL_LINKS;
  if (externalLinks < MIN_EXTERNAL_LINKS || externalLinks > maxExternalLinksAllowed) {
    issues.push(`links externos fora do intervalo ${MIN_EXTERNAL_LINKS}-${maxExternalLinksAllowed}`);
  }

  if (sourceReferenceUrl) {
    const normalizedSource = normalizeComparableUrl(sourceReferenceUrl);
    const hasReferenceLink = links.some((href) => {
      const normalizedHref = normalizeComparableUrl(href);
      return !!normalizedHref && (normalizedHref === normalizedSource || normalizedHref.startsWith(normalizedSource));
    });
    if (!hasReferenceLink) {
      issues.push("link da fonte de referencia ausente no content_html");
    }
  }

  if (article.slug.length > MAX_SLUG_LENGTH) issues.push(`slug acima de ${MAX_SLUG_LENGTH} caracteres`);

  if (keywordNorm) {
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

  if (article.seo_title.length < SEO_TITLE_MIN_CHARS || article.seo_title.length > SEO_TITLE_MAX_CHARS) {
    issues.push(`seo_title deve ter ${SEO_TITLE_MIN_CHARS}-${SEO_TITLE_MAX_CHARS} caracteres (atual: ${article.seo_title.length})`);
  }
  if (article.seo_description.length < SEO_DESCRIPTION_MIN_CHARS || article.seo_description.length > SEO_DESCRIPTION_MAX_CHARS) {
    issues.push(`seo_description deve ter ${SEO_DESCRIPTION_MIN_CHARS}-${SEO_DESCRIPTION_MAX_CHARS} caracteres (atual: ${article.seo_description.length})`);
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
  let html = stripContentH1Tags(String(base.content_html || ""));
  html = enforceH2Limit(html);
  html = enforceConclusionLength(html, base.focus_keyword);
  html = diluteKeywordDensity(html, base.focus_keyword);
  html = ensureReferenceLinkInContent(html, base.source_reference_url, base.source_reference_title || base.title);
  html = stripContentH1Tags(html);

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

    const requestBody = await req.json();
    const { mode, suggestion, source_reference_url: sourceReferenceUrlRaw } = requestBody || {};
    const normalizedMode = mode === "automatic" ? "automatic" : "suggestion";
    const normalizedSuggestion = String(suggestion || "").trim();
    const explicitSourceReferenceUrl = getSafeExternalUrl(String(sourceReferenceUrlRaw || "").trim());
    const sourceReferenceUrlFromSuggestion = extractFirstUrlFromText(normalizedSuggestion);
    const normalizedSourceReferenceUrl = explicitSourceReferenceUrl || sourceReferenceUrlFromSuggestion;

    if (normalizedMode === "suggestion" && !normalizedSuggestion) {
      return new Response(JSON.stringify({ error: "Informe uma sugestao para gerar o artigo." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (normalizedMode === "suggestion" && !normalizedSourceReferenceUrl) {
      return new Response(
        JSON.stringify({ error: "Informe uma URL de referencia valida para gerar o artigo com base na fonte." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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

    const referenceContext = normalizedSourceReferenceUrl
      ? await fetchReferenceContext(normalizedSourceReferenceUrl)
      : null;

    if (normalizedMode === "suggestion" && !referenceContext) {
      return new Response(
        JSON.stringify({
          error:
            "Nao foi possivel ler o conteudo da URL de referencia. Verifique se o link esta acessivel e tente novamente.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const externalLinkSuggestions = normalizedSourceReferenceUrl
      ? [normalizedSourceReferenceUrl, ...EXTERNAL_LINK_SUGGESTIONS.filter((url) => url !== normalizedSourceReferenceUrl)]
      : EXTERNAL_LINK_SUGGESTIONS;

    const referencePromptBlock = referenceContext
      ? `
Fonte de referencia obrigatoria (base principal do artigo):
- URL: ${referenceContext.url}
- Titulo da fonte: ${referenceContext.title || "(nao informado)"}
- Descricao da fonte: ${referenceContext.description || "(nao informada)"}
- Trecho extraido da fonte:
"""${referenceContext.excerpt}"""

Regra critica:
- O artigo deve ser construido com base no conteudo acima, mantendo aderencia tematica e factual.
- Inclua obrigatoriamente no content_html ao menos um link para a URL da fonte de referencia.
`
      : "";

    const generationPrompt = `
Voce e um redator senior de SEO especializado em saude Home Care.
Siga rigorosamente este padrao de artigo:

- Conteudo com no maximo ${MAX_CONTENT_CHARS} caracteres de texto limpo
- Faixa recomendada: ${MIN_CONTENT_CHARS} a ${MAX_CONTENT_CHARS} caracteres
- Meta ideal de tamanho: ${TARGET_CONTENT_CHARS} caracteres
- Palavra-chave principal com densidade aproximada de ${MIN_KEYWORD_DENSITY}% a ${MAX_KEYWORD_DENSITY}%
- Palavra-chave deve aparecer em: primeiro paragrafo, ao menos 1 H2, conclusao, meta description e slug
- Slug maximo: ${MAX_SLUG_LENGTH} caracteres, sem acento, com hifens
- SEO title: ${SEO_TITLE_MIN_CHARS} a ${SEO_TITLE_MAX_CHARS} caracteres
- Meta description: ${SEO_DESCRIPTION_MIN_CHARS} a ${SEO_DESCRIPTION_MAX_CHARS} caracteres

Estrutura obrigatoria no content_html:
1) Nao incluir H1 (o H1 da pagina vem do titulo do artigo fora do content_html)
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
${externalLinkSuggestions.join("\n")}

Tema:
${topicInstruction}

${referencePromptBlock}

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
  "reading_time_minutes": 1,
  "source_reference_url": "string (URL da fonte principal, quando houver)",
  "source_reference_title": "string (titulo da fonte principal)"
}

Regras adicionais:
- Nao use promessas medicas indevidas
- Use tom profissional, pratico e confiavel
- Paragrafos curtos para boa escaneabilidade
`.trim();

    const generatedRaw = await callGeminiJson({
      apiKey: GEMINI_API_KEY,
      modelName,
      prompt: generationPrompt,
      temperature: 0.55,
    });

    let article = normalizeArticlePayload({
      ...generatedRaw,
      source_reference_url: normalizedSourceReferenceUrl || generatedRaw?.source_reference_url,
      source_reference_title:
        referenceContext?.title || generatedRaw?.source_reference_title || generatedRaw?.source_reference_url || "",
    });
    article = normalizeArticlePayload({
      ...article,
      content_html: ensureReferenceLinkInContent(
        article.content_html,
        article.source_reference_url,
        article.source_reference_title || article.title,
      ),
    });

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
- manter seo_title em ${SEO_TITLE_MIN_CHARS}-${SEO_TITLE_MAX_CHARS} e seo_description em ${SEO_DESCRIPTION_MIN_CHARS}-${SEO_DESCRIPTION_MAX_CHARS}
- nao remover FAQ
- manter o artigo aderente ao tema da fonte de referencia e com link para a URL principal, quando informada

Artigo atual (JSON):
${JSON.stringify(article)}

Retorne APENAS JSON valido com os mesmos campos e com todos os problemas corrigidos.
Lembre-se: conteudo deve ficar entre ${MIN_CONTENT_CHARS} e ${MAX_CONTENT_CHARS} caracteres.
`.trim();

      const repairedRaw = await callGeminiJson({
        apiKey: GEMINI_API_KEY,
        modelName,
        prompt: repairPrompt,
        temperature: 0.35,
      });

      article = normalizeArticlePayload({
        ...repairedRaw,
        source_reference_url: article.source_reference_url || normalizedSourceReferenceUrl,
        source_reference_title:
          article.source_reference_title || referenceContext?.title || repairedRaw?.source_reference_title || "",
      });
      article = normalizeArticlePayload({
        ...article,
        content_html: ensureReferenceLinkInContent(
          article.content_html,
          article.source_reference_url,
          article.source_reference_title || article.title,
        ),
      });

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
