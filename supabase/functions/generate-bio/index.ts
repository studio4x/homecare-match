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
    console.log("[generate-bio] Requisição iniciada.");

    const { name, specialty, experience, professional_experiences, city, state } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) {
      console.error("[generate-bio] ERRO: GEMINI_API_KEY não encontrada nos Secrets.");
      return new Response(
        JSON.stringify({ error: "A chave de API (GEMINI_API_KEY) não foi configurada nos Secrets do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `
      Você é um redator especializado em perfis profissionais de saúde.
      Escreva uma biografia profissional e humanizada em terceira pessoa para o seguinte perfil:
      
      Nome: ${name}
      Especialidade: ${specialty}
      Formações: ${experience}
      Experiências: ${professional_experiences}
      Localização: ${city} - ${state}

      Diretrizes:
      - Escreva em terceira pessoa.
      - Tom acolhedor e profissional.
      - Destaque o compromisso com o cuidado.
      - Retorne APENAS o texto da biografia.
      - Se os dados forem insuficientes ou de teste, crie um texto padrão profissional baseado na especialidade.
    `;

    console.log("[generate-bio] Chamando Gemini API (v1 - gemini-2.5-flash)...");

    // Atualizado para o modelo gemini-2.5-flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
      console.error("[generate-bio] Erro retornado pelo Google:", result);
      const googleError = result.error?.message || "Erro desconhecido na API do Google.";
      return new Response(
        JSON.stringify({ error: `Erro no Google Gemini: ${googleError}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bio = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!bio) {
      console.error("[generate-bio] Resposta sem conteúdo:", result);
      return new Response(
        JSON.stringify({ error: "A IA não gerou conteúdo. Verifique se os dados inseridos são válidos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[generate-bio] Sucesso!");

    return new Response(JSON.stringify({ bio: bio.trim() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-bio] Erro crítico:", error.message);
    return new Response(
      JSON.stringify({ error: `Erro interno: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});