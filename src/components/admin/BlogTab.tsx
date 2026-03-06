"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { estimateReadingTime, generateSlug } from "@/lib/blog";
import {
  Bot,
  Database,
  Edit2,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

type BlogSeoForm = {
  seo_title: string;
  seo_description: string;
  seo_canonical_url: string;
  seo_robots: string;
  seo_og_title: string;
  seo_og_description: string;
  seo_og_image_url: string;
  schema_json: string;
};

type BlogCategoryForm = {
  id?: string | null;
  name: string;
  slug: string;
  parent_id: string;
  description: string;
} & BlogSeoForm;

type BlogTagForm = {
  id?: string | null;
  name: string;
  slug: string;
  description: string;
} & BlogSeoForm;

type BlogArticleForm = {
  id?: string | null;
  title: string;
  slug: string;
  excerpt: string;
  source_reference_url: string;
  cover_image_url: string;
  content_html: string;
  status: "draft" | "published";
  published_at: string;
  author_name: string;
  reading_time_minutes: number;
  featured: boolean;
  category_id: string;
  tag_ids: string[];
  focus_keyword: string;
} & BlogSeoForm;

type CoverCandidate = {
  cover_image_url: string;
  alt_text?: string;
  query_used?: string;
  provider?: string;
  photographer?: string | null;
  photographer_url?: string | null;
  source_page?: string | null;
};

type BlogResearchResult = {
  id: string;
  title: string;
  url: string;
  summary?: string;
  source?: string;
  source_url?: string | null;
  published_at?: string | null;
  provider?: string;
};

type BlogResearchTheme = {
  id: string;
  label: string;
  description: string;
  queries: string[];
};

const BLOG_RESEARCH_DEFAULT_THEMES: BlogResearchTheme[] = [
  {
    id: "homecare_idosos",
    label: "Cuidados domiciliares para idosos",
    description: "Tendencias, boas praticas e noticias sobre assistencia ao idoso em casa.",
    queries: [
      "cuidados domiciliares para idosos",
      "atendimento home care para idosos no brasil",
      "boas praticas de cuidado ao idoso em casa",
    ],
  },
  {
    id: "enfermagem_domiciliar",
    label: "Enfermagem domiciliar e protocolos",
    description: "Protocolos, tecnicas e melhorias para equipes de enfermagem no atendimento domiciliar.",
    queries: [
      "protocolos de enfermagem domiciliar",
      "seguranca do paciente em home care enfermagem",
      "boas praticas de enfermagem em atendimento domiciliar",
    ],
  },
  {
    id: "gestao_homecare",
    label: "Gestao e operacao em Home Care",
    description: "Eficiência operacional, escala, qualidade e gestao de equipes assistenciais.",
    queries: [
      "gestao operacional em home care",
      "indicadores de qualidade no atendimento domiciliar",
      "escala e produtividade em empresas de home care",
    ],
  },
  {
    id: "saude_digital",
    label: "Saude digital e telemedicina",
    description: "Inovacoes em monitoramento remoto, teleatendimento e tecnologia em saude.",
    queries: [
      "telemedicina no atendimento domiciliar",
      "monitoramento remoto de pacientes em home care",
      "tecnologia para cuidado domiciliar em saude",
    ],
  },
  {
    id: "seguranca_paciente",
    label: "Seguranca do paciente",
    description: "Prevencao de riscos, qualidade assistencial e seguranca em atendimentos a saude.",
    queries: [
      "seguranca do paciente em atendimento domiciliar",
      "prevencao de eventos adversos em home care",
      "qualidade assistencial em cuidados domiciliares",
    ],
  },
  {
    id: "cuidador_familiar",
    label: "Capacitacao de cuidadores familiares",
    description: "Temas de orientacao, treinamento e suporte para familiares que cuidam em casa.",
    queries: [
      "capacitacao para cuidador familiar em casa",
      "orientacoes para familiares no cuidado de pacientes",
      "educacao em saude para cuidadores domiciliares",
    ],
  },
  {
    id: "doencas_cronicas",
    label: "Manejo de doencas cronicas em casa",
    description: "Cuidados continuados para pacientes com condicoes cronicas no ambiente domiciliar.",
    queries: [
      "manejo de doencas cronicas no atendimento domiciliar",
      "cuidado continuo para pacientes cronicos em casa",
      "boas praticas home care para condicoes cronicas",
    ],
  },
  {
    id: "reabilitacao_domiciliar",
    label: "Reabilitacao e fisioterapia domiciliar",
    description: "Estrategias de reabilitacao funcional e recuperacao com equipes multidisciplinares.",
    queries: [
      "reabilitacao funcional em domicilio",
      "fisioterapia domiciliar para idosos e adultos",
      "equipe multidisciplinar em reabilitacao home care",
    ],
  },
  {
    id: "cuidados_paliativos",
    label: "Cuidados paliativos em domicilio",
    description: "Abordagens humanizadas para conforto, controle de sintomas e suporte familiar.",
    queries: [
      "cuidados paliativos no domicilio",
      "controle de sintomas em pacientes paliativos em casa",
      "suporte familiar em cuidados paliativos home care",
    ],
  },
  {
    id: "saude_mental_cuidado",
    label: "Saude mental de pacientes e cuidadores",
    description: "Bem-estar emocional, prevencao de sobrecarga e estrategias de apoio psicossocial.",
    queries: [
      "saude mental de cuidadores domiciliares",
      "apoio emocional para pacientes em home care",
      "prevencao de sobrecarga no cuidado domiciliar",
    ],
  },
];

const emptySeoForm: BlogSeoForm = {
  seo_title: "",
  seo_description: "",
  seo_canonical_url: "",
  seo_robots: "index,follow",
  seo_og_title: "",
  seo_og_description: "",
  seo_og_image_url: "",
  schema_json: "{}",
};

const emptyCategoryForm: BlogCategoryForm = {
  id: null,
  name: "",
  slug: "",
  parent_id: "",
  description: "",
  ...emptySeoForm,
};

const emptyTagForm: BlogTagForm = {
  id: null,
  name: "",
  slug: "",
  description: "",
  ...emptySeoForm,
};

const emptyArticleForm: BlogArticleForm = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  source_reference_url: "",
  cover_image_url: "",
  content_html: "",
  status: "draft",
  published_at: "",
  author_name: "Equipe HomeCare Match",
  reading_time_minutes: 1,
  featured: false,
  category_id: "",
  tag_ids: [],
  focus_keyword: "",
  ...emptySeoForm,
};

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

const extractFirstExternalUrlFromText = (value: string) => {
  const source = String(value || "");
  const matches = source.match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  for (const candidate of matches) {
    const safe = getSafeExternalUrl(candidate);
    if (safe) return safe;
  }
  return "";
};

const escapeHtml = (value: string) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeLooseText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseSeedTextToHtml = (seedText: string) => {
  const source = String(seedText || "").trim();
  if (!source) return "";

  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(source);
  if (hasHtml) return stripContentH1Tags(source);

  const normalized = source.replace(/\r\n/g, "\n").trim();
  const blocks = normalized
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  const htmlBlocks = blocks.map((block) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return "";

    const headingMatch = lines[0].match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = Math.min(6, Math.max(2, headingMatch[1].length));
      const headingText = escapeHtml(headingMatch[2].trim());
      const rest = lines.slice(1).join(" ");
      if (!rest) return `<h${level}>${headingText}</h${level}>`;
      return `<h${level}>${headingText}</h${level}><p>${escapeHtml(rest)}</p>`;
    }

    const unorderedItems = lines
      .map((line) => line.match(/^(?:[-*•]\s+)(.+)$/)?.[1]?.trim() || "")
      .filter(Boolean);
    if (unorderedItems.length === lines.length) {
      return `<ul>${unorderedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
    }

    const orderedItems = lines
      .map((line) => line.match(/^\d+[.)]\s+(.+)$/)?.[1]?.trim() || "")
      .filter(Boolean);
    if (orderedItems.length === lines.length) {
      return `<ol>${orderedItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
    }

    const headingLine = lines[0].replace(/^#+\s*/, "").trim();
    if (lines.length >= 2 && headingLine.length <= 120 && /[A-Za-zÀ-ÿ]/.test(headingLine)) {
      const paragraphs = lines.slice(1).join(" ");
      if (paragraphs.length >= 30) {
        return `<h2>${escapeHtml(headingLine)}</h2><p>${escapeHtml(paragraphs)}</p>`;
      }
    }

    return `<p>${escapeHtml(lines.join(" "))}</p>`;
  });

  return stripContentH1Tags(htmlBlocks.filter(Boolean).join("\n"));
};

const deriveTitleFromSeed = (seedText: string) => {
  const normalized = String(seedText || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidate =
    normalized.find((line) => {
      if (/^https?:\/\//i.test(line)) return false;
      if (/^(?:[-*•]\s+|\d+[.)]\s+)/.test(line)) return false;
      return /[A-Za-zÀ-ÿ]/.test(line);
    }) || "Guia de Home Care";

  return clampText(candidate.replace(/^#+\s*/, ""), 120) || "Guia de Home Care";
};

const deriveFocusKeywordFromTitle = (title: string) => {
  const normalized = String(title || "").trim();
  if (!normalized) return "home care";
  const firstSegment = normalized.split(/[:|—-]/)[0]?.trim() || normalized;
  const words = firstSegment.split(/\s+/).filter(Boolean).slice(0, 6);
  return clampText(words.join(" "), SEO_FOCUS_KEYWORD_MAX_CHARS) || "home care";
};

const parseSchemaJson = (value: string) => {
  const clean = value?.trim() || "{}";
  try {
    const parsed = JSON.parse(clean);
    const isObject = !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
    const isArrayOfObjects =
      Array.isArray(parsed) &&
      parsed.every((item) => !!item && typeof item === "object" && !Array.isArray(item));

    if (!isObject && !isArrayOfObjects) {
      return { error: "O Schema JSON deve ser um objeto JSON ou uma lista de objetos JSON válida." };
    }
    return { value: parsed };
  } catch {
    return { error: "Schema JSON inválido. Verifique a sintaxe." };
  }
};

const stripContentH1Tags = (html: string) =>
  String(html || "")
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const clampText = (value: string, max: number) => String(value || "").trim().slice(0, max).trim();
const fitSeoLengthRange = (value: string, min: number, max: number, padText: string) => {
  const safePad =
    String(padText || "").trim() || "Conteudo informativo para orientar decisoes com qualidade e seguranca.";
  let text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) text = safePad;
  while (text.length < min) {
    text = `${text} ${safePad}`.replace(/\s+/g, " ").trim();
    if (text.length >= min) break;
  }
  if (text.length > max) return text.slice(0, max).trim();
  return text;
};

const buildDefaultCanonicalUrl = (slug: string) => {
  const safeSlug = generateSlug(String(slug || "").trim());
  return safeSlug ? `https://www.homecarematch.com.br/blog/artigo/${safeSlug}` : "https://www.homecarematch.com.br/blog";
};

const buildFallbackArticleContent = (keyword: string, excerpt: string) => {
  const safeKeyword = String(keyword || "home care").trim();
  const safeExcerpt =
    String(excerpt || "").trim() ||
    `Entenda como aplicar ${safeKeyword} com qualidade assistencial, segurança e foco no paciente.`;

  const intro = `
<p>${safeExcerpt}</p>
<p>Este guia apresenta uma visão prática sobre ${safeKeyword}, com foco em processos assistenciais, segurança do paciente e eficiência operacional no atendimento domiciliar.</p>
<p>Ao longo do conteúdo, você verá recomendações aplicáveis para equipes de Home Care, familiares e gestores que desejam elevar qualidade e previsibilidade dos resultados.</p>
`;

  const sec1 = `
<h2 id="fundamentos">${safeKeyword}: fundamentos para aplicar com qualidade</h2>
<p>Estruturar ${safeKeyword} exige protocolos claros, definição de responsabilidades e comunicação ativa entre equipe, paciente e família.</p>
<p>Na prática, os melhores resultados surgem quando a rotina combina avaliação inicial completa, plano assistencial personalizado e revisão periódica dos indicadores clínicos.</p>
<p>Outro ponto essencial é padronizar registros para reduzir retrabalho, facilitar auditoria e apoiar decisões baseadas em dados.</p>
<ul>
  <li>Plano de cuidado com objetivos mensuráveis</li>
  <li>Rotina de reavaliação semanal ou quinzenal</li>
  <li>Registro estruturado de evolução clínica</li>
</ul>
`;

  const sec2 = `
<h2 id="operacao">Como organizar a operação de ${safeKeyword}</h2>
<p>A operação deve começar com estratificação de risco, frequência de visitas e definição de gatilhos para escalonamento clínico.</p>
<p>Em seguida, a equipe precisa alinhar agenda, logística e canais de contato para evitar atrasos e lacunas no acompanhamento.</p>
<p>Também é recomendado monitorar indicadores como adesão ao plano, tempo de resposta e ocorrências assistenciais para melhoria contínua.</p>
<h3 id="indicadores">Indicadores prioritários para acompanhamento</h3>
<p>Taxa de readmissão, eventos evitáveis, satisfação da família e conformidade de protocolos são métricas úteis para calibrar a qualidade de ${safeKeyword}.</p>
`;

  const sec3 = `
<h2 id="seguranca">Segurança do paciente em ${safeKeyword}</h2>
<p>A segurança deve ser tratada como rotina, não como ação pontual. Isso inclui checklist de visita, confirmação de medicação e validação de sinais de alerta.</p>
<p>Treinamento contínuo da equipe e orientação objetiva à família reduzem riscos e melhoram adesão ao plano assistencial.</p>
<p>Quando existe protocolo de resposta rápida para intercorrências, a assistência se torna mais previsível e efetiva.</p>
<ul>
  <li>Checklist padronizado em toda visita</li>
  <li>Protocolos de comunicação e escalonamento</li>
  <li>Revisão de eventos e plano de prevenção</li>
</ul>
`;

  const sec4 = `
<h2 id="conclusao">Conclusão</h2>
<p>Aplicar ${safeKeyword} com qualidade depende de método, acompanhamento de indicadores e melhoria contínua da execução.</p>
<p>Com processos bem definidos, comunicação clara e foco no paciente, é possível aumentar segurança assistencial e eficiência operacional em Home Care.</p>
<p>Use este conteúdo como base para evoluir seu modelo de atendimento e fortalecer resultados clínicos e experiência da família.</p>
`;

  const faq = `
<h2 id="faq">Perguntas Frequentes</h2>
<h3>Qual o primeiro passo para melhorar ${safeKeyword}?</h3>
<p>O primeiro passo é definir um plano assistencial com metas claras, responsáveis e rotina de reavaliação para cada paciente.</p>
<h3>Quais indicadores acompanhar em ${safeKeyword}?</h3>
<p>Os principais são adesão ao plano, eventos evitáveis, tempo de resposta e satisfação da família com o atendimento.</p>
<h3>Como reduzir falhas operacionais no Home Care?</h3>
<p>Padronize protocolos, garanta registros consistentes e mantenha comunicação ativa entre equipe, paciente e familiares.</p>
`;

  return `
${intro}
<h2 id="sumario">Neste artigo você verá</h2>
<ul>
  <li><a href="#fundamentos">Fundamentos de ${safeKeyword}</a></li>
  <li><a href="#operacao">Organização operacional</a></li>
  <li><a href="#seguranca">Segurança do paciente</a></li>
  <li><a href="#conclusao">Conclusão</a></li>
  <li><a href="#faq">Perguntas frequentes</a></li>
</ul>
${sec1}
${sec2}
${sec3}
${sec4}
${faq}
`.trim();
};

const buildDefaultSchemaJson = (title: string, slug: string, description: string, keyword: string) =>
  JSON.stringify(
    [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: String(title || "").trim(),
        description: clampText(description || "", 155),
        keywords: String(keyword || "").trim(),
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": buildDefaultCanonicalUrl(slug),
        },
      },
    ],
    null,
    2,
  );

