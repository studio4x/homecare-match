// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_FIELDS = new Set([
  "title",
  "slug",
  "excerpt",
  "focus_keyword",
  "seo_title",
  "seo_description",
  "seo_og_title",
  "seo_og_description",
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

const applyFieldRules = (field: string, rawValue: unknown) => {
  const value = String(rawValue || "").trim().replace(/\s+/g, " ");
  switch (field) {
    case "slug":
      return toSlug(value);
    case "seo_title":
      return compactText(value, 60);
    case "seo_description":
      return compactText(value, 160);
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
    default:
      return compactText(value, 240);
  }
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
    focus_keyword: "- Retorne UMA palavra-chave foco principal, objetiva e relevante (max 90 caracteres).",
    seo_title: "- Retorne um SEO title entre 50 e 60 caracteres, com palavra-chave principal.",
    seo_description: "- Retorne uma meta description entre 140 e 160 caracteres, com beneficio claro e CTA.",
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
- og_title: ${context.seo_og_title || "(vazio)"}
- og_description: ${context.seo_og_description || "(vazio)"}
- referencia: ${context.source_reference_url || "(vazio)"}
- conteudo (trecho): ${compactText(String(context.content_html || "").replace(/<[^>]+>/g, " "), 900) || "(vazio)"}

Regras:
${rulesByField[field] || "- Retorne valor otimizado para SEO."}
- Responda APENAS JSON valido no formato: {"value":"..."}
- Nao inclua markdown.
`.trim();
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

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
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

    const geminiData = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      throw new Error(geminiData?.error?.message || "Falha ao chamar API do Gemini.");
    }

    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Resposta vazia da IA.");
    }

    const parsed = JSON.parse(cleanJsonText(rawText));
    const optimizedValue = applyFieldRules(field, parsed?.value || parsed?.result || "");
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
