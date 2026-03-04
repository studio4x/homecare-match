// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AvailableTag = {
  id: string;
  name: string;
  slug: string;
};

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
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const toSlug = (value: unknown) => normalizeText(value).replace(/\s+/g, "-").replace(/-+/g, "-");

const sanitizeTags = (rawTags: unknown): AvailableTag[] => {
  const source = Array.isArray(rawTags) ? rawTags : [];
  const mapped = source
    .map((tag: any) => {
      const id = String(tag?.id || "").trim();
      const name = String(tag?.name || "").trim();
      const slug = String(tag?.slug || "").trim() || toSlug(name);
      return { id, name, slug };
    })
    .filter((tag: AvailableTag) => tag.id && tag.name);

  const deduped: AvailableTag[] = [];
  const seen = new Set<string>();
  for (const tag of mapped) {
    const key = `${tag.id}::${toSlug(tag.slug || tag.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(tag);
    if (deduped.length >= 120) break;
  }
  return deduped;
};

const pickTagsByHeuristic = (context: string, tags: AvailableTag[]) => {
  const normalizedContext = normalizeText(context);
  if (!normalizedContext) return tags.slice(0, Math.min(3, tags.length)).map((tag) => tag.id);

  const scored = tags
    .map((tag) => {
      const slug = toSlug(tag.slug || tag.name);
      const tagText = normalizeText(tag.name);
      const tokens = Array.from(new Set([slug.replace(/-/g, " "), tagText, slug])).filter(Boolean);
      let score = 0;
      for (const token of tokens) {
        if (!token) continue;
        if (normalizedContext.includes(token)) score += 3;
        const split = token.split(" ").filter((part) => part.length >= 4);
        for (const part of split) {
          if (normalizedContext.includes(part)) score += 1;
        }
      }
      return { id: tag.id, score };
    })
    .sort((a, b) => b.score - a.score);

  const positive = scored.filter((item) => item.score > 0).slice(0, 8).map((item) => item.id);
  if (positive.length >= 3) return positive;

  const fallbackTop = scored.slice(0, Math.min(5, scored.length)).map((item) => item.id);
  return Array.from(new Set([...positive, ...fallbackTop])).slice(0, 6);
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
      return new Response(JSON.stringify({ error: "Somente administradores podem usar IA para tags." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const excerpt = String(body?.excerpt || "").trim();
    const focusKeyword = String(body?.focus_keyword || "").trim();
    const contentHtml = String(body?.content_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const availableTags = sanitizeTags(body?.available_tags);

    if (availableTags.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma tag disponivel para selecao." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const context = [title, excerpt, focusKeyword, contentHtml.slice(0, 5000)].filter(Boolean).join("\n");
    if (!context) {
      return new Response(JSON.stringify({ error: "Contexto insuficiente para sugerir tags." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY nao configurada no servidor.");
    }

    const { data: config } = await supabaseAdmin
      .from("site_config")
      .select("gemini_model")
      .eq("id", 1)
      .single();

    const modelName = config?.gemini_model || "gemini-2.0-flash";
    const compactTags = availableTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: toSlug(tag.slug || tag.name),
    }));

    const prompt = `
Voce e um editor SEO para blog de Home Care.
Com base no contexto do artigo e na lista de tags disponiveis, selecione as tags mais relevantes.

Contexto do artigo:
${context}

Tags disponiveis (escolha apenas daqui):
${JSON.stringify(compactTags)}

Retorne APENAS JSON valido:
{
  "selected_tag_ids": ["id1", "id2"],
  "selected_tag_slugs": ["slug-1", "slug-2"]
}

Regras:
- escolha entre 3 e 8 tags
- use apenas ids/slugs presentes na lista disponivel
- priorize aderencia semantica ao tema do artigo
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

    let selectedTagIds: string[] = [];
    if (geminiResponse.ok) {
      const geminiData = await geminiResponse.json().catch(() => ({}));
      const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(cleanJsonText(rawText));
        const byId = new Set(availableTags.map((tag) => String(tag.id)));
        const slugToId = new Map<string, string>(
          availableTags.map((tag) => [toSlug(tag.slug || tag.name), String(tag.id)]),
        );

        const idsFromAI = (Array.isArray(parsed?.selected_tag_ids) ? parsed.selected_tag_ids : [])
          .map((id: unknown) => String(id || "").trim())
          .filter((id: string) => byId.has(id));

        const idsFromSlugs = (Array.isArray(parsed?.selected_tag_slugs) ? parsed.selected_tag_slugs : [])
          .map((slug: unknown) => slugToId.get(toSlug(slug)) || "")
          .filter(Boolean);

        selectedTagIds = Array.from(new Set([...idsFromAI, ...idsFromSlugs])).slice(0, 8);
      }
    }

    if (selectedTagIds.length === 0) {
      selectedTagIds = pickTagsByHeuristic(context, availableTags);
    }

    if (selectedTagIds.length === 0) {
      selectedTagIds = availableTags.slice(0, Math.min(3, availableTags.length)).map((tag) => tag.id);
    }

    const selectedTags = availableTags.filter((tag) => selectedTagIds.includes(tag.id));

    return new Response(
      JSON.stringify({
        count: selectedTags.length,
        selected_tag_ids: selectedTags.map((tag) => tag.id),
        selected_tag_slugs: selectedTags.map((tag) => toSlug(tag.slug || tag.name)),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[generate-blog-tags] Erro:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "Erro ao sugerir tags com IA." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
