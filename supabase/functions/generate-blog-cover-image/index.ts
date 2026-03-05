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

const compactText = (value: string, max = 220) => String(value || "").trim().replace(/\s+/g, " ").slice(0, max);

const normalizeText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const BEAUTY_TERMS = [
  "beauty",
  "estetica",
  "estetico",
  "skincare",
  "spa",
  "cosmetic",
  "cosmetico",
  "maquiagem",
  "makeup",
  "cabelo",
  "hair",
  "salon",
  "nails",
  "manicure",
  "pedicure",
  "depilacao",
  "barbearia",
];

const HEALTHCARE_TERMS = [
  "saude",
  "saude domiciliar",
  "home healthcare",
  "enfermagem",
  "nurse",
  "paciente",
  "patient",
  "cuidador",
  "caregiver",
  "idoso",
  "elderly",
  "clinico",
  "medical",
  "medico",
];

const hasAnyTerm = (text: string, terms: string[]) => {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return terms.some((term) => normalized.includes(normalizeText(term)));
};

const isAmbiguousHomeCare = (text: string) => {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return (
    normalized.includes("home care") ||
    normalized.includes("homecare") ||
    normalized.includes("cuidados domiciliares") ||
    normalized.includes("atendimento domiciliar")
  );
};

const forceHealthcareIntent = (query: string) => {
  const raw = compactText(query, 150);
  if (!raw) return "";
  const normalized = normalizeText(raw);
  const hasHealthcareHint = hasAnyTerm(normalized, HEALTHCARE_TERMS);
  if (hasHealthcareHint) return raw;
  if (isAmbiguousHomeCare(normalized)) {
    return compactText(`${raw} enfermagem domiciliar paciente idoso saude`, 150);
  }
  return compactText(`${raw} saude domiciliar paciente`, 150);
};

const isLikelyBeautyPhoto = (photo: any) => {
  const bag = [
    photo?.alt,
    photo?.url,
    photo?.photographer,
    photo?.photographer_url,
    photo?.src?.original,
    photo?.src?.large,
    photo?.src?.medium,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");
  return hasAnyTerm(bag, BEAUTY_TERMS);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
      return new Response(JSON.stringify({ error: "Somente administradores podem gerar capa com IA." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const title = compactText(body?.title || "", 180);
    const suggestion = compactText(body?.suggestion || "", 180);
    const excerpt = compactText(body?.excerpt || "", 180);
    const focusKeyword = compactText(body?.focus_keyword || "", 120);
    const contentHtml = String(body?.content_html || "").replace(/<[^>]+>/g, " ");
    const excludedUrls = new Set(
      (Array.isArray(body?.excluded_urls) ? body.excluded_urls : [])
        .map((url: unknown) => String(url || "").trim())
        .filter(Boolean),
    );

    const seed = [title, suggestion, focusKeyword, excerpt].filter(Boolean).join(" ");
    if (!seed) {
      return new Response(JSON.stringify({ error: "Informe titulo, sugestao ou palavra-chave para buscar capa." }), {
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

    const PEXELS_API_KEY = Deno.env.get("PEXELS_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!PEXELS_API_KEY && !OPENAI_API_KEY) {
      throw new Error("Configure PEXELS_API_KEY ou OPENAI_API_KEY no servidor.");
    }

    const prompt = `
Voce e um editor visual para artigos de Home Care no Brasil.
Com base no contexto abaixo, gere termos de busca para foto de capa em banco de imagens.

Contexto:
- titulo: ${title || "(vazio)"}
- sugestao: ${suggestion || "(vazio)"}
- palavra-chave foco: ${focusKeyword || "(vazio)"}
- resumo: ${excerpt || "(vazio)"}
- conteudo (trecho): ${compactText(contentHtml, 260) || "(vazio)"}

Retorne APENAS JSON valido:
{
  "primary_query_pt": "string curta",
  "primary_query_en": "string curta",
  "secondary_queries": ["string", "string", "string"],
  "alt_text": "descricao curta da imagem de capa"
}

Regras:
- evite termos de marcas, logos, textos na imagem
- prefira cenas humanas de saude domiciliar, enfermagem, paciente, cuidador e contexto clinico real
- NUNCA use contexto de estetica, salao, spa, maquiagem, skincare ou beleza
- quando houver "home care", trate como assistencia de saude domiciliar (nao estetica)
- termos devem ser objetivos para busca de foto
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
    if (!rawText) throw new Error("Resposta vazia da IA para capa.");

    const parsed = JSON.parse(cleanJsonText(rawText));
    const rawQueries = [
      compactText(parsed?.primary_query_en || "", 120),
      compactText(parsed?.primary_query_pt || "", 120),
      ...(Array.isArray(parsed?.secondary_queries)
        ? parsed.secondary_queries.map((item: unknown) => compactText(String(item || ""), 120))
        : []),
      compactText(`${focusKeyword} home care`, 120),
      compactText(title, 120),
      "home healthcare nurse caregiver patient elderly at home",
      "enfermagem domiciliar cuidado de paciente idoso em casa",
    ];

    const queries = rawQueries
      .map((query) => forceHealthcareIntent(query))
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 10);

    const altText = compactText(parsed?.alt_text || title || "Imagem de capa do artigo", 180);
    let selectedPhoto: any = null;
    let queryUsed = "";

    if (PEXELS_API_KEY) {
      for (const query of queries) {
        const pexelsResponse = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape&size=large`,
          {
            headers: {
              Authorization: PEXELS_API_KEY,
            },
          },
        );

        if (!pexelsResponse.ok) {
          continue;
        }

        const pexelsData = await pexelsResponse.json();
        const photos = Array.isArray(pexelsData?.photos) ? pexelsData.photos : [];
        if (photos.length === 0) continue;

        const validPhotos = photos.filter((photo: any) => {
          const src = photo?.src || {};
          const candidateUrls = [
            photo?.url,
            src.landscape,
            src.large2x,
            src.large,
            src.original,
            src.medium,
            src.small,
          ]
            .map((url) => String(url || "").trim())
            .filter(Boolean);

          if (candidateUrls.some((url) => excludedUrls.has(url))) return false;
          if (isLikelyBeautyPhoto(photo)) return false;
          return true;
        });

        if (validPhotos.length === 0) continue;

        selectedPhoto =
          validPhotos.find((photo: any) => Number(photo?.width || 0) >= 1200 && Number(photo?.height || 0) >= 630) ||
          validPhotos[0];
        queryUsed = query;
        break;
      }
    }

    if (selectedPhoto) {
      const src = selectedPhoto?.src || {};
      const imageUrl =
        src.landscape || src.large2x || src.large || src.original || src.medium || src.small || "";
      if (!imageUrl) {
        throw new Error("Provedor retornou imagem sem URL valida.");
      }

      return new Response(
        JSON.stringify({
          cover_image_url: imageUrl,
          alt_text: altText,
          query_used: queryUsed,
          provider: "pexels",
          photographer: selectedPhoto?.photographer || null,
          photographer_url: selectedPhoto?.photographer_url || null,
          source_page: selectedPhoto?.url || null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Nenhuma imagem relevante foi encontrada na Pexels. Configure OPENAI_API_KEY para fallback com GPT.",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const openaiPrompt = `
Crie uma imagem de capa horizontal para artigo de blog de Home Care no Brasil.
Tema base: ${seed}
Palavra-chave foco: ${focusKeyword || "home care"}
Estilo: fotografia realista, humana, acolhedora, profissional, iluminação natural.
Restrições: sem texto embutido, sem logos, sem marcas, sem watermark.
Composição: formato paisagem amplo, com área limpa para título sobreposto.
`.trim();

    let imageUrl = "";
    let openaiUrl = "";
    let generatedOk = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: openaiPrompt,
          size: "1536x1024",
        }),
      });

      const openaiData = await openaiResponse.json();
      if (!openaiResponse.ok) {
        throw new Error(openaiData?.error?.message || "Falha ao gerar capa com OpenAI.");
      }

      const generated = openaiData?.data?.[0] || {};
      openaiUrl = typeof generated?.url === "string" ? generated.url : "";
      const b64 = typeof generated?.b64_json === "string" ? generated.b64_json : "";
      imageUrl = openaiUrl || (b64 ? `data:image/png;base64,${b64}` : "");

      if (!imageUrl) continue;
      if (excludedUrls.has(imageUrl) || (openaiUrl && excludedUrls.has(openaiUrl))) {
        imageUrl = "";
        openaiUrl = "";
        continue;
      }

      generatedOk = true;
      break;
    }

    if (!generatedOk || !imageUrl) {
      throw new Error("Nao foi possivel gerar uma nova imagem diferente das opcoes rejeitadas.");
    }

    return new Response(
      JSON.stringify({
        cover_image_url: imageUrl,
        alt_text: altText,
        query_used: queries[0] || seed,
        provider: "openai",
        photographer: null,
        photographer_url: null,
        source_page: openaiUrl || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[generate-blog-cover-image] Erro:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "Erro ao gerar capa com IA." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