type SeoAuditItem = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

type SeoAuditReport = {
  passed: number;
  total: number;
  score: number;
  metrics: {
    chars: number;
    words: number;
    keywordDensity: number;
    h1Count: number;
    h2Count: number;
    h3Count: number;
    internalLinks: number;
    externalLinks: number;
    faqQuestions: number;
  };
  items: SeoAuditItem[];
};

const normalizeAuditText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripAuditHtml = (html: string) =>
  String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const FAQ_HEADING_KEYWORDS = ["perguntas frequentes", "duvidas frequentes", "faq"];

const extractFaqAuditData = (contentHtml: string) => {
  const source = String(contentHtml || "");
  const headingRegex = /<h([2-5])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: Array<{ level: number; start: number; end: number; text: string }> = [];

  let match: RegExpExecArray | null = null;
  while ((match = headingRegex.exec(source))) {
    headings.push({
      level: Number(match[1] || 0),
      start: match.index,
      end: headingRegex.lastIndex,
      text: normalizeAuditText(stripAuditHtml(match[2] || "")),
    });
  }

  const faqHeadingIndex = headings.findIndex((heading) =>
    FAQ_HEADING_KEYWORDS.some((keyword) => heading.text.includes(keyword)),
  );

  if (faqHeadingIndex < 0) {
    return { hasFaqSection: false, faqQuestions: 0 };
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
  const headingQuestions = countAuditMatches(faqBlock, /<h([3-6])\b[^>]*>[\s\S]*?<\/h\1>/gi);

  const listQuestions = Array.from(faqBlock.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)).filter((item) =>
    stripAuditHtml(String(item?.[1] || "")).includes("?"),
  ).length;

  const paragraphQuestions = Array.from(faqBlock.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).filter((item) =>
    stripAuditHtml(String(item?.[1] || "")).includes("?"),
  ).length;

  return {
    hasFaqSection: true,
    faqQuestions: headingQuestions || listQuestions || paragraphQuestions,
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
  const plainLength = stripAuditHtml(source).length;

  if (plainLength <= safeMax) {
    return { html: source, chars: plainLength, wasTrimmed: false };
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
  const normalizedChars = stripAuditHtml(normalized).length;

  return {
    html: normalized,
    chars: normalizedChars,
    wasTrimmed: normalizedChars < plainLength,
  };
};

const countAuditMatches = (value: string, regex: RegExp) => (String(value || "").match(regex) || []).length;
const SEO_MIN_CONTENT_CHARS = 8000;
const SEO_MAX_CONTENT_CHARS = 12000;
const SEO_TITLE_MIN_CHARS = 30;
const SEO_TITLE_MAX_CHARS = 60;
const SEO_DESCRIPTION_MIN_CHARS = 70;
const SEO_DESCRIPTION_MAX_CHARS = 155;
const SEO_SLUG_MAX_CHARS = 75;
const SEO_EXCERPT_MIN_CHARS = 70;
const SEO_EXCERPT_MAX_CHARS = 180;
const SEO_FOCUS_KEYWORD_MIN_CHARS = 3;
const SEO_FOCUS_KEYWORD_MAX_CHARS = 90;

const getLengthHintTone = (length: number, min: number, max: number) => {
  if (length === 0) return "text-muted-foreground";
  if (length < min || length > max) return "text-amber-700";
  return "text-emerald-700";
};

const SeoLengthHint = ({
  value,
  min,
  max,
}: {
  value: string;
  min: number;
  max: number;
}) => {
  const length = String(value || "").trim().length;
  return (
    <p className={`text-[11px] ${getLengthHintTone(length, min, max)}`}>
      {length}/{max} caracteres (ideal: {min}-{max})
    </p>
  );
};

const SeoMaxLengthHint = ({
  value,
  max,
}: {
  value: string;
  max: number;
}) => {
  const length = String(value || "").trim().length;
  const tone = length === 0 ? "text-muted-foreground" : length > max ? "text-amber-700" : "text-emerald-700";
  return (
    <p className={`text-[11px] ${tone}`}>
      {length}/{max} caracteres (máximo recomendado: {max})
    </p>
  );
};

const computeSeoAuditReport = (form: BlogArticleForm): SeoAuditReport => {
  const contentHtml = String(form.content_html || "");
  const plain = stripAuditHtml(contentHtml);
  const words = plain ? plain.split(" ").filter(Boolean).length : 0;

  const keyword = String(form.focus_keyword || "").trim();
  const keywordNorm = normalizeAuditText(keyword);
  const keywordSlug = generateSlug(keyword);
  const plainNorm = normalizeAuditText(plain);
  const keywordOccurrences =
    keywordNorm && plainNorm
      ? countAuditMatches(plainNorm, new RegExp(`\\b${keywordNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"))
      : 0;
  const keywordDensity = words > 0 ? (keywordOccurrences / words) * 100 : 0;

  const h1Count = countAuditMatches(contentHtml, /<h1\b/gi);
  const h2Count = countAuditMatches(contentHtml, /<h2\b/gi);
  const h3Count = countAuditMatches(contentHtml, /<h3\b/gi);

  const firstParagraphText = stripAuditHtml((contentHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "").trim());
  const introLength = firstParagraphText.length;

  const conclusionMatch = contentHtml.match(/<h2\b[^>]*>[\s\S]*?(conclusao|conclusão)[\s\S]*?<\/h2>([\s\S]*?)(?=<h2\b|$)/i);
  const conclusionText = stripAuditHtml(conclusionMatch?.[2] || "");
  const conclusionLength = conclusionText.length;

  const faqAudit = extractFaqAuditData(contentHtml);
  const hasFaqHeading = faqAudit.hasFaqSection;
  const faqQuestions = faqAudit.faqQuestions;

  const hrefs = Array.from(contentHtml.matchAll(/href\s*=\s*["']([^"']+)["']/gi))
    .map((entry) => String(entry?.[1] || "").trim())
    .filter(Boolean);
  const internalLinks = hrefs.filter((href) => href.startsWith("/") || href.startsWith("#") || href.includes("homecarematch.com.br")).length;
  const externalLinks = hrefs.filter(
    (href) => (href.startsWith("http://") || href.startsWith("https://")) && !href.includes("homecarematch.com.br"),
  ).length;

  const h2Texts = Array.from(contentHtml.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)).map((entry) => normalizeAuditText(stripAuditHtml(entry[1] || "")));
  const hasKeywordInH2 = keywordNorm ? h2Texts.some((text) => text.includes(keywordNorm)) : false;

  const seoDescriptionNorm = normalizeAuditText(form.seo_description || "");
  const slugContainsKeyword = keywordSlug ? String(form.slug || "").includes(keywordSlug) : false;
  const keywordInFirstParagraph = keywordNorm ? normalizeAuditText(firstParagraphText).includes(keywordNorm) : false;
  const keywordInConclusion = keywordNorm ? normalizeAuditText(conclusionText).includes(keywordNorm) : false;
  const keywordInMetaDescription = keywordNorm ? seoDescriptionNorm.includes(keywordNorm) : false;
  const items: SeoAuditItem[] = [
    {
      id: "min-content",
      label: `Conteudo entre ${SEO_MIN_CONTENT_CHARS} e ${SEO_MAX_CONTENT_CHARS} caracteres`,
      passed: plain.length >= SEO_MIN_CONTENT_CHARS && plain.length <= SEO_MAX_CONTENT_CHARS,
      detail: `${plain.length} caracteres`,
    },
    {
      id: "h1-single",
      label: "Sem H1 no conteúdo (H1 fica no título da página)",
      passed: h1Count === 0,
      detail: `${h1Count} H1`,
    },
    {
      id: "h2-range",
      label: "Estrutura H2 (entre 3 e 8)",
      passed: h2Count >= 3 && h2Count <= 8,
      detail: `${h2Count} H2`,
    },
    {
      id: "h3-min",
      label: "Estrutura H3 (minimo 3)",
      passed: h3Count >= 3,
      detail: `${h3Count} H3`,
    },
    {
      id: "keyword-density",
      label: "Densidade da palavra-chave (0,8% a 1,5%)",
      passed: keywordDensity >= 0.8 && keywordDensity <= 1.5,
      detail: `${keywordDensity.toFixed(2)}%`,
    },
    {
      id: "keyword-first-paragraph",
      label: "Palavra-chave no primeiro paragrafo",
      passed: keywordInFirstParagraph,
      detail: keyword || "Sem palavra-chave foco",
    },
    {
      id: "keyword-h2",
      label: "Palavra-chave em pelo menos um H2",
      passed: hasKeywordInH2,
      detail: keyword || "Sem palavra-chave foco",
    },
    {
      id: "keyword-conclusion",
      label: "Palavra-chave na conclusao",
      passed: keywordInConclusion,
      detail: keyword || "Sem palavra-chave foco",
    },
    {
      id: "keyword-meta",
      label: "Palavra-chave na meta description",
      passed: keywordInMetaDescription,
      detail: `${(form.seo_description || "").length} caracteres`,
    },
    {
      id: "keyword-slug",
      label: "Palavra-chave na slug",
      passed: slugContainsKeyword,
      detail: form.slug || "-",
    },
    {
      id: "intro-size",
      label: "Introducao entre 500 e 800 caracteres",
      passed: introLength >= 500 && introLength <= 800,
      detail: `${introLength} caracteres`,
    },
    {
      id: "conclusion-size",
      label: "Conclusao entre 400 e 700 caracteres",
      passed: conclusionLength >= 400 && conclusionLength <= 700,
      detail: `${conclusionLength} caracteres`,
    },
    {
      id: "faq",
      label: "FAQ com 3 a 5 perguntas",
      passed: hasFaqHeading && faqQuestions >= 3 && faqQuestions <= 5,
      detail: hasFaqHeading ? `${faqQuestions} perguntas` : "Secao FAQ nao encontrada",
    },
    {
      id: "links-internal",
      label: "Links internos (minimo 3)",
      passed: internalLinks >= 3,
      detail: `${internalLinks} links`,
    },
    {
      id: "links-external",
      label: "Links externos (2 a 3)",
      passed: externalLinks >= 2 && externalLinks <= 3,
      detail: `${externalLinks} links`,
    },
    {
      id: "seo-title-length",
      label: `SEO title entre ${SEO_TITLE_MIN_CHARS} e ${SEO_TITLE_MAX_CHARS} caracteres`,
      passed:
        String(form.seo_title || "").trim().length >= SEO_TITLE_MIN_CHARS &&
        String(form.seo_title || "").trim().length <= SEO_TITLE_MAX_CHARS,
      detail: `${String(form.seo_title || "").trim().length} caracteres`,
    },
    {
      id: "meta-length",
      label: `Meta description entre ${SEO_DESCRIPTION_MIN_CHARS} e ${SEO_DESCRIPTION_MAX_CHARS} caracteres`,
      passed:
        String(form.seo_description || "").trim().length >= SEO_DESCRIPTION_MIN_CHARS &&
        String(form.seo_description || "").trim().length <= SEO_DESCRIPTION_MAX_CHARS,
      detail: `${String(form.seo_description || "").trim().length} caracteres`,
    },
  ];

  const passed = items.filter((item) => item.passed).length;
  const total = items.length;

  return {
    passed,
    total,
    score: total > 0 ? Math.round((passed / total) * 100) : 0,
    metrics: {
      chars: plain.length,
      words,
      keywordDensity,
      h1Count,
      h2Count,
      h3Count,
      internalLinks,
      externalLinks,
      faqQuestions,
    },
    items,
  };
};

type SeoAiOptimizableField =
  | "title"
  | "slug"
  | "excerpt"
  | "content_html"
  | "focus_keyword"
  | "seo_title"
  | "seo_description"
  | "seo_canonical_url"
  | "seo_robots"
  | "seo_og_title"
  | "seo_og_description"
  | "seo_og_image_url"
  | "schema_json";

const BlogSeoFields = ({
  value,
  onChange,
  onOptimizeField,
  optimizingField,
}: {
  value: BlogSeoForm;
  onChange: (patch: Partial<BlogSeoForm>) => void;
  onOptimizeField?: (field: SeoAiOptimizableField) => void;
  optimizingField?: string | null;
}) => (
  <div className="space-y-4 rounded-xl border border-border/70 bg-secondary/10 p-4">
    <div>
      <p className="text-sm font-semibold">SEO e Schema</p>
      <p className="text-xs text-muted-foreground">Configure metadata para Google e redes sociais.</p>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Titulo SEO</Label>
          {onOptimizeField ? (
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onOptimizeField("seo_title")} disabled={optimizingField === "seo_title"}>
              {optimizingField === "seo_title" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              IA SEO
            </Button>
          ) : null}
        </div>
        <Input value={value.seo_title} onChange={(e) => onChange({ seo_title: e.target.value })} />
        <SeoLengthHint value={value.seo_title} min={SEO_TITLE_MIN_CHARS} max={SEO_TITLE_MAX_CHARS} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Robots</Label>
          {onOptimizeField ? (
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onOptimizeField("seo_robots")} disabled={optimizingField === "seo_robots"}>
              {optimizingField === "seo_robots" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              IA SEO
            </Button>
          ) : null}
        </div>
        <Input value={value.seo_robots} onChange={(e) => onChange({ seo_robots: e.target.value })} placeholder="index,follow" />
      </div>
    </div>

    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Descricao SEO</Label>
        {onOptimizeField ? (
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onOptimizeField("seo_description")} disabled={optimizingField === "seo_description"}>
            {optimizingField === "seo_description" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            IA SEO
          </Button>
        ) : null}
      </div>
      <Textarea value={value.seo_description} onChange={(e) => onChange({ seo_description: e.target.value })} rows={3} />
      <SeoLengthHint value={value.seo_description} min={SEO_DESCRIPTION_MIN_CHARS} max={SEO_DESCRIPTION_MAX_CHARS} />
    </div>

    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Canonical URL</Label>
        {onOptimizeField ? (
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onOptimizeField("seo_canonical_url")} disabled={optimizingField === "seo_canonical_url"}>
            {optimizingField === "seo_canonical_url" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            IA SEO
          </Button>
        ) : null}
      </div>
      <Input value={value.seo_canonical_url} onChange={(e) => onChange({ seo_canonical_url: e.target.value })} placeholder="https://www.homecarematch.com.br/blog/..." />
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Open Graph Titulo</Label>
          {onOptimizeField ? (
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onOptimizeField("seo_og_title")} disabled={optimizingField === "seo_og_title"}>
              {optimizingField === "seo_og_title" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              IA SEO
            </Button>
          ) : null}
        </div>
        <Input value={value.seo_og_title} onChange={(e) => onChange({ seo_og_title: e.target.value })} />
        <SeoLengthHint value={value.seo_og_title} min={SEO_TITLE_MIN_CHARS} max={SEO_TITLE_MAX_CHARS} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Open Graph Imagem (URL)</Label>
          {onOptimizeField ? (
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onOptimizeField("seo_og_image_url")} disabled={optimizingField === "seo_og_image_url"}>
              {optimizingField === "seo_og_image_url" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              IA SEO
            </Button>
          ) : null}
        </div>
        <Input value={value.seo_og_image_url} onChange={(e) => onChange({ seo_og_image_url: e.target.value })} placeholder="https://..." />
      </div>
    </div>

    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Open Graph Descricao</Label>
        {onOptimizeField ? (
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onOptimizeField("seo_og_description")} disabled={optimizingField === "seo_og_description"}>
            {optimizingField === "seo_og_description" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            IA SEO
          </Button>
        ) : null}
      </div>
      <Textarea value={value.seo_og_description} onChange={(e) => onChange({ seo_og_description: e.target.value })} rows={2} />
      <SeoLengthHint value={value.seo_og_description} min={SEO_DESCRIPTION_MIN_CHARS} max={SEO_DESCRIPTION_MAX_CHARS} />
    </div>

    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Schema JSON (opcional)</Label>
        {onOptimizeField ? (
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onOptimizeField("schema_json")} disabled={optimizingField === "schema_json"}>
            {optimizingField === "schema_json" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            IA SEO
          </Button>
        ) : null}
      </div>
      <Textarea value={value.schema_json} onChange={(e) => onChange({ schema_json: e.target.value })} rows={5} className="font-mono text-xs" />
    </div>
  </div>
);
const BlogTab = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("articles");
  const [syncing, setSyncing] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingTag, setSavingTag] = useState(false);
  const [savingArticle, setSavingArticle] = useState(false);
  const [generatingAI, setGeneratingAI] = useState<"suggestion" | "automatic" | null>(null);
  const [optimizingSeoField, setOptimizingSeoField] = useState<string | null>(null);
  const [generatingTagsAI, setGeneratingTagsAI] = useState(false);
  const [creatingTagsAI, setCreatingTagsAI] = useState(false);
  const [generatingCoverImage, setGeneratingCoverImage] = useState(false);
  const [coverPreviewOpen, setCoverPreviewOpen] = useState(false);
  const [coverCandidate, setCoverCandidate] = useState<CoverCandidate | null>(null);
  const [rejectedCoverUrls, setRejectedCoverUrls] = useState<string[]>([]);
  const [creatingCategoryInline, setCreatingCategoryInline] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [chatGptSeedText, setChatGptSeedText] = useState("");
  const [autofillingFromChatGpt, setAutofillingFromChatGpt] = useState(false);
  const [autofillingLocally, setAutofillingLocally] = useState(false);
  const [researchThemes, setResearchThemes] = useState<BlogResearchTheme[]>(BLOG_RESEARCH_DEFAULT_THEMES);
  const [researchTheme, setResearchTheme] = useState(BLOG_RESEARCH_DEFAULT_THEMES[0]?.id || "homecare_idosos");
  const [loadingResearchThemes, setLoadingResearchThemes] = useState(false);
  const [researchingTopics, setResearchingTopics] = useState(false);
  const [researchResults, setResearchResults] = useState<BlogResearchResult[]>([]);
  const [generatingFromResearchId, setGeneratingFromResearchId] = useState<string | null>(null);
  const [showSeoAudit, setShowSeoAudit] = useState(false);
  const [autoFixingSeo, setAutoFixingSeo] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);

  const [categoryForm, setCategoryForm] = useState<BlogCategoryForm>(emptyCategoryForm);
  const [tagForm, setTagForm] = useState<BlogTagForm>(emptyTagForm);
  const [articleForm, setArticleForm] = useState<BlogArticleForm>(emptyArticleForm);

  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")),
    [tags],
  );

  const categoryPathById = useMemo(() => {
    const pathMap = new Map<string, string>();
    const byId = new Map<string, any>(categories.map((category) => [String(category.id), category]));

    const resolvePath = (id: string, trail = new Set<string>()): string => {
      if (pathMap.has(id)) return pathMap.get(id) || "";
      const category = byId.get(id);
      if (!category) {
        pathMap.set(id, "");
        return "";
      }

      if (trail.has(id)) {
        return String(category.name || "").trim();
      }
      trail.add(id);

      const name = String(category.name || "").trim();
      const parentId = category.parent_id ? String(category.parent_id) : "";
      let path = name;

      if (parentId && byId.has(parentId) && parentId !== id) {
        const parentPath = resolvePath(parentId, new Set(trail));
        if (parentPath) path = `${parentPath} > ${name}`;
      }

      pathMap.set(id, path);
      return path;
    };

    for (const category of categories) {
      resolvePath(String(category.id));
    }

    return pathMap;
  }, [categories]);

  const categoryOptions = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          label: categoryPathById.get(String(category.id)) || String(category.name || ""),
        }))
        .sort((a, b) => String(a.label || "").localeCompare(String(b.label || ""), "pt-BR")),
    [categories, categoryPathById],
  );

  const ensureTenResearchThemes = (rawThemes: any[]): BlogResearchTheme[] => {
    const sanitized = (Array.isArray(rawThemes) ? rawThemes : [])
      .map((theme: any) => {
        const baseId = String(theme?.id || theme?.label || "").trim();
        const id = generateSlug(baseId).replace(/-/g, "_").slice(0, 60) || "";
        const label = String(theme?.label || "").trim();
        const description = String(theme?.description || "").trim();
        const queries = (Array.isArray(theme?.queries) ? theme.queries : [])
          .map((query: unknown) => String(query || "").trim())
          .filter(Boolean)
          .slice(0, 5);
        return {
          id,
          label,
          description,
          queries,
        } as BlogResearchTheme;
      })
      .filter((theme: BlogResearchTheme) => theme.id && theme.label && theme.description && theme.queries.length >= 2);

    const deduped: BlogResearchTheme[] = [];
    const used = new Set<string>();

    for (const theme of sanitized) {
      if (used.has(theme.id)) continue;
      used.add(theme.id);
      deduped.push(theme);
      if (deduped.length === 10) break;
    }

    for (const theme of BLOG_RESEARCH_DEFAULT_THEMES) {
      if (deduped.length >= 10) break;
      if (used.has(theme.id)) continue;
      used.add(theme.id);
      deduped.push(theme);
    }

    return deduped.slice(0, 10);
  };

  const selectedResearchTheme = useMemo(
    () => researchThemes.find((theme) => theme.id === researchTheme) || researchThemes[0] || null,
    [researchTheme, researchThemes],
  );
  const sourceReferenceExternalUrl = useMemo(
    () => getSafeExternalUrl(articleForm.source_reference_url),
    [articleForm.source_reference_url],
  );
  const coverImagePreviewUrl = useMemo(
    () => getSafeExternalUrl(articleForm.cover_image_url),
    [articleForm.cover_image_url],
  );
  const seoAuditReport = useMemo(() => computeSeoAuditReport(articleForm), [articleForm]);
  const articleSeoScoreById = useMemo(() => {
    const scoreMap = new Map<string, number>();
    for (const article of articles) {
      const tagIds = (Array.isArray(article?.blog_article_tags) ? article.blog_article_tags : [])
        .map((link: any) => String(link?.tag?.id || "").trim())
        .filter(Boolean);

      const auditForm: BlogArticleForm = {
        id: article?.id || null,
        title: String(article?.title || ""),
        slug: String(article?.slug || ""),
        excerpt: String(article?.excerpt || ""),
        source_reference_url: String(article?.source_reference_url || ""),
        cover_image_url: String(article?.cover_image_url || ""),
        content_html: stripContentH1Tags(String(article?.content_html || "")),
        status: article?.status === "published" ? "published" : "draft",
        published_at: String(article?.published_at || ""),
        author_name: String(article?.author_name || "Equipe HomeCare Match"),
        reading_time_minutes: Number(article?.reading_time_minutes || 1),
        featured: !!article?.featured,
        category_id: String(article?.category_id || ""),
        tag_ids: tagIds,
        focus_keyword: String(article?.focus_keyword || ""),
        seo_title: String(article?.seo_title || ""),
        seo_description: String(article?.seo_description || ""),
        seo_canonical_url: String(article?.seo_canonical_url || ""),
        seo_robots: String(article?.seo_robots || "index,follow"),
        seo_og_title: String(article?.seo_og_title || ""),
        seo_og_description: String(article?.seo_og_description || ""),
        seo_og_image_url: String(article?.seo_og_image_url || ""),
        schema_json:
          article?.schema_json && typeof article.schema_json === "object"
            ? JSON.stringify(article.schema_json, null, 2)
            : String(article?.schema_json || "{}"),
      };

      const score = computeSeoAuditReport(auditForm).score;
      scoreMap.set(String(article?.id || ""), score);
    }
    return scoreMap;
  }, [articles]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [categoriesRes, tagsRes, articlesRes] = await Promise.all([
        supabase.from("blog_categories").select("*").order("name", { ascending: true }),
        supabase.from("blog_tags").select("*").order("name", { ascending: true }),
        supabase
          .from("blog_articles")
          .select(
            `
            *,
            category:blog_categories ( id, name, slug ),
            blog_article_tags (
              tag:blog_tags ( id, name, slug )
            )
          `,
          )
          .order("updated_at", { ascending: false }),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (tagsRes.error) throw tagsRes.error;
      if (articlesRes.error) throw articlesRes.error;

      setCategories(categoriesRes.data || []);
      setTags(tagsRes.data || []);
      setArticles(articlesRes.data || []);
    } catch (err: any) {
      console.error("[BlogTab] fetchAll error:", err);
      toast.error(
        err?.message?.includes("relation")
          ? "Estrutura de blog ainda não existe. Execute a migration antes de usar este painel."
          : "Erro ao carregar dados do blog.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSyncSchema = async () => {
    setSyncing(true);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

      if (!accessToken) {
        throw new Error("Sessao expirada. Entre novamente para sincronizar.");
      }

      const { error } = await supabase.functions.invoke("extend-site-config", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (error) throw error;

      const blogResponse = await fetch(`${SUPABASE_URL}/functions/v1/setup-blog-module`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!blogResponse.ok) {
        let detail = `HTTP ${blogResponse.status}`;
        try {
          const payload = await blogResponse.json();
          const message = typeof payload?.error === "string" ? payload.error : "";
          const extra = typeof payload?.details === "string" ? payload.details : "";
          const text = [message, extra].filter(Boolean).join(" - ");
          if (text) detail = text;
        } catch {
          // noop
        }
        throw new Error(`Falha ao sincronizar modulo Blog: ${detail}`);
      }

      toast.success("Sincronizacao concluida (estrutura base + modulo Blog).");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao sincronizar estrutura base.");
    } finally {
      setSyncing(false);
    }
  };

  const resetCategoryForm = () => setCategoryForm(emptyCategoryForm);
  const resetTagForm = () => setTagForm(emptyTagForm);
  const resetArticleForm = () => {
    setArticleForm(emptyArticleForm);
    setShowSeoAudit(false);
  };

  const upsertCategoryByName = async (name: string, parentId: string | null) => {
    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      throw new Error("Nome de categoria invalido.");
    }

    const slug = generateSlug(trimmedName);
    if (!slug) {
      throw new Error("Nao foi possivel gerar slug para a categoria.");
    }

    const { data: existing, error: existingError } = await supabase
      .from("blog_categories")
      .select("id,parent_id")
      .eq("slug", slug)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.id) {
      const existingParent = existing.parent_id ? String(existing.parent_id) : null;
      if (existingParent !== (parentId || null)) {
        throw new Error(`Ja existe categoria com slug "${slug}" em outro nivel.`);
      }
      return { id: String(existing.id), created: false };
    }

    const { data: created, error: createError } = await supabase
      .from("blog_categories")
      .insert({
        name: trimmedName,
        slug,
        parent_id: parentId || null,
      })
      .select("id")
      .single();
    if (createError) throw createError;

    return { id: String(created.id), created: true };
  };

  const handleCreateCategoryFromSelector = async () => {
    const rawInput = window.prompt('Digite "Categoria" ou "Categoria > Subcategoria"');
    if (rawInput === null) return;

    const parts = String(rawInput)
      .split(">")
      .map((item) => item.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      toast.error("Informe um nome valido para categoria.");
      return;
    }

    setCreatingCategoryInline(true);
    try {
      let parentId: string | null = null;
      let lastId = "";
      let createdCount = 0;

      for (const part of parts) {
        const result = await upsertCategoryByName(part, parentId);
        if (result.created) createdCount += 1;
        lastId = result.id;
        parentId = result.id;
      }

      if (!lastId) {
        throw new Error("Nao foi possivel criar categoria/subcategoria.");
      }

      await fetchAll();
      setArticleForm((prev) => ({ ...prev, category_id: lastId }));
      toast.success(
        createdCount > 0
          ? "Categoria/subcategoria criada e selecionada no artigo."
          : "Categoria/subcategoria existente selecionada no artigo.",
      );
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar categoria/subcategoria.");
    } finally {
      setCreatingCategoryInline(false);
    }
  };

  const handleSaveCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    if (!categoryForm.slug.trim()) {
      toast.error("Informe o slug da categoria.");
      return;
    }

    const schema = parseSchemaJson(categoryForm.schema_json);
    if (schema.error) {
      toast.error(schema.error);
      return;
    }

    setSavingCategory(true);
    try {
      if (categoryForm.id && categoryForm.parent_id && categoryForm.parent_id === categoryForm.id) {
        throw new Error("Uma categoria nao pode ser pai dela mesma.");
      }
      if (categoryForm.id && categoryForm.parent_id) {
        const childrenByParent = new Map<string, string[]>();
        for (const category of categories) {
          const parentId = category.parent_id ? String(category.parent_id) : "";
          if (!parentId) continue;
          const children = childrenByParent.get(parentId) || [];
          children.push(String(category.id));
          childrenByParent.set(parentId, children);
        }

        const descendants = new Set<string>();
        const queue = [String(categoryForm.id)];
        while (queue.length > 0) {
          const current = queue.shift() as string;
          const children = childrenByParent.get(current) || [];
          for (const childId of children) {
            if (descendants.has(childId)) continue;
            descendants.add(childId);
            queue.push(childId);
          }
        }

        if (descendants.has(String(categoryForm.parent_id))) {
          throw new Error("Selecione uma categoria pai valida. Nao e permitido criar ciclo de subcategorias.");
        }
      }

      const payload = {
        name: categoryForm.name.trim(),
        slug: generateSlug(categoryForm.slug),
        parent_id: categoryForm.parent_id || null,
        description: categoryForm.description || null,
        seo_title: categoryForm.seo_title || null,
        seo_description: categoryForm.seo_description || null,
        seo_canonical_url: categoryForm.seo_canonical_url || null,
        seo_robots: categoryForm.seo_robots || "index,follow",
        seo_og_title: categoryForm.seo_og_title || null,
        seo_og_description: categoryForm.seo_og_description || null,
        seo_og_image_url: categoryForm.seo_og_image_url || null,
        schema_json: schema.value,
      };

      if (categoryForm.id) {
        const { error } = await supabase.from("blog_categories").update(payload).eq("id", categoryForm.id);
        if (error) throw error;
        toast.success("Categoria atualizada.");
      } else {
        const { error } = await supabase.from("blog_categories").insert(payload);
        if (error) throw error;
        toast.success("Categoria criada.");
      }

      resetCategoryForm();
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar categoria.");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSaveTag = async (event: FormEvent) => {
    event.preventDefault();
    if (!tagForm.name.trim()) {
      toast.error("Informe o nome da tag.");
      return;
    }
    if (!tagForm.slug.trim()) {
      toast.error("Informe o slug da tag.");
      return;
    }

    const schema = parseSchemaJson(tagForm.schema_json);
    if (schema.error) {
      toast.error(schema.error);
      return;
    }

    setSavingTag(true);
    try {
      const payload = {
        name: tagForm.name.trim(),
        slug: generateSlug(tagForm.slug),
        description: tagForm.description || null,
        seo_title: tagForm.seo_title || null,
        seo_description: tagForm.seo_description || null,
        seo_canonical_url: tagForm.seo_canonical_url || null,
        seo_robots: tagForm.seo_robots || "index,follow",
        seo_og_title: tagForm.seo_og_title || null,
        seo_og_description: tagForm.seo_og_description || null,
        seo_og_image_url: tagForm.seo_og_image_url || null,
        schema_json: schema.value,
      };

      if (tagForm.id) {
        const { error } = await supabase.from("blog_tags").update(payload).eq("id", tagForm.id);
        if (error) throw error;
        toast.success("Tag atualizada.");
      } else {
        const { error } = await supabase.from("blog_tags").insert(payload);
        if (error) throw error;
        toast.success("Tag criada.");
      }

      resetTagForm();
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar tag.");
    } finally {
      setSavingTag(false);
    }
  };

  const handleSaveArticle = async (
    event?: FormEvent,
    action: "close" | "continue" = "continue",
  ) => {
    event?.preventDefault();

    if (!articleForm.title.trim()) {
      toast.error("Informe o título do artigo.");
      return;
    }
    if (!articleForm.slug.trim()) {
      toast.error("Informe o slug do artigo.");
      return;
    }
    if (!articleForm.content_html.trim()) {
      toast.error("Informe o conteúdo do artigo.");
      return;
    }

    const schema = parseSchemaJson(articleForm.schema_json);
    if (schema.error) {
      toast.error(schema.error);
      return;
    }

    const boundedContent = clampContentHtmlByPlainChars(articleForm.content_html, SEO_MAX_CONTENT_CHARS);
    if (boundedContent.wasTrimmed) {
      setArticleForm((prev) => ({ ...prev, content_html: boundedContent.html }));
      toast.warning(`Conteúdo ajustado automaticamente para no máximo ${SEO_MAX_CONTENT_CHARS} caracteres.`);
    }

    setSavingArticle(true);
    try {
      const estimatedReadingTime = Math.max(
        1,
        Number(articleForm.reading_time_minutes || estimateReadingTime(boundedContent.html)),
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        title: articleForm.title.trim(),
        slug: generateSlug(articleForm.slug),
        excerpt: articleForm.excerpt || null,
        source_reference_url: articleForm.source_reference_url || null,
        cover_image_url: articleForm.cover_image_url || null,
        content_html: boundedContent.html,
        status: articleForm.status,
        published_at:
          articleForm.status === "published"
            ? articleForm.published_at || new Date().toISOString()
            : null,
        author_name: articleForm.author_name || "Equipe HomeCare Match",
        reading_time_minutes: estimatedReadingTime,
        featured: !!articleForm.featured,
        category_id: articleForm.category_id || null,
        focus_keyword: articleForm.focus_keyword || null,
        seo_title: articleForm.seo_title || null,
        seo_description: articleForm.seo_description || null,
        seo_canonical_url: articleForm.seo_canonical_url || null,
        seo_robots: articleForm.seo_robots || "index,follow",
        seo_og_title: articleForm.seo_og_title || null,
        seo_og_description: articleForm.seo_og_description || null,
        seo_og_image_url: articleForm.seo_og_image_url || null,
        schema_json: schema.value,
        updated_by: user?.id || null,
      };

      let articleId = articleForm.id || "";
      if (articleForm.id) {
        const { error } = await supabase.from("blog_articles").update(payload).eq("id", articleForm.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("blog_articles")
          .insert({
            ...payload,
            created_by: user?.id || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        articleId = data?.id;
      }

      if (articleId) {
        const { error: deleteLinksError } = await supabase
          .from("blog_article_tags")
          .delete()
          .eq("article_id", articleId);
        if (deleteLinksError) throw deleteLinksError;

        if (articleForm.tag_ids.length > 0) {
          const rows = articleForm.tag_ids.map((tagId) => ({
            article_id: articleId,
            tag_id: tagId,
          }));
          const { error: insertLinksError } = await supabase.from("blog_article_tags").insert(rows);
          if (insertLinksError) throw insertLinksError;
        }
      }

      toast.success(articleForm.id ? "Artigo atualizado." : "Artigo criado.");
      if (action === "close") {
        resetArticleForm();
      } else {
        setArticleForm((prev) => ({
          ...prev,
          id: articleId || prev.id,
          slug: generateSlug(prev.slug),
          reading_time_minutes: estimatedReadingTime,
          published_at:
            prev.status === "published"
              ? prev.published_at || new Date().toISOString()
              : prev.published_at,
        }));
      }
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar artigo.");
    } finally {
      setSavingArticle(false);
    }
  };

  const handleDelete = async (table: "blog_categories" | "blog_tags" | "blog_articles", id: string) => {
    if (!confirm("Deseja remover este item?")) return;
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Item removido.");
      fetchAll();
      if (table === "blog_categories" && categoryForm.id === id) resetCategoryForm();
      if (table === "blog_tags" && tagForm.id === id) resetTagForm();
      if (table === "blog_articles" && articleForm.id === id) resetArticleForm();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover item.");
    }
  };

  const applyArticleToForm = (article: any) => {
    const tagIds = (Array.isArray(article?.blog_article_tags) ? article.blog_article_tags : [])
      .map((link: any) => link?.tag?.id)
      .filter(Boolean);

    setArticleForm({
      id: article.id,
      title: article.title || "",
      slug: article.slug || "",
      excerpt: article.excerpt || "",
      source_reference_url: article.source_reference_url || "",
      cover_image_url: article.cover_image_url || "",
      content_html: stripContentH1Tags(article.content_html || ""),
      status: article.status === "published" ? "published" : "draft",
      published_at: article.published_at || "",
      author_name: article.author_name || "Equipe HomeCare Match",
      reading_time_minutes: article.reading_time_minutes || 1,
      featured: !!article.featured,
      category_id: article.category_id || "",
      tag_ids: tagIds,
      focus_keyword: article.focus_keyword || "",
      seo_title: article.seo_title || "",
      seo_description: article.seo_description || "",
      seo_canonical_url: article.seo_canonical_url || "",
      seo_robots: article.seo_robots || "index,follow",
      seo_og_title: article.seo_og_title || "",
      seo_og_description: article.seo_og_description || "",
      seo_og_image_url: article.seo_og_image_url || "",
      schema_json: JSON.stringify(article.schema_json || {}, null, 2),
    });
    setActiveTab("articles");
  };

  const handleGenerateAI = async (mode: "suggestion" | "automatic") => {
    const effectiveSuggestion = mode === "suggestion" ? String(aiSuggestion || "").trim() : "";

    if (mode === "suggestion" && !effectiveSuggestion) {
      toast.error("Informe uma sugestao para gerar o artigo com IA.");
      return;
    }
    if (mode === "suggestion" && !sourceReferenceExternalUrl) {
      toast.error("Informe a URL de referencia do artigo para gerar o conteudo com base na fonte.");
      return;
    }

    setGeneratingAI(mode);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente para usar a IA do blog.");
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-blog-article`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mode,
          suggestion: mode === "suggestion" ? effectiveSuggestion : null,
          source_reference_url: sourceReferenceExternalUrl || null,
        }),
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          const message = typeof payload?.error === "string" ? payload.error : "";
          const extra = typeof payload?.details === "string" ? payload.details : "";
          const text = [message, extra].filter(Boolean).join(" - ");
          if (text) detail = text;
        } catch {
          // noop
        }
        const error = new Error(detail) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      const payload = await response.json();
      const aiTitle = String(payload.title || "").trim();
      const aiSlug = generateSlug(String(payload.slug || aiTitle || ""));
      const aiExcerpt = String(payload.excerpt || "").trim();
      const aiContent = stripContentH1Tags(String(payload.content_html || "").trim());
      const aiFocusKeyword = String(payload.focus_keyword || "").trim();
      const aiTagsSuggested = Array.isArray(payload.tags_suggested) ? payload.tags_suggested : [];
      const aiSeoIssues = Array.isArray(payload?.seo_issues)
        ? payload.seo_issues.map((item: unknown) => String(item || "").trim()).filter(Boolean)
        : [];
      const aiSeoPassed = payload?.seo_validation_passed !== false && aiSeoIssues.length === 0;
      const aiSchemaJsonRaw = payload?.schema_json;
      const aiSchemaJson =
        aiSchemaJsonRaw && typeof aiSchemaJsonRaw === "object"
          ? JSON.stringify(aiSchemaJsonRaw, null, 2)
          : String(aiSchemaJsonRaw || "").trim();

      const resolvedTitle = aiTitle || clampText(effectiveSuggestion || articleForm.title || "Guia de Home Care", 120);
      const resolvedKeyword = aiFocusKeyword || articleForm.focus_keyword || resolvedTitle.split(":")[0].trim();
      const resolvedSlug = aiSlug || generateSlug(`${resolvedKeyword} ${resolvedTitle}`);
      const resolvedExcerpt =
        aiExcerpt ||
        articleForm.excerpt ||
        clampText(`Aprenda como aplicar ${resolvedKeyword} com foco em qualidade assistencial, segurança e eficiência no Home Care.`, 180);
      const limitedContent = clampContentHtmlByPlainChars(
        aiContent || buildFallbackArticleContent(resolvedKeyword, resolvedExcerpt),
        SEO_MAX_CONTENT_CHARS,
      );
      const resolvedContent = limitedContent.html;
      const resolvedCanonical =
        String(payload.seo_canonical_url || "").trim() ||
        articleForm.seo_canonical_url ||
        buildDefaultCanonicalUrl(resolvedSlug);
      const resolvedSeoRobots = String(payload.seo_robots || "").trim() || articleForm.seo_robots || "index,follow";
      const resolvedSeoTitle = fitSeoLengthRange(
        String(payload.seo_title || "").trim() || resolvedTitle,
        SEO_TITLE_MIN_CHARS,
        SEO_TITLE_MAX_CHARS,
        resolvedTitle || resolvedKeyword,
      );
      const resolvedSeoDescription = fitSeoLengthRange(
        String(payload.seo_description || "").trim() || resolvedExcerpt || stripAuditHtml(resolvedContent),
        SEO_DESCRIPTION_MIN_CHARS,
        SEO_DESCRIPTION_MAX_CHARS,
        resolvedExcerpt || "Conteudo informativo para orientar com qualidade e seguranca.",
      );
      const resolvedOgTitle = String(payload.seo_og_title || "").trim() || resolvedSeoTitle;
      const resolvedOgDescription = String(payload.seo_og_description || "").trim() || resolvedSeoDescription;
      const resolvedOgImage =
        String(payload.seo_og_image_url || "").trim() || articleForm.seo_og_image_url || articleForm.cover_image_url;
      const resolvedSchema =
        aiSchemaJson || articleForm.schema_json || buildDefaultSchemaJson(resolvedTitle, resolvedSlug, resolvedSeoDescription, resolvedKeyword);

      const suggestedTagIds = sortedTags
        .filter((tag) =>
          aiTagsSuggested.some(
            (name: string) =>
              generateSlug(String(name || "")) === generateSlug(String(tag.slug || "")) ||
              generateSlug(String(name || "")) === generateSlug(String(tag.name || "")),
          ),
        )
        .map((tag) => String(tag.id));

      setArticleForm((prev) => ({
        ...prev,
        title: resolvedTitle || prev.title,
        slug: resolvedSlug || prev.slug,
        excerpt: resolvedExcerpt || prev.excerpt,
        source_reference_url:
          String(payload.source_reference_url || "").trim() || sourceReferenceExternalUrl || prev.source_reference_url,
        content_html: resolvedContent || prev.content_html,
        focus_keyword: resolvedKeyword || prev.focus_keyword,
        seo_title: resolvedSeoTitle || prev.seo_title,
        seo_description: resolvedSeoDescription || prev.seo_description,
        seo_canonical_url: resolvedCanonical || prev.seo_canonical_url,
        seo_robots: resolvedSeoRobots || prev.seo_robots,
        seo_og_title: resolvedOgTitle || prev.seo_og_title,
        seo_og_description: resolvedOgDescription || prev.seo_og_description,
        seo_og_image_url: resolvedOgImage || prev.seo_og_image_url,
        reading_time_minutes:
          Number(payload.reading_time_minutes || 0) || Math.max(1, estimateReadingTime(resolvedContent || prev.content_html)),
        tag_ids: suggestedTagIds.length > 0 ? suggestedTagIds : prev.tag_ids,
        schema_json: resolvedSchema || prev.schema_json,
      }));

      setShowSeoAudit(true);
      if (!aiContent) {
        toast.warning("A IA não retornou o conteúdo completo na primeira resposta. Preenchemos um conteúdo-base otimizado para você revisar.");
      }
      if (limitedContent.wasTrimmed) {
        toast.warning(`Conteúdo ajustado automaticamente para no máximo ${SEO_MAX_CONTENT_CHARS} caracteres.`);
      }
      if (aiSeoPassed) {
        toast.success("Artigo gerado com IA dentro da faixa SEO de conteudo.");
      } else {
        toast.warning(
          `Artigo gerado com pendencias SEO: ${aiSeoIssues.slice(0, 3).join(" | ") || "revise checklist de SEO."}`,
        );
      }
    } catch (err: any) {
      const message = String(err?.message || "");
      const statusCode =
        Number(err?.status) ||
        Number(err?.context?.status) ||
        (/\b401\b/.test(message) ? 401 : undefined);

      if (statusCode === 404 || /not found|nao encontrada|requested function was not found/i.test(message)) {
        toast.error("Funcao generate-blog-article nao publicada no Supabase.");
      } else if (statusCode === 401 || /unauthorized|jwt|autenticacao/i.test(message)) {
        toast.error("Nao autorizado para usar a IA do blog. Faca login novamente.");
      } else if (statusCode === 403 || /somente administradores|acesso negado/i.test(message)) {
        toast.error("Apenas administradores podem gerar artigos com IA.");
      } else if (statusCode === 546 || /http 546|timeout|time-out|upstream/i.test(message)) {
        toast.error("A geracao demorou demais no servidor. Tente novamente com uma sugestao mais objetiva.");
      } else {
        toast.error(message || "Erro ao gerar artigo com IA.");
      }
    } finally {
      setGeneratingAI(null);
    }
  };

  const handleAutofillFromChatGptText = async () => {
    const rawSeed = String(chatGptSeedText || "").trim();
    if (!rawSeed) {
      toast.error("Cole um texto com a ideia ou conteúdo para preencher os campos automaticamente.");
      return;
    }

    const compactSeed = rawSeed.replace(/\s+/g, " ").trim();
    const maxSeedChars = 7000;
    const boundedSeed = compactSeed.slice(0, maxSeedChars);
    const referenceFromSeed = extractFirstExternalUrlFromText(rawSeed);
    const referenceUrl = sourceReferenceExternalUrl || referenceFromSeed || "";

    setAutofillingFromChatGpt(true);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente para usar a IA do blog.");
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-blog-article`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mode: "suggestion",
          suggestion: boundedSeed,
          source_reference_url: referenceUrl || null,
        }),
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          const message = typeof payload?.error === "string" ? payload.error : "";
          const extra = typeof payload?.details === "string" ? payload.details : "";
          const text = [message, extra].filter(Boolean).join(" - ");
          if (text) detail = text;
        } catch {
          // noop
        }
        const error = new Error(detail) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      const payload = await response.json();
      const aiTitle = String(payload.title || "").trim();
      const aiSlug = generateSlug(String(payload.slug || aiTitle || ""));
      const aiExcerpt = String(payload.excerpt || "").trim();
      const aiContent = stripContentH1Tags(String(payload.content_html || "").trim());
      const aiFocusKeyword = String(payload.focus_keyword || "").trim();
      const aiTagsSuggested = Array.isArray(payload.tags_suggested) ? payload.tags_suggested : [];
      const aiSeoIssues = Array.isArray(payload?.seo_issues)
        ? payload.seo_issues.map((item: unknown) => String(item || "").trim()).filter(Boolean)
        : [];
      const aiSeoPassed = payload?.seo_validation_passed !== false && aiSeoIssues.length === 0;
      const aiSchemaJsonRaw = payload?.schema_json;
      const aiSchemaJson =
        aiSchemaJsonRaw && typeof aiSchemaJsonRaw === "object"
          ? JSON.stringify(aiSchemaJsonRaw, null, 2)
          : String(aiSchemaJsonRaw || "").trim();

      const fallbackTitle = boundedSeed.split(/[.!?\n]/).map((part) => part.trim()).find(Boolean) || "Guia de Home Care";
      const resolvedTitle = aiTitle || clampText(fallbackTitle || articleForm.title || "Guia de Home Care", 120);
      const resolvedKeyword = aiFocusKeyword || articleForm.focus_keyword || resolvedTitle.split(":")[0].trim();
      const resolvedSlug = aiSlug || generateSlug(`${resolvedKeyword} ${resolvedTitle}`);
      const resolvedExcerpt =
        aiExcerpt ||
        articleForm.excerpt ||
        clampText(`Aprenda como aplicar ${resolvedKeyword} com foco em qualidade assistencial, seguranca e eficiencia no Home Care.`, 180);
      const limitedContent = clampContentHtmlByPlainChars(
        aiContent || buildFallbackArticleContent(resolvedKeyword, resolvedExcerpt),
        SEO_MAX_CONTENT_CHARS,
      );
      const resolvedContent = limitedContent.html;
      const resolvedCanonical =
        String(payload.seo_canonical_url || "").trim() ||
        articleForm.seo_canonical_url ||
        buildDefaultCanonicalUrl(resolvedSlug);
      const resolvedSeoRobots = String(payload.seo_robots || "").trim() || articleForm.seo_robots || "index,follow";
      const resolvedSeoTitle = fitSeoLengthRange(
        String(payload.seo_title || "").trim() || resolvedTitle,
        SEO_TITLE_MIN_CHARS,
        SEO_TITLE_MAX_CHARS,
        resolvedTitle || resolvedKeyword,
      );
      const resolvedSeoDescription = fitSeoLengthRange(
        String(payload.seo_description || "").trim() || resolvedExcerpt || stripAuditHtml(resolvedContent),
        SEO_DESCRIPTION_MIN_CHARS,
        SEO_DESCRIPTION_MAX_CHARS,
        resolvedExcerpt || "Conteudo informativo para orientar com qualidade e seguranca.",
      );
      const resolvedOgTitle = String(payload.seo_og_title || "").trim() || resolvedSeoTitle;
      const resolvedOgDescription = String(payload.seo_og_description || "").trim() || resolvedSeoDescription;
      const resolvedOgImage =
        String(payload.seo_og_image_url || "").trim() || articleForm.seo_og_image_url || articleForm.cover_image_url;

      const suggestedTagIds = sortedTags
        .filter((tag) =>
          aiTagsSuggested.some(
            (name: string) =>
              generateSlug(String(name || "")) === generateSlug(String(tag.slug || "")) ||
              generateSlug(String(name || "")) === generateSlug(String(tag.name || "")),
          ),
        )
        .map((tag) => String(tag.id));

      setArticleForm((prev) => ({
        ...prev,
        title: resolvedTitle || prev.title,
        slug: resolvedSlug || prev.slug,
        excerpt: resolvedExcerpt || prev.excerpt,
        source_reference_url:
          String(payload.source_reference_url || "").trim() ||
          referenceUrl ||
          prev.source_reference_url,
        content_html: resolvedContent || prev.content_html,
        focus_keyword: resolvedKeyword || prev.focus_keyword,
        seo_title: resolvedSeoTitle || prev.seo_title,
        seo_description: resolvedSeoDescription || prev.seo_description,
        seo_canonical_url: resolvedCanonical || prev.seo_canonical_url,
        seo_robots: resolvedSeoRobots || prev.seo_robots,
        seo_og_title: resolvedOgTitle || prev.seo_og_title,
        seo_og_description: resolvedOgDescription || prev.seo_og_description,
        seo_og_image_url: resolvedOgImage || prev.seo_og_image_url,
        reading_time_minutes:
          Number(payload.reading_time_minutes || 0) || Math.max(1, estimateReadingTime(resolvedContent || prev.content_html)),
        tag_ids: suggestedTagIds.length > 0 ? suggestedTagIds : prev.tag_ids,
        schema_json:
          aiSchemaJson ||
          prev.schema_json ||
          buildDefaultSchemaJson(resolvedTitle, resolvedSlug, resolvedSeoDescription, resolvedKeyword),
      }));

      setShowSeoAudit(true);
      setActiveTab("articles");

      if (compactSeed.length > maxSeedChars) {
        toast.warning(`Texto base reduzido para ${maxSeedChars} caracteres antes da geracao.`);
      }
      if (!referenceUrl && !String(payload.source_reference_url || "").trim()) {
        toast.info("Campos preenchidos sem URL de referência. Se quiser artigo baseado em fonte, informe um link.");
      }
      if (!aiContent) {
        toast.warning("A IA nao retornou todo o conteudo na primeira resposta. Preenchemos um conteudo-base para revisao.");
      }
      if (limitedContent.wasTrimmed) {
        toast.warning(`Conteudo ajustado automaticamente para no maximo ${SEO_MAX_CONTENT_CHARS} caracteres.`);
      }
      if (aiSeoPassed) {
        toast.success("Campos preenchidos automaticamente com base no texto informado.");
      } else {
        toast.warning(
          `Campos preenchidos com pendencias SEO: ${aiSeoIssues.slice(0, 3).join(" | ") || "revise checklist de SEO."}`,
        );
      }
    } catch (err: any) {
      const message = String(err?.message || "");
      const statusCode =
        Number(err?.status) ||
        Number(err?.context?.status) ||
        (/\b401\b/.test(message) ? 401 : undefined);

      if (statusCode === 404 || /not found|nao encontrada|requested function was not found/i.test(message)) {
        toast.error("Funcao generate-blog-article nao publicada no Supabase.");
      } else if (statusCode === 401 || /unauthorized|jwt|autenticacao/i.test(message)) {
        toast.error("Nao autorizado para usar a IA do blog. Faca login novamente.");
      } else if (statusCode === 403 || /somente administradores|acesso negado/i.test(message)) {
        toast.error("Apenas administradores podem gerar artigos com IA.");
      } else if (statusCode === 546 || /http 546|timeout|time-out|upstream/i.test(message)) {
        toast.error("A geracao demorou demais no servidor. Tente novamente com um texto mais objetivo.");
      } else {
        toast.error(message || "Erro ao preencher campos automaticamente com IA.");
      }
    } finally {
      setAutofillingFromChatGpt(false);
    }
  };

  const handleAutofillFromChatGptTextLocal = () => {
    const rawSeed = String(chatGptSeedText || "").trim();
    if (!rawSeed) {
      toast.error("Cole um texto com a ideia ou conteúdo para preencher os campos automaticamente.");
      return;
    }

    setAutofillingLocally(true);
    try {
      const referenceFromSeed = extractFirstExternalUrlFromText(rawSeed);
      const fallbackTitle = deriveTitleFromSeed(rawSeed);
      const resolvedTitle = clampText(fallbackTitle || articleForm.title || "Guia de Home Care", 120);
      const resolvedKeyword =
        clampText(articleForm.focus_keyword || deriveFocusKeywordFromTitle(resolvedTitle), SEO_FOCUS_KEYWORD_MAX_CHARS) ||
        "home care";
      const resolvedSlug = generateSlug(articleForm.slug || `${resolvedKeyword} ${resolvedTitle}`);

      const parsedHtml = parseSeedTextToHtml(rawSeed);
      const normalizedSource = stripAuditHtml(parsedHtml);
      const sourceExcerpt = normalizedSource.slice(0, SEO_EXCERPT_MAX_CHARS).trim();
      const resolvedExcerpt = fitSeoLengthRange(
        articleForm.excerpt || sourceExcerpt || `Saiba como aplicar ${resolvedKeyword} no atendimento domiciliar com segurança e qualidade.`,
        SEO_EXCERPT_MIN_CHARS,
        SEO_EXCERPT_MAX_CHARS,
        `Aprenda a aplicar ${resolvedKeyword} com foco em segurança, eficiência e resultados no Home Care.`,
      );

      const fallbackContent = buildFallbackArticleContent(resolvedKeyword, resolvedExcerpt);
      const chosenContent = parsedHtml || fallbackContent;
      const mergedContent =
        stripAuditHtml(chosenContent).length < 1600 && parsedHtml
          ? `${chosenContent}\n${fallbackContent}`
          : chosenContent;
      const limitedContent = clampContentHtmlByPlainChars(mergedContent, SEO_MAX_CONTENT_CHARS);
      const resolvedContent = limitedContent.html;

      const resolvedCanonical =
        articleForm.seo_canonical_url ||
        buildDefaultCanonicalUrl(resolvedSlug);
      const resolvedSeoTitle = fitSeoLengthRange(
        articleForm.seo_title || resolvedTitle,
        SEO_TITLE_MIN_CHARS,
        SEO_TITLE_MAX_CHARS,
        `${resolvedTitle} | Home Care Match`,
      );
      const resolvedSeoDescription = fitSeoLengthRange(
        articleForm.seo_description || resolvedExcerpt || stripAuditHtml(resolvedContent),
        SEO_DESCRIPTION_MIN_CHARS,
        SEO_DESCRIPTION_MAX_CHARS,
        `Entenda como aplicar ${resolvedKeyword} em atendimentos de Home Care com práticas claras e seguras.`,
      );
      const resolvedOgTitle = articleForm.seo_og_title || resolvedSeoTitle;
      const resolvedOgDescription = articleForm.seo_og_description || resolvedSeoDescription;

      const searchCorpus = normalizeLooseText(
        `${resolvedTitle} ${resolvedExcerpt} ${stripAuditHtml(resolvedContent)} ${resolvedKeyword}`,
      );
      const inferredTagIds = sortedTags
        .filter((tag) => {
          const tagName = normalizeLooseText(String(tag?.name || ""));
          const tagSlug = normalizeLooseText(String(tag?.slug || "").replace(/-/g, " "));
          if (!tagName && !tagSlug) return false;
          return (tagName && searchCorpus.includes(tagName)) || (tagSlug && searchCorpus.includes(tagSlug));
        })
        .map((tag) => String(tag.id))
        .slice(0, 8);

      setArticleForm((prev) => ({
        ...prev,
        title: resolvedTitle || prev.title,
        slug: resolvedSlug || prev.slug,
        excerpt: resolvedExcerpt || prev.excerpt,
        source_reference_url: prev.source_reference_url || referenceFromSeed || "",
        content_html: resolvedContent || prev.content_html,
        focus_keyword: resolvedKeyword || prev.focus_keyword,
        seo_title: resolvedSeoTitle || prev.seo_title,
        seo_description: resolvedSeoDescription || prev.seo_description,
        seo_canonical_url: resolvedCanonical || prev.seo_canonical_url,
        seo_robots: prev.seo_robots || "index,follow",
        seo_og_title: resolvedOgTitle || prev.seo_og_title,
        seo_og_description: resolvedOgDescription || prev.seo_og_description,
        reading_time_minutes: Math.max(1, estimateReadingTime(resolvedContent || prev.content_html)),
        tag_ids: inferredTagIds.length > 0 ? inferredTagIds : prev.tag_ids,
        schema_json:
          prev.schema_json ||
          buildDefaultSchemaJson(resolvedTitle, resolvedSlug, resolvedSeoDescription, resolvedKeyword),
      }));

      setShowSeoAudit(true);
      setActiveTab("articles");

      if (limitedContent.wasTrimmed) {
        toast.warning(`Conteúdo ajustado automaticamente para no máximo ${SEO_MAX_CONTENT_CHARS} caracteres.`);
      }
      toast.success("Campos preenchidos localmente com base no texto colado.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao preencher os campos localmente.");
    } finally {
      setAutofillingLocally(false);
    }
  };

  const handleOptimizeSeoField = async (field: SeoAiOptimizableField) => {
    const getAiAccessToken = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";
      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente para usar a IA.");
      }
      return accessToken;
    };

    const requestOptimizedSeoField = async (
      targetField: SeoAiOptimizableField,
      sourceForm: BlogArticleForm,
      accessToken: string,
    ) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/optimize-blog-seo-field`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          field: targetField,
          current_value: String(sourceForm[targetField] || ""),
          context: {
            title: sourceForm.title,
            slug: sourceForm.slug,
            excerpt: sourceForm.excerpt,
            focus_keyword: sourceForm.focus_keyword,
            content_html: sourceForm.content_html,
            cover_image_url: sourceForm.cover_image_url,
            seo_title: sourceForm.seo_title,
            seo_description: sourceForm.seo_description,
            seo_canonical_url: sourceForm.seo_canonical_url,
            seo_robots: sourceForm.seo_robots,
            seo_og_title: sourceForm.seo_og_title,
            seo_og_description: sourceForm.seo_og_description,
            seo_og_image_url: sourceForm.seo_og_image_url,
            source_reference_url: sourceForm.source_reference_url,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || `HTTP ${response.status}`));
      }

      const optimized = String(payload?.value || "").trim();
      if (!optimized) throw new Error("A IA nao retornou valor para este campo.");
      return optimized;
    };

    const applyOptimizedField = (
      sourceForm: BlogArticleForm,
      targetField: SeoAiOptimizableField,
      optimizedValue: string,
    ) => {
      const next = { ...sourceForm };
      if (targetField === "slug") {
        next.slug = generateSlug(optimizedValue);
        return next;
      }
      if (targetField === "content_html") {
        const normalizedHtml = clampContentHtmlByPlainChars(optimizedValue, SEO_MAX_CONTENT_CHARS).html;
        next.content_html = normalizedHtml;
        next.reading_time_minutes = Math.max(1, estimateReadingTime(normalizedHtml));
        return next;
      }
      (next as any)[targetField] = optimizedValue;
      return next;
    };

    setOptimizingSeoField(field);
    try {
      const accessToken = await getAiAccessToken();
      const optimized = await requestOptimizedSeoField(field, articleForm, accessToken);
      setArticleForm((prev) => applyOptimizedField(prev, field, optimized));
      toast.success("Campo otimizado com IA.");
    } catch (err: any) {
      const message = String(err?.message || "");
      if (/not found|nao encontrada|requested function was not found|404/i.test(message)) {
        toast.error("Funcao optimize-blog-seo-field nao publicada no Supabase.");
      } else if (/401|unauthorized|jwt|autenticacao/i.test(message)) {
        toast.error("Nao autorizado para otimizar este campo. Faca login novamente.");
      } else if (/403|somente administradores|acesso negado/i.test(message)) {
        toast.error("Apenas administradores podem usar IA de SEO.");
      } else {
        toast.error(message || "Erro ao otimizar campo com IA.");
      }
    } finally {
      setOptimizingSeoField(null);
    }
  };

  const handleAutoFixSeoPendencies = async () => {
    if (autoFixingSeo || savingArticle || !!optimizingSeoField) return;

    const pending = seoAuditReport.items.filter((item) => !item.passed);
    if (pending.length === 0) {
      toast.success("Nao ha pendencias SEO para corrigir.");
      return;
    }

    const getAiAccessToken = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";
      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente para usar a IA.");
      }
      return accessToken;
    };

    const requestOptimizedSeoField = async (
      targetField: SeoAiOptimizableField,
      sourceForm: BlogArticleForm,
      accessToken: string,
    ) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/optimize-blog-seo-field`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          field: targetField,
          current_value: String(sourceForm[targetField] || ""),
          context: {
            title: sourceForm.title,
            slug: sourceForm.slug,
            excerpt: sourceForm.excerpt,
            focus_keyword: sourceForm.focus_keyword,
            content_html: sourceForm.content_html,
            cover_image_url: sourceForm.cover_image_url,
            seo_title: sourceForm.seo_title,
            seo_description: sourceForm.seo_description,
            seo_canonical_url: sourceForm.seo_canonical_url,
            seo_robots: sourceForm.seo_robots,
            seo_og_title: sourceForm.seo_og_title,
            seo_og_description: sourceForm.seo_og_description,
            seo_og_image_url: sourceForm.seo_og_image_url,
            source_reference_url: sourceForm.source_reference_url,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || `HTTP ${response.status}`));
      }
      const optimized = String(payload?.value || "").trim();
      if (!optimized) throw new Error("A IA nao retornou valor para este campo.");
      return optimized;
    };

    const applyOptimizedField = (
      sourceForm: BlogArticleForm,
      targetField: SeoAiOptimizableField,
      optimizedValue: string,
    ) => {
      const next = { ...sourceForm };
      if (targetField === "slug") {
        next.slug = generateSlug(optimizedValue);
        return next;
      }
      if (targetField === "content_html") {
        const normalizedHtml = clampContentHtmlByPlainChars(optimizedValue, SEO_MAX_CONTENT_CHARS).html;
        next.content_html = normalizedHtml;
        next.reading_time_minutes = Math.max(1, estimateReadingTime(normalizedHtml));
        return next;
      }
      (next as any)[targetField] = optimizedValue;
      return next;
    };

    setAutoFixingSeo(true);
    setShowSeoAudit(true);
    try {
      const accessToken = await getAiAccessToken();
      let workingForm: BlogArticleForm = { ...articleForm };
      const pendingIds = new Set(pending.map((item) => item.id));

      const contentDrivenIds = new Set([
        "min-content",
        "h2-range",
        "h3-min",
        "keyword-density",
        "keyword-first-paragraph",
        "keyword-h2",
        "keyword-conclusion",
        "intro-size",
        "conclusion-size",
        "faq",
        "links-internal",
        "links-external",
      ]);

      const queue: SeoAiOptimizableField[] = [];
      if (!workingForm.focus_keyword.trim()) queue.push("focus_keyword");
      if (Array.from(pendingIds).some((id) => contentDrivenIds.has(id))) queue.push("content_html");
      if (pendingIds.has("keyword-slug")) queue.push("slug");
      if (pendingIds.has("seo-title-length")) queue.push("seo_title");
      if (pendingIds.has("meta-length") || pendingIds.has("keyword-meta")) queue.push("seo_description");

      if (!queue.includes("seo_title")) queue.push("seo_title");
      if (!queue.includes("seo_description")) queue.push("seo_description");
      if (!queue.includes("seo_og_title")) queue.push("seo_og_title");
      if (!queue.includes("seo_og_description")) queue.push("seo_og_description");

      const uniqueQueue = Array.from(new Set(queue));
      for (const field of uniqueQueue) {
        setOptimizingSeoField(field);
        const optimized = await requestOptimizedSeoField(field, workingForm, accessToken);
        workingForm = applyOptimizedField(workingForm, field, optimized);
        setArticleForm(workingForm);
      }

      const finalReport = computeSeoAuditReport(workingForm);
      const remaining = finalReport.total - finalReport.passed;
      if (remaining === 0) {
        toast.success("Todas as pendencias SEO foram resolvidas com IA.");
      } else {
        toast.warning(`IA aplicou correcoes. Restaram ${remaining} pendencia(s) para ajuste manual.`);
      }
    } catch (err: any) {
      const message = String(err?.message || "");
      if (/not found|nao encontrada|requested function was not found|404/i.test(message)) {
        toast.error("Funcao optimize-blog-seo-field nao publicada no Supabase.");
      } else if (/401|unauthorized|jwt|autenticacao/i.test(message)) {
        toast.error("Nao autorizado para otimizar com IA. Faca login novamente.");
      } else if (/403|somente administradores|acesso negado/i.test(message)) {
        toast.error("Apenas administradores podem usar IA de SEO.");
      } else {
        toast.error(message || "Erro ao resolver pendencias SEO com IA.");
      }
    } finally {
      setOptimizingSeoField(null);
      setAutoFixingSeo(false);
    }
  };

  const runTagAI = async (createMissingTags: boolean) => {
    if (!createMissingTags && sortedTags.length === 0) {
      toast.error("Cadastre tags antes de usar a IA para preencher este campo.");
      return;
    }

    const hasMinimumContext = [articleForm.title, articleForm.excerpt, articleForm.focus_keyword, articleForm.content_html]
      .some((field) => String(field || "").trim().length > 0);

    if (!hasMinimumContext) {
      toast.error("Preencha ao menos titulo, resumo, palavra-chave ou conteudo do artigo antes de gerar tags.");
      return;
    }

    if (createMissingTags) setCreatingTagsAI(true);
    else setGeneratingTagsAI(true);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente para usar a IA.");
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-blog-tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: articleForm.title,
          excerpt: articleForm.excerpt,
          focus_keyword: articleForm.focus_keyword,
          content_html: articleForm.content_html,
          create_missing_tags: createMissingTags,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || `HTTP ${response.status}`));
      }

      const suggestedIds = Array.isArray(payload?.selected_tag_ids)
        ? payload.selected_tag_ids.map((id: unknown) => String(id || "").trim()).filter(Boolean)
        : [];
      const createdCount = Number(payload?.created_count || 0);

      if (suggestedIds.length === 0) {
        throw new Error("A IA nao encontrou tags compativeis para este artigo.");
      }

      setArticleForm((prev) => ({
        ...prev,
        tag_ids: createMissingTags
          ? Array.from(new Set([...prev.tag_ids, ...suggestedIds]))
          : Array.from(new Set(suggestedIds)),
      }));

      if (createMissingTags && createdCount > 0) {
        await fetchAll();
      }

      if (createMissingTags) {
        toast.success(
          createdCount > 0
            ? `${createdCount} nova(s) tag(s) criada(s) e ${suggestedIds.length} tag(s) selecionada(s).`
            : `${suggestedIds.length} tag(s) selecionada(s). Nenhuma nova tag precisou ser criada.`,
        );
      } else {
        toast.success(`${suggestedIds.length} tag(s) preenchida(s) com IA.`);
      }
    } catch (err: any) {
      const message = String(err?.message || "");
      if (/not found|nao encontrada|requested function was not found|404/i.test(message)) {
        toast.error("Funcao generate-blog-tags nao publicada no Supabase.");
      } else if (/401|unauthorized|jwt|autenticacao/i.test(message)) {
        toast.error("Nao autorizado para usar IA de tags. Faca login novamente.");
      } else if (/403|somente administradores|acesso negado/i.test(message)) {
        toast.error("Apenas administradores podem usar IA para tags.");
      } else {
        toast.error(message || "Erro ao processar tags com IA.");
      }
    } finally {
      if (createMissingTags) setCreatingTagsAI(false);
      else setGeneratingTagsAI(false);
    }
  };

  const handlePopulateTagsWithAI = async () => {
    await runTagAI(false);
  };

  const handleSuggestAndCreateTagsWithAI = async () => {
    await runTagAI(true);
  };

  const fetchCoverCandidateFromAI = async ({
    excludedUrls = [],
    context,
  }: {
    excludedUrls?: string[];
    context?: Partial<{
      title: string;
      suggestion: string;
      excerpt: string;
      focus_keyword: string;
      content_html: string;
    }>;
  } = {}): Promise<CoverCandidate> => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    const { data: refreshed } = await supabase.auth.refreshSession();
    const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

    if (!accessToken) {
      throw new Error("Sessao expirada. Faca login novamente para gerar capa com IA.");
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-blog-cover-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: context?.title ?? articleForm.title,
        suggestion: context?.suggestion ?? aiSuggestion,
        excerpt: context?.excerpt ?? articleForm.excerpt,
        focus_keyword: context?.focus_keyword ?? articleForm.focus_keyword,
        content_html: context?.content_html ?? articleForm.content_html,
        excluded_urls: excludedUrls,
      }),
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        const message = typeof payload?.error === "string" ? payload.error : "";
        const extra = typeof payload?.details === "string" ? payload.details : "";
        const text = [message, extra].filter(Boolean).join(" - ");
        if (text) detail = text;
      } catch {
        // noop
      }
      throw new Error(detail);
    }

    const payload = await response.json();
    const imageUrl = String(payload?.cover_image_url || "").trim();
    if (!imageUrl) {
      throw new Error("A IA nao retornou uma URL valida para a imagem.");
    }

    return {
      cover_image_url: imageUrl,
      alt_text: String(payload?.alt_text || "").trim(),
      query_used: String(payload?.query_used || "").trim(),
      provider: String(payload?.provider || "").trim(),
      photographer: payload?.photographer || null,
      photographer_url: payload?.photographer_url || null,
      source_page: payload?.source_page || null,
    };
  };

  const requestCoverCandidate = async (excludedUrls: string[] = []) => {
    const candidate = await fetchCoverCandidateFromAI({ excludedUrls });
    setCoverCandidate(candidate);
    setCoverPreviewOpen(true);
  };

  const handleGenerateResearchThemes = async () => {
    setLoadingResearchThemes(true);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";
      if (!accessToken) throw new Error("Sessao expirada. Faca login novamente.");

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-blog-research-themes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || `HTTP ${response.status}`));
      }

      const themes = ensureTenResearchThemes(payload?.themes || []);
      if (themes.length === 0) {
        throw new Error("A IA nao retornou temas validos para pesquisa.");
      }

      setResearchThemes(themes);
      if (!themes.some((theme) => theme.id === researchTheme)) {
        setResearchTheme(themes[0].id);
      }
      toast.success("IA gerou 10 novos temas de pesquisa para Home Care.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar temas com IA.");
      setResearchThemes((prev) => (prev.length > 0 ? prev : BLOG_RESEARCH_DEFAULT_THEMES));
      if (!researchTheme) setResearchTheme(BLOG_RESEARCH_DEFAULT_THEMES[0].id);
    } finally {
      setLoadingResearchThemes(false);
    }
  };

  const handleSearchResearchTopics = async () => {
    if (!selectedResearchTheme) {
      toast.error("Selecione um tema de pesquisa.");
      return;
    }

    setResearchingTopics(true);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";
      if (!accessToken) throw new Error("Sessao expirada. Faca login novamente.");

      const response = await fetch(`${SUPABASE_URL}/functions/v1/discover-blog-topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          theme_id: researchTheme,
          theme_payload: selectedResearchTheme,
          limit: 10,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const normalizedResults: BlogResearchResult[] = results
        .map((item: any, index: number) => ({
          id: String(item?.id || `${index}-${item?.url || item?.title || "tema"}`),
          title: String(item?.title || "").trim(),
          url: String(item?.url || "").trim(),
          summary: String(item?.summary || "").trim(),
          source: String(item?.source || "").trim(),
          source_url: item?.source_url || null,
          published_at: item?.published_at || null,
          provider: item?.provider || "",
        }))
        .filter((item: BlogResearchResult) => !!item.title && !!item.url);

      setResearchResults(normalizedResults);

      if (!response.ok) {
        throw new Error(String(payload?.error || `HTTP ${response.status}`));
      }

      toast.success(`${normalizedResults.length} temas encontrados para gerar artigo.`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao pesquisar temas.");
    } finally {
      setResearchingTopics(false);
    }
  };

  const handleGenerateArticleFromResearch = async (result: BlogResearchResult) => {
    setGeneratingFromResearchId(result.id);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

      if (!accessToken) {
        throw new Error("Sessao expirada. Faca login novamente para usar a IA do blog.");
      }

      const suggestion = `Tema para artigo: ${result.title}\nFonte de referencia: ${result.url}\nResumo: ${result.summary || ""}`;

      const articleResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-blog-article`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          mode: "suggestion",
          suggestion,
          source_reference_url: result.url || null,
        }),
      });

      const articlePayload = await articleResponse.json().catch(() => ({}));
      if (!articleResponse.ok) {
        const detail = String(articlePayload?.error || `HTTP ${articleResponse.status}`);
        const error = new Error(detail) as Error & { status?: number };
        error.status = articleResponse.status;
        throw error;
      }

      const aiTitle = String(articlePayload.title || "").trim();
      const aiSlug = generateSlug(String(articlePayload.slug || aiTitle || ""));
      const aiExcerpt = String(articlePayload.excerpt || "").trim();
      const aiContent = stripContentH1Tags(String(articlePayload.content_html || "").trim());
      const aiFocusKeyword = String(articlePayload.focus_keyword || "").trim();
      const aiTagsSuggested = Array.isArray(articlePayload.tags_suggested) ? articlePayload.tags_suggested : [];
      const aiSeoIssues = Array.isArray(articlePayload?.seo_issues)
        ? articlePayload.seo_issues.map((item: unknown) => String(item || "").trim()).filter(Boolean)
        : [];
      const aiSeoPassed = articlePayload?.seo_validation_passed !== false && aiSeoIssues.length === 0;
      const aiSchemaJsonRaw = articlePayload?.schema_json;
      const aiSchemaJson =
        aiSchemaJsonRaw && typeof aiSchemaJsonRaw === "object"
          ? JSON.stringify(aiSchemaJsonRaw, null, 2)
          : String(aiSchemaJsonRaw || "").trim();

      const resolvedTitle = aiTitle || clampText(result.title || articleForm.title || "Guia de Home Care", 120);
      const resolvedKeyword = aiFocusKeyword || articleForm.focus_keyword || resolvedTitle.split(":")[0].trim();
      const resolvedSlug = aiSlug || generateSlug(`${resolvedKeyword} ${resolvedTitle}`);
      const resolvedExcerpt =
        aiExcerpt ||
        clampText(result.summary || articleForm.excerpt || `Saiba como aplicar ${resolvedKeyword} com foco em segurança e qualidade no Home Care.`, 180);
      const limitedContent = clampContentHtmlByPlainChars(
        aiContent || buildFallbackArticleContent(resolvedKeyword, resolvedExcerpt),
        SEO_MAX_CONTENT_CHARS,
      );
      const resolvedContent = limitedContent.html;
      const resolvedCanonical =
        String(articlePayload.seo_canonical_url || "").trim() ||
        articleForm.seo_canonical_url ||
        buildDefaultCanonicalUrl(resolvedSlug);
      const resolvedSeoRobots = String(articlePayload.seo_robots || "").trim() || articleForm.seo_robots || "index,follow";
      const resolvedSeoTitle = fitSeoLengthRange(
        String(articlePayload.seo_title || "").trim() || resolvedTitle,
        SEO_TITLE_MIN_CHARS,
        SEO_TITLE_MAX_CHARS,
        resolvedTitle || resolvedKeyword,
      );
      const resolvedSeoDescription = fitSeoLengthRange(
        String(articlePayload.seo_description || "").trim() || resolvedExcerpt || stripAuditHtml(resolvedContent),
        SEO_DESCRIPTION_MIN_CHARS,
        SEO_DESCRIPTION_MAX_CHARS,
        resolvedExcerpt || "Conteudo informativo para orientar com qualidade e seguranca.",
      );
      const resolvedOgTitle = String(articlePayload.seo_og_title || "").trim() || resolvedSeoTitle;
      const resolvedOgDescription = String(articlePayload.seo_og_description || "").trim() || resolvedSeoDescription;

      const suggestedTagIds = sortedTags
        .filter((tag) =>
          aiTagsSuggested.some(
            (name: string) =>
              generateSlug(String(name || "")) === generateSlug(String(tag.slug || "")) ||
              generateSlug(String(name || "")) === generateSlug(String(tag.name || "")),
          ),
        )
        .map((tag) => String(tag.id));

      let coverImageUrl = "";
      try {
        const coverCandidate = await fetchCoverCandidateFromAI({
          context: {
            title: aiTitle,
            suggestion: result.title,
            excerpt: aiExcerpt,
            focus_keyword: aiFocusKeyword,
            content_html: aiContent,
          },
        });
        coverImageUrl = String(coverCandidate.cover_image_url || "").trim();
      } catch (coverErr: any) {
        toast.error(coverErr?.message || "Nao foi possivel gerar capa automatica para este tema.");
      }

      setArticleForm((prev) => ({
        ...prev,
        title: resolvedTitle || prev.title,
        slug: resolvedSlug || prev.slug,
        excerpt: resolvedExcerpt || prev.excerpt,
        source_reference_url: result.url || prev.source_reference_url,
        cover_image_url: coverImageUrl || prev.cover_image_url,
        content_html: resolvedContent || prev.content_html,
        focus_keyword: resolvedKeyword || prev.focus_keyword,
        seo_title: resolvedSeoTitle || prev.seo_title,
        seo_description: resolvedSeoDescription || prev.seo_description,
        seo_canonical_url: resolvedCanonical || prev.seo_canonical_url,
        seo_robots: resolvedSeoRobots || prev.seo_robots,
        seo_og_title: resolvedOgTitle || prev.seo_og_title,
        seo_og_description: resolvedOgDescription || prev.seo_og_description,
        seo_og_image_url: String(articlePayload.seo_og_image_url || "").trim() || prev.seo_og_image_url || coverImageUrl || prev.cover_image_url,
        reading_time_minutes:
          Number(articlePayload.reading_time_minutes || 0) || Math.max(1, estimateReadingTime(resolvedContent || prev.content_html)),
        tag_ids: suggestedTagIds.length > 0 ? suggestedTagIds : prev.tag_ids,
        schema_json:
          aiSchemaJson ||
          prev.schema_json ||
          buildDefaultSchemaJson(resolvedTitle, resolvedSlug, resolvedSeoDescription, resolvedKeyword),
      }));

      setActiveTab("articles");
      setShowSeoAudit(true);
      if (!aiContent) {
        toast.warning("A IA não retornou o conteúdo completo na primeira resposta. Preenchemos um conteúdo-base otimizado para você revisar.");
      }
      if (limitedContent.wasTrimmed) {
        toast.warning(`Conteúdo ajustado automaticamente para no máximo ${SEO_MAX_CONTENT_CHARS} caracteres.`);
      }
      if (aiSeoPassed) toast.success("Artigo gerado com tema pesquisado e preenchido no editor.");
      else toast.warning("Artigo gerado com pendencias SEO. Revise com o checklist antes de publicar.");
    } catch (err: any) {
      const message = String(err?.message || "");
      const statusCode =
        Number(err?.status) ||
        Number(err?.context?.status) ||
        (/\b546\b/.test(message) ? 546 : undefined);

      if (statusCode === 546 || /http 546|timeout|time-out|upstream/i.test(message)) {
        toast.error("A geracao estourou tempo no servidor. Tente novamente com um tema mais objetivo.");
      } else {
        toast.error(message || "Erro ao gerar artigo com tema pesquisado.");
      }
    } finally {
      setGeneratingFromResearchId(null);
    }
  };

  const handleGenerateCoverImage = async () => {
    const hasContext =
      !!articleForm.title.trim() ||
      !!articleForm.excerpt.trim() ||
      !!articleForm.focus_keyword.trim() ||
      !!aiSuggestion.trim() ||
      !!articleForm.content_html.replace(/<[^>]+>/g, " ").trim();

    if (!hasContext) {
      toast.error("Informe titulo, resumo, palavra-chave ou sugestao para gerar a capa.");
      return;
    }

    setGeneratingCoverImage(true);
    setCoverCandidate(null);
    setRejectedCoverUrls([]);
    setCoverPreviewOpen(true);
    try {
      await requestCoverCandidate([]);
      toast.success("Capa gerada. Revise no preview e aprove ou rejeite.");
    } catch (err: any) {
      setCoverPreviewOpen(false);
      toast.error(err?.message || "Erro ao gerar capa com IA.");
    } finally {
      setGeneratingCoverImage(false);
    }
  };

  const handleApproveCoverImage = () => {
    if (!coverCandidate?.cover_image_url) return;
    setArticleForm((prev) => ({ ...prev, cover_image_url: coverCandidate.cover_image_url }));
    setCoverPreviewOpen(false);
    setCoverCandidate(null);
    setRejectedCoverUrls([]);
    toast.success("Capa aprovada e aplicada ao artigo.");
  };

  const handleRejectCoverImage = async () => {
    if (!coverCandidate?.cover_image_url) return;

    const rejectionKey = String(coverCandidate.source_page || coverCandidate.cover_image_url || "").trim();
    const canStoreRejection = !!rejectionKey && !rejectionKey.startsWith("data:");
    const nextExcluded = canStoreRejection
      ? Array.from(new Set([...rejectedCoverUrls, rejectionKey]))
      : rejectedCoverUrls;

    setRejectedCoverUrls(nextExcluded);
    setGeneratingCoverImage(true);
    try {
      await requestCoverCandidate(nextExcluded);
      toast.success("Nova opção de capa gerada.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar nova opção de capa.");
    } finally {
      setGeneratingCoverImage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSyncSchema} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Sincronizar Base
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 md:w-[640px]">
          <TabsTrigger value="articles">Artigos</TabsTrigger>
          <TabsTrigger value="ai-settings">Configurações IA</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Artigos</CardTitle>
              <CardDescription>Gerencie conteúdos do blog e status de publicação.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Score SEO</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.length > 0 ? (
                    articles.map((article) => (
                      <TableRow key={article.id}>
                        {(() => {
                          const score = articleSeoScoreById.get(String(article.id)) ?? 0;
                          const scoreTone =
                            score >= 85
                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                              : score >= 70
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-rose-100 text-rose-700 border border-rose-200";
                          return (
                            <>
                              <TableCell className="font-medium">{article.title}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{article.slug}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={scoreTone}>
                                  {score}%
                                </Badge>
                              </TableCell>
                            </>
                          );
                        })()}
                        <TableCell>
                          <Badge variant={article.status === "published" ? "default" : "secondary"}>
                            {article.status === "published" ? "Publicado" : "Rascunho"}
                          </Badge>
                        </TableCell>
                        <TableCell>{article.category?.name || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => applyArticleToForm(article)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete("blog_articles", article.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhum artigo cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{articleForm.id ? "Editar artigo" : "Novo artigo"}</CardTitle>
                  <CardDescription>
                    Conteúdo, SEO completo e schema otimizado para Google.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={resetArticleForm} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 rounded-xl border border-border/70 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Bot className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Assistente de IA para Artigos</p>
                    <p className="text-xs text-muted-foreground">
                      Gere um artigo por sugestão ou deixe a IA escolher um tema estratégico para a plataforma.
                    </p>
                  </div>
                </div>
                <Textarea
                  value={aiSuggestion}
                  onChange={(e) => setAiSuggestion(e.target.value)}
                  placeholder="Sugestão opcional: Ex. Como reduzir turnover em equipes de Home Care"
                  rows={3}
                />
                <div className="space-y-2">
                  <Label>Texto base do ChatGPT (ideia ou conteúdo)</Label>
                  <Textarea
                    value={chatGptSeedText}
                    onChange={(e) => setChatGptSeedText(e.target.value)}
                    placeholder="Cole aqui um texto do ChatGPT para preencher automaticamente título, resumo, conteúdo e campos SEO."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se o texto tiver uma URL de referência, ela será detectada automaticamente.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleGenerateAI("suggestion")}
                    disabled={!!generatingAI}
                  >
                    {generatingAI === "suggestion" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Gerar com sugestão
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleGenerateAI("automatic")}
                    disabled={!!generatingAI}
                  >
                    {generatingAI === "automatic" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                    IA escolhe tema relevante
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={handleAutofillFromChatGptText}
                    disabled={!!generatingAI || autofillingFromChatGpt}
                  >
                    {autofillingFromChatGpt ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Preencher campos automaticamente
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleAutofillFromChatGptTextLocal}
                    disabled={!!generatingAI || autofillingFromChatGpt || autofillingLocally}
                  >
                    {autofillingLocally ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4" />
                    )}
                    Usar texto colado sem IA
                  </Button>
                </div>
              </div>

              <form onSubmit={(event) => void handleSaveArticle(event, "continue")} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Título</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => handleOptimizeSeoField("title")}
                        disabled={optimizingSeoField === "title"}
                      >
                        {optimizingSeoField === "title" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        IA SEO
                      </Button>
                    </div>
                    <Input
                      value={articleForm.title}
                      onChange={(e) =>
                        setArticleForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                          slug: prev.id ? prev.slug : generateSlug(e.target.value),
                        }))
                      }
                    />
                    <SeoLengthHint value={articleForm.title} min={SEO_TITLE_MIN_CHARS} max={SEO_TITLE_MAX_CHARS} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Slug</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => handleOptimizeSeoField("slug")}
                        disabled={optimizingSeoField === "slug"}
                      >
                        {optimizingSeoField === "slug" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        IA SEO
                      </Button>
                    </div>
                    <Input
                      value={articleForm.slug}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, slug: generateSlug(e.target.value) }))}
                    />
                    <SeoMaxLengthHint value={articleForm.slug} max={SEO_SLUG_MAX_CHARS} />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Resumo (excerpt)</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      onClick={() => handleOptimizeSeoField("excerpt")}
                      disabled={optimizingSeoField === "excerpt"}
                    >
                      {optimizingSeoField === "excerpt" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      IA SEO
                    </Button>
                  </div>
                  <Textarea
                    value={articleForm.excerpt}
                    onChange={(e) => setArticleForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                    rows={3}
                  />
                  <SeoLengthHint value={articleForm.excerpt} min={SEO_EXCERPT_MIN_CHARS} max={SEO_EXCERPT_MAX_CHARS} />
                </div>

                <div className="space-y-2">
                  <Label>URL de referencia do artigo</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={articleForm.source_reference_url}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, source_reference_url: e.target.value }))}
                      placeholder="https://..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 sm:shrink-0"
                      onClick={() => window.open(sourceReferenceExternalUrl, "_blank", "noopener,noreferrer")}
                      disabled={!sourceReferenceExternalUrl}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir referencia
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Imagem de capa (URL)</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={articleForm.cover_image_url}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, cover_image_url: e.target.value }))}
                      placeholder="https://..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2 sm:shrink-0"
                      onClick={handleGenerateCoverImage}
                      disabled={generatingCoverImage}
                    >
                      {generatingCoverImage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Gerar capa com IA
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usa titulo, resumo, palavra-chave e sugestao para buscar a melhor imagem automaticamente.
                  </p>
                  {coverImagePreviewUrl ? (
                    <div className="overflow-hidden rounded-lg border border-border/70 bg-background">
                      <img
                        src={coverImagePreviewUrl}
                        alt={articleForm.title || "Previa da imagem de capa"}
                        className="h-56 w-full object-cover"
                        loading="lazy"
                      />
                      <div className="flex items-center justify-end border-t border-border/60 p-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => window.open(coverImagePreviewUrl, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Abrir imagem
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Conteúdo do artigo</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      onClick={() => handleOptimizeSeoField("content_html")}
                      disabled={optimizingSeoField === "content_html"}
                    >
                      {optimizingSeoField === "content_html" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      IA SEO
                    </Button>
                  </div>
                  <RichTextEditor
                    content={articleForm.content_html}
                    enableHtmlModeToggle
                    showHeadingHints
                    onChange={(html) =>
                      setArticleForm((prev) => ({
                        ...prev,
                        content_html: stripContentH1Tags(html),
                        reading_time_minutes: Math.max(1, estimateReadingTime(stripContentH1Tags(html))),
                      }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={articleForm.status}
                      onValueChange={(value: "draft" | "published") =>
                        setArticleForm((prev) => ({
                          ...prev,
                          status: value,
                          published_at:
                            value === "published" && !prev.published_at ? new Date().toISOString() : prev.published_at,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="published">Publicado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data de publicação (ISO)</Label>
                    <Input
                      value={articleForm.published_at}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, published_at: e.target.value }))}
                      placeholder="2026-03-03T12:00:00.000Z"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Autor</Label>
                    <Input
                      value={articleForm.author_name}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, author_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo de leitura (min)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={articleForm.reading_time_minutes}
                      onChange={(e) =>
                        setArticleForm((prev) => ({
                          ...prev,
                          reading_time_minutes: Number(e.target.value || 1),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={articleForm.category_id || "__none__"}
                      onValueChange={(value) => {
                        if (value === "__create__") {
                          void handleCreateCategoryFromSelector();
                          return;
                        }
                        setArticleForm((prev) => ({ ...prev, category_id: value === "__none__" ? "" : value }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem categoria</SelectItem>
                        <SelectItem value="__create__">
                          {creatingCategoryInline ? "Criando..." : "+ Criar categoria/subcategoria"}
                        </SelectItem>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>Palavra-chave foco</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => handleOptimizeSeoField("focus_keyword")}
                        disabled={optimizingSeoField === "focus_keyword"}
                      >
                        {optimizingSeoField === "focus_keyword" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        IA SEO
                      </Button>
                    </div>
                    <Input
                      value={articleForm.focus_keyword}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, focus_keyword: e.target.value }))}
                      placeholder="Ex: cuidador de idosos"
                    />
                    <SeoLengthHint
                      value={articleForm.focus_keyword}
                      min={SEO_FOCUS_KEYWORD_MIN_CHARS}
                      max={SEO_FOCUS_KEYWORD_MAX_CHARS}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
                  <div>
                    <p className="text-sm font-medium">Artigo em destaque</p>
                    <p className="text-xs text-muted-foreground">Prioriza o conteúdo na listagem do blog.</p>
                  </div>
                  <Switch
                    checked={articleForm.featured}
                    onCheckedChange={(checked) => setArticleForm((prev) => ({ ...prev, featured: checked }))}
                  />
                </div>

                <div className="space-y-2 rounded-xl border border-border/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-sm font-semibold">Tags do artigo</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handlePopulateTagsWithAI}
                        disabled={generatingTagsAI || creatingTagsAI || sortedTags.length === 0}
                      >
                        {generatingTagsAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                        Preencher tags com IA
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleSuggestAndCreateTagsWithAI}
                        disabled={generatingTagsAI || creatingTagsAI}
                      >
                        {creatingTagsAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Sugerir e criar novas tags
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {sortedTags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={articleForm.tag_ids.includes(tag.id)}
                          onCheckedChange={(checked) => {
                            setArticleForm((prev) => ({
                              ...prev,
                              tag_ids: checked
                                ? Array.from(new Set([...prev.tag_ids, tag.id]))
                                : prev.tag_ids.filter((id) => id !== tag.id),
                            }));
                          }}
                        />
                        <span>#{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <BlogSeoFields
                  value={articleForm}
                  onChange={(patch) => setArticleForm((prev) => ({ ...prev, ...patch }))}
                  onOptimizeField={handleOptimizeSeoField}
                  optimizingField={optimizingSeoField}
                />

                {showSeoAudit ? (
                  <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Relatorio SEO do artigo</p>
                        <p className="text-xs text-muted-foreground">
                          Use este checklist para aprovar o artigo antes de salvar/publicar.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={handleAutoFixSeoPendencies}
                          disabled={autoFixingSeo || savingArticle || !!optimizingSeoField}
                        >
                          {autoFixingSeo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                          Resolver pendencias com IA
                        </Button>
                        <Badge variant={seoAuditReport.score >= 85 ? "default" : "secondary"}>
                          Score SEO: {seoAuditReport.score}% ({seoAuditReport.passed}/{seoAuditReport.total})
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                      <span>Caracteres: {seoAuditReport.metrics.chars}</span>
                      <span>Palavras: {seoAuditReport.metrics.words}</span>
                      <span>Densidade KW: {seoAuditReport.metrics.keywordDensity.toFixed(2)}%</span>
                      <span>H1/H2/H3: {seoAuditReport.metrics.h1Count}/{seoAuditReport.metrics.h2Count}/{seoAuditReport.metrics.h3Count}</span>
                      <span>Links internos: {seoAuditReport.metrics.internalLinks}</span>
                      <span>Links externos: {seoAuditReport.metrics.externalLinks}</span>
                      <span>FAQ (perguntas): {seoAuditReport.metrics.faqQuestions}</span>
                    </div>

                    <div className="space-y-2">
                      {seoAuditReport.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${
                            item.passed
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          <span>{item.passed ? "OK" : "Revisar"} - {item.label}</span>
                          <span className="font-medium">{item.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowSeoAudit(true)}>
                    Ver relatorio SEO
                  </Button>
                  <Button type="button" variant="outline" onClick={resetArticleForm}>
                    Limpar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingArticle}
                    className="gap-2"
                    onClick={() => void handleSaveArticle(undefined, "close")}
                  >
                    {savingArticle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar e fechar
                  </Button>
                  <Button
                    type="button"
                    disabled={savingArticle}
                    className="gap-2"
                    onClick={() => void handleSaveArticle(undefined, "continue")}
                  >
                    {savingArticle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar e continuar edição
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-settings" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Pesquisa de Temas com IA</CardTitle>
              <CardDescription>
                Selecione um foco e pesquise temas/notícias atuais sobre atendimentos à saúde para gerar artigos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Tema da pesquisa</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{researchThemes.length}/10 temas</Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleGenerateResearchThemes}
                      disabled={loadingResearchThemes}
                    >
                      {loadingResearchThemes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Gerar 10 novos temas com IA
                    </Button>
                  </div>
                </div>
                <RadioGroup value={researchTheme} onValueChange={setResearchTheme} className="grid gap-3 md:grid-cols-2">
                  {researchThemes.map((theme) => (
                    <label
                      key={theme.id}
                      htmlFor={`research-theme-${theme.id}`}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background p-3 hover:border-primary/50"
                    >
                      <RadioGroupItem id={`research-theme-${theme.id}`} value={theme.id} className="mt-1" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{theme.label}</p>
                        <p className="text-xs text-muted-foreground">{theme.description}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
                <div className="flex justify-end">
                  <Button type="button" className="gap-2" onClick={handleSearchResearchTopics} disabled={researchingTopics || loadingResearchThemes}>
                    {researchingTopics ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Pesquisar temas nas redes
                  </Button>
                </div>
              </div>

              <Card className="border-border/70">
                <CardHeader>
                  <CardTitle className="text-base">Resultados da pesquisa</CardTitle>
                  <CardDescription>
                    Selecione um resultado para gerar artigo com URL de referência e capa automática.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {researchResults.length > 0 ? (
                    researchResults.slice(0, 10).map((result) => (
                      <div key={result.id} className="rounded-lg border border-border/60 bg-background p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold leading-snug">{result.title}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {result.source ? <Badge variant="secondary">{result.source}</Badge> : null}
                              {result.published_at ? (
                                <span>{new Date(result.published_at).toLocaleDateString("pt-BR")}</span>
                              ) : null}
                            </div>
                            {result.summary ? <p className="text-xs text-muted-foreground">{result.summary}</p> : null}
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Ver fonte
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-2 md:ml-4"
                            onClick={() => handleGenerateArticleFromResearch(result)}
                            disabled={generatingFromResearchId === result.id}
                          >
                            {generatingFromResearchId === result.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Bot className="h-4 w-4" />
                            )}
                            Gerar artigo com este tema
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                      Execute a pesquisa para listar ao menos 5 temas e gerar artigos diretamente.
                    </div>
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Categorias</CardTitle>
              <CardDescription>Gerencie categorias com SEO próprio e schema específico.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Hierarquia</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {categoryPathById.get(String(category.id)) || category.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{category.slug}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setCategoryForm({
                                  id: category.id,
                                  name: category.name || "",
                                  slug: category.slug || "",
                                  parent_id: category.parent_id || "",
                                  description: category.description || "",
                                  seo_title: category.seo_title || "",
                                  seo_description: category.seo_description || "",
                                  seo_canonical_url: category.seo_canonical_url || "",
                                  seo_robots: category.seo_robots || "index,follow",
                                  seo_og_title: category.seo_og_title || "",
                                  seo_og_description: category.seo_og_description || "",
                                  seo_og_image_url: category.seo_og_image_url || "",
                                  schema_json: JSON.stringify(category.schema_json || {}, null, 2),
                                })
                              }
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete("blog_categories", category.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        Nenhuma categoria cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{categoryForm.id ? "Editar categoria" : "Nova categoria"}</CardTitle>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={resetCategoryForm}>
                  <Plus className="h-4 w-4" />
                  Nova
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCategory} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                          slug: prev.id ? prev.slug : generateSlug(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input
                      value={categoryForm.slug}
                      onChange={(e) => setCategoryForm((prev) => ({ ...prev, slug: generateSlug(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoria pai (opcional)</Label>
                  <Select
                    value={categoryForm.parent_id || "__none__"}
                    onValueChange={(value) =>
                      setCategoryForm((prev) => ({ ...prev, parent_id: value === "__none__" ? "" : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem categoria pai" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem categoria pai</SelectItem>
                      {categoryOptions
                        .filter((option) => String(option.id) !== String(categoryForm.id || ""))
                        .map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Se selecionar uma categoria pai, esta categoria sera salva como subcategoria.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <BlogSeoFields
                  value={categoryForm}
                  onChange={(patch) => setCategoryForm((prev) => ({ ...prev, ...patch }))}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetCategoryForm}>
                    Limpar
                  </Button>
                  <Button type="submit" disabled={savingCategory} className="gap-2">
                    {savingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar categoria
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>Gerencie tags com SEO e schema próprio.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.length > 0 ? (
                    tags.map((tag) => (
                      <TableRow key={tag.id}>
                        <TableCell className="font-medium">{tag.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tag.slug}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setTagForm({
                                  id: tag.id,
                                  name: tag.name || "",
                                  slug: tag.slug || "",
                                  description: tag.description || "",
                                  seo_title: tag.seo_title || "",
                                  seo_description: tag.seo_description || "",
                                  seo_canonical_url: tag.seo_canonical_url || "",
                                  seo_robots: tag.seo_robots || "index,follow",
                                  seo_og_title: tag.seo_og_title || "",
                                  seo_og_description: tag.seo_og_description || "",
                                  seo_og_image_url: tag.seo_og_image_url || "",
                                  schema_json: JSON.stringify(tag.schema_json || {}, null, 2),
                                })
                              }
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete("blog_tags", tag.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        Nenhuma tag cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{tagForm.id ? "Editar tag" : "Nova tag"}</CardTitle>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={resetTagForm}>
                  <Plus className="h-4 w-4" />
                  Nova
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveTag} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={tagForm.name}
                      onChange={(e) =>
                        setTagForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                          slug: prev.id ? prev.slug : generateSlug(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input value={tagForm.slug} onChange={(e) => setTagForm((prev) => ({ ...prev, slug: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={tagForm.description}
                    onChange={(e) => setTagForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <BlogSeoFields
                  value={tagForm}
                  onChange={(patch) => setTagForm((prev) => ({ ...prev, ...patch }))}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetTagForm}>
                    Limpar
                  </Button>
                  <Button type="submit" disabled={savingTag} className="gap-2">
                    {savingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar tag
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={coverPreviewOpen}
        onOpenChange={(open) => {
          if (generatingCoverImage) return;
          setCoverPreviewOpen(open);
          if (!open) {
            setCoverCandidate(null);
            setRejectedCoverUrls([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização da capa</DialogTitle>
            <DialogDescription>
              Aprove esta opção ou rejeite para gerar outra imagem automaticamente.
            </DialogDescription>
          </DialogHeader>

          {coverCandidate?.cover_image_url ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-border bg-secondary/20">
                <img
                  src={coverCandidate.cover_image_url}
                  alt={coverCandidate.alt_text || "Prévia da capa do artigo"}
                  className="max-h-[60vh] w-full object-contain"
                />
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                {coverCandidate.provider ? <p>Fonte: {coverCandidate.provider}</p> : null}
                {coverCandidate.query_used ? <p>Consulta: {coverCandidate.query_used}</p> : null}
                {coverCandidate.photographer ? <p>Autor: {coverCandidate.photographer}</p> : null}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-border bg-secondary/20">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando pré-visualização da capa...
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setCoverPreviewOpen(false)} disabled={generatingCoverImage}>
              Fechar
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleRejectCoverImage} disabled={generatingCoverImage || !coverCandidate}>
                {generatingCoverImage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Rejeitar e gerar outra
              </Button>
              <Button onClick={handleApproveCoverImage} disabled={generatingCoverImage || !coverCandidate}>
                Aprovar capa
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlogTab;
