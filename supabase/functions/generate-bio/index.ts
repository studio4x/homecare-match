// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[generate-bio] Requisição recebida.");

    const { name, specialty, experience, professional_experiences, city, state } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) {
      console.error("[generate-bio] ERRO: GEMINI_API_KEY não encontrada nos Secrets do Supabase.");
      return new Response(
        JSON.stringify({ error: "A chave de API da IA não foi configurada no servidor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `
      Você é um redator especializado em perfis profissionais de saúde para a plataforma HomeCare Match.
      Sua tarefa é escrever uma biografia cativante, humanizada e profissional em terceira pessoa.
      
      Dados do Profissional:
      - Nome: ${name}
      - Especialidade: ${specialty}
      - Formações: ${experience}
      - Experiências Práticas: ${professional_experiences}
      - Localização: ${city} - ${state}

      Diretrizes:
      1. Escreva em terceira pessoa.
      2. O tom deve ser profissional, mas acolhedor (ideal para Home Care).
      3. Destaque a experiência e o compromisso com o cuidado humanizado.
      4. O texto deve ter entre 3 e 5 parágrafos curtos.
      5. Não use placeholders como "[Nome]". Use os dados fornecidos.
      6. Retorne APENAS o texto da biografia, sem introduções ou comentários.
    `;

    console.log("[generate-bio] Chamando API do Gemini...");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("[generate-bio] Erro na API do Gemini:", result);
      return new Response(
        JSON.stringify({ error: "Erro na API de Inteligência Artificial.", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bio = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!bio) {
      console.error("[generate-bio] Resposta vazia do Gemini:", result);
      throw new Error("A IA não retornou um conteúdo válido.");
    }

    console.log("[generate-bio] Biografia gerada com sucesso.");

    return new Response(JSON.stringify({ bio: bio.trim() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-bio] Erro crítico:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});