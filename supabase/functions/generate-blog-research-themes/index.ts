// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BlogResearchTheme = {
  id: string;
  label: string;
  description: string;
  queries: string[];
};

const FALLBACK_THEMES: BlogResearchTheme[] = [
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
    description: "Eficiencia operacional, escala, qualidade e gestao de equipes assistenciais.",
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

const cleanJsonText = (text: string) =>
  String(text || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

const toThemeId = (value: unknown) =>
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

const sanitizeThemes = (rawThemes: unknown): BlogResearchTheme[] => {
  const source = Array.isArray(rawThemes) ? rawThemes : [];
  const mapped = source
    .map((theme: any) => {
      const id = toThemeId(theme?.id || theme?.label);
      const label = String(theme?.label || "").trim();
      const description = String(theme?.description || "").trim();
      const queries = (Array.isArray(theme?.queries) ? theme.queries : [])
        .map((query: unknown) => String(query || "").trim())
        .filter(Boolean)
        .slice(0, 6);
      return { id, label, description, queries } as BlogResearchTheme;
    })
    .filter((theme: BlogResearchTheme) => theme.id && theme.label && theme.description && theme.queries.length >= 2);

  const deduped: BlogResearchTheme[] = [];
  const used = new Set<string>();
  for (const theme of mapped) {
    if (used.has(theme.id)) continue;
    used.add(theme.id);
    deduped.push(theme);
    if (deduped.length >= 10) break;
  }

  for (const fallback of FALLBACK_THEMES) {
    if (deduped.length >= 10) break;
    if (used.has(fallback.id)) continue;
    used.add(fallback.id);
    deduped.push(fallback);
  }

  return deduped.slice(0, 10);
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
      return new Response(JSON.stringify({ error: "Somente administradores podem gerar temas com IA." }), {
        status: 403,
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
    const prompt = `
Voce e um estrategista de conteudo para a plataforma HomeCare Match.
Gere exatamente 10 temas de pesquisa para encontrar noticias atuais relacionadas a saude homecare no Brasil.

Retorne APENAS JSON valido no formato:
{
  "themes": [
    {
      "id": "string_curta_em_snake_case",
      "label": "nome curto do tema",
      "description": "descricao objetiva",
      "queries": ["consulta 1", "consulta 2", "consulta 3"]
    }
  ]
}

Regras obrigatorias:
- exatamente 10 temas
- todos ligados a saude homecare, atendimento domiciliar, cuidado de pacientes ou gestao assistencial
- cada tema com 3 consultas de pesquisa em portugues
- nao repetir temas equivalentes
- nao usar temas fora de saude
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

    const geminiData = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      throw new Error(geminiData?.error?.message || "Falha ao chamar API do Gemini.");
    }

    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Resposta vazia da IA para temas.");

    const parsed = JSON.parse(cleanJsonText(rawText));
    const themes = sanitizeThemes(parsed?.themes ?? parsed);
    if (themes.length < 10) {
      throw new Error("A IA nao retornou 10 temas validos.");
    }

    return new Response(
      JSON.stringify({
        count: themes.length,
        themes,
        generated_at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[generate-blog-research-themes] Erro:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "Erro ao gerar temas com IA." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
