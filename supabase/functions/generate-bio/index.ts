// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders })
    }

    const { name, specialty, experience, city, state } = await req.json()
    
    // Validação de entrada
    if (!name || !specialty || !experience) {
      return new Response(JSON.stringify({ error: 'Dados incompletos para geração' }), { status: 400, headers: corsHeaders })
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    console.log(`[generate-bio] Processando bio para: ${name}`)

    const prompt = {
      contents: [{
        parts: [{
          text: `Crie uma biografia profissional curta (400 char) para ${name}, ${specialty}, com experiência em ${experience}, localizado em ${city}-${state}. Primeira pessoa, tom profissional.`
        }]
      }]
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prompt)
      }
    )

    const data = await response.json()
    const generatedBio = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Erro ao gerar bio."

    return new Response(JSON.stringify({ bio: generatedBio }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error("[generate-bio] Erro:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})