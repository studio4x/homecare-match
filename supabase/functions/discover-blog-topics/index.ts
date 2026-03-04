// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THEMES: Record<string, { label: string; queries: string[] }> = {
  homecare_idosos: {
    label: "Cuidados domiciliares para idosos",
    queries: [
      "home care idosos atendimento domiciliar saude",
      "cuidador de idosos domiciliar boas praticas",
      "internacao domiciliar idosos brasil",
    ],
  },
  enfermagem_domiciliar: {
    label: "Enfermagem domiciliar e protocolos",
    queries: [
      "enfermagem domiciliar protocolos seguranca paciente",
      "assistencia de enfermagem home care",
      "boas praticas enfermagem atendimento domiciliar",
    ],
  },
  gestao_homecare: {
    label: "Gestao e operacao em Home Care",
    queries: [
      "gestao home care operacao equipes saude",
      "qualidade atendimento domiciliar saude",
      "indicadores home care empresas de saude",
    ],
  },
  saude_digital: {
    label: "Saude digital, telemedicina e monitoramento",
    queries: [
      "telemedicina atendimento domiciliar saude",
      "saude digital monitoramento remoto pacientes",
      "tecnologia home care brasil",
    ],
  },
  seguranca_paciente: {
    label: "Seguranca do paciente e qualidade assistencial",
    queries: [
      "seguranca do paciente atendimento domiciliar",
      "eventos adversos home care prevencao",
      "qualidade assistencial domiciliar protocolos",
    ],
  },
  default: {
    label: "Tendencias em atendimentos a saude",
    queries: [
      "atendimentos a saude tendencias brasil",
      "inovacao saude assistencia domiciliar",
      "noticias saude atendimento pacientes",
    ],
  },
};

type DynamicThemePayload = {
  id: string;
  label: string;
  queries: string[];
};

const normalizeThemeId = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

const parseDynamicThemePayload = (payload: unknown): DynamicThemePayload | null => {
  if (!payload || typeof payload !== "object") return null;

  const theme = payload as Record<string, unknown>;
  const id = normalizeThemeId(theme.id || theme.label);
  const label = String(theme.label || "").trim();
  const queries = (Array.isArray(theme.queries) ? theme.queries : [])
    .map((query) => String(query || "").trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!id || !label || queries.length < 2) return null;
  return { id, label, queries };
};

const decodeHtml = (value: string) =>
  String(value || "")
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code || 32)))
    .trim();

const stripHtml = (value: string) => decodeHtml(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const extractTag = (block: string, tagName: string) => {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(regex);
  return match ? decodeHtml(match[1]) : "";
};

const normalizeArticleUrl = (raw: string) => {
  const value = decodeHtml(raw || "");
  if (!value) return "";

  try {
    const url = new URL(value);
    const uddg = url.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    return value;
  } catch {
    return value.startsWith("http://") || value.startsWith("https://") ? value : "";
  }
};

const parseRss = (xml: string, provider: string) => {
  const items = [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const parsed = items
    .map((item, index) => {
      const block = item[1];
      const title = extractTag(block, "title");
      const link = normalizeArticleUrl(extractTag(block, "link"));
      const summary = stripHtml(extractTag(block, "description"));
      const publishedAt = extractTag(block, "pubDate");
      const sourceTag = extractTag(block, "source");
      const source = sourceTag || provider;
      const sourceUrlMatch = block.match(/<source[^>]*url="([^"]+)"/i);
      const sourceUrl = sourceUrlMatch ? normalizeArticleUrl(sourceUrlMatch[1]) : "";

      if (!title || !link) return null;
      return {
        id: `${provider}-${index}-${title.slice(0, 28)}`.replace(/\s+/g, "-").toLowerCase(),
        title,
        url: link,
        summary: summary.slice(0, 260),
        source: source || provider,
        source_url: sourceUrl || null,
        published_at: publishedAt || null,
        provider,
      };
    })
    .filter(Boolean);

  return parsed;
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
      return new Response(JSON.stringify({ error: "Somente administradores podem pesquisar temas com IA." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedThemeId = normalizeThemeId(body?.theme_id || "default") || "default";
    const dynamicTheme = parseDynamicThemePayload(body?.theme_payload);
    const fallbackTheme = THEMES[requestedThemeId] || THEMES.default;
    const activeTheme = dynamicTheme || {
      id: requestedThemeId,
      label: fallbackTheme.label,
      queries: fallbackTheme.queries,
    };
    const limit = Math.max(5, Math.min(Number(body?.limit || 10), 20));

    const rssUrls: Array<{ url: string; provider: string }> = [];
    for (const query of activeTheme.queries) {
      const encoded = encodeURIComponent(query);
      rssUrls.push({
        provider: "google-news",
        url: `https://news.google.com/rss/search?q=${encoded}&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
      });
      rssUrls.push({
        provider: "bing-news",
        url: `https://www.bing.com/news/search?q=${encoded}&format=rss&setlang=pt-BR`,
      });
    }

    const responses = await Promise.all(
      rssUrls.map(async (item) => {
        try {
          const response = await fetch(item.url, { headers: { "User-Agent": "homecarematch-bot/1.0" } });
          if (!response.ok) return [];
          const xml = await response.text();
          return parseRss(xml, item.provider);
        } catch {
          return [];
        }
      }),
    );

    const merged = responses.flat();
    const dedupe = new Map<string, any>();
    for (const item of merged) {
      const key = `${String(item.url || "").toLowerCase()}::${String(item.title || "").toLowerCase()}`;
      if (!dedupe.has(key)) dedupe.set(key, item);
    }

    const ordered = Array.from(dedupe.values()).sort((a, b) => {
      const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
      const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
      return bTime - aTime;
    });

    const results = ordered.slice(0, limit);
    if (results.length < 5) {
      return new Response(
        JSON.stringify({
          error: "Nao foi possivel encontrar ao menos 5 temas agora. Tente outro tema em alguns minutos.",
          results,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        theme_id: activeTheme.id,
        theme_label: activeTheme.label,
        count: results.length,
        results,
        fetched_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[discover-blog-topics] Erro:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "Erro ao pesquisar temas." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
