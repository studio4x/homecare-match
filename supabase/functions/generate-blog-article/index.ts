// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const estimateReadingTime = (html: string) => {
  const plain = String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = plain ? plain.split(" ").filter(Boolean).length : 0;
  return Math.max(1, Math.ceil(words / 220));
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
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
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
      return new Response(JSON.stringify({ error: "Informe uma sugestão para gerar o artigo." }), {
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
      throw new Error("GEMINI_API_KEY não configurada no servidor.");
    }

    const topicInstruction =
      normalizedMode === "automatic"
        ? "Escolha um tema estratégico e atual para Home Care no Brasil, com foco em valor para profissionais, empresas e famílias."
        : `Tema sugerido pelo usuário: ${normalizedSuggestion}`;

    const prompt = `
Você é um redator sênior de SEO especializado em Home Care no Brasil.

${topicInstruction}

Gere um artigo completo em português brasileiro e retorne APENAS um JSON válido, sem markdown, sem comentários.
Estrutura obrigatória de resposta:
{
  "title": "string",
  "slug": "string",
  "excerpt": "string curta (até 180 caracteres)",
  "content_html": "string em HTML sem <script>",
  "focus_keyword": "string",
  "seo_title": "string",
  "seo_description": "string",
  "seo_og_title": "string",
  "seo_og_description": "string",
  "tags_suggested": ["string", "string"],
  "reading_time_minutes": 1
}

Regras:
- Use headings H2/H3 e parágrafos curtos em content_html.
- Não use promessas médicas indevidas.
- Traga tom profissional e prático.
- Evite exagero comercial.
- "slug" deve estar em minúsculas com hífens.
- "tags_suggested" deve conter de 4 a 8 tags relevantes.
`.trim();

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

    const geminiData = await geminiResponse.json();
    if (!geminiResponse.ok) {
      throw new Error(geminiData?.error?.message || "Falha ao chamar API do Gemini.");
    }

    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Resposta vazia da IA.");

    const parsed = JSON.parse(cleanJsonText(rawText));

    const title = String(parsed?.title || "").trim();
    const slug = toSlug(String(parsed?.slug || title));
    const excerpt = String(parsed?.excerpt || "").trim().slice(0, 180);
    const contentHtml = String(parsed?.content_html || "").trim();
    const focusKeyword = String(parsed?.focus_keyword || "").trim();
    const seoTitle = String(parsed?.seo_title || title).trim();
    const seoDescription = String(parsed?.seo_description || excerpt).trim().slice(0, 180);
    const seoOgTitle = String(parsed?.seo_og_title || seoTitle).trim();
    const seoOgDescription = String(parsed?.seo_og_description || seoDescription).trim().slice(0, 180);
    const tagsSuggested = Array.isArray(parsed?.tags_suggested)
      ? parsed.tags_suggested.map((item: unknown) => String(item || "").trim()).filter(Boolean).slice(0, 8)
      : [];
    const readingTime =
      Number(parsed?.reading_time_minutes || 0) || estimateReadingTime(contentHtml);

    if (!title || !slug || !contentHtml) {
      throw new Error("A IA não retornou os campos mínimos para o artigo.");
    }

    return new Response(
      JSON.stringify({
        title,
        slug,
        excerpt,
        content_html: contentHtml,
        focus_keyword: focusKeyword,
        seo_title: seoTitle,
        seo_description: seoDescription,
        seo_og_title: seoOgTitle,
        seo_og_description: seoOgDescription,
        tags_suggested: tagsSuggested,
        reading_time_minutes: readingTime,
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
