// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const { name, specialty, experience, city, state } = await req.json()
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

  if (!GEMINI_API_KEY) {
    console.error("[generate-bio] Erro: GEMINI_API_KEY não configurada")
    return new Response(
      JSON.stringify({ error: 'Chave de API do Gemini não configurada no Supabase' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`[generate-bio] Gerando bio para: ${name}, ${specialty}`)

  const prompt = {
    contents: [{
      parts: [{
        text: `Você é um redator especializado em recrutamento na área da saúde para Home Care. 
        Crie uma mini-biografia profissional, curta e impactante (máximo 400 caracteres), para o seguinte profissional:
        Nome: ${name}
        Especialidade: ${specialty}
        Experiência: ${experience}
        Localização: ${city} - ${state}

        REGRAS:
        1. Use um tom profissional, porém acolhedor e humano.
        2. Destaque a prontidão para atendimentos domiciliares na região de ${city}.
        3. Escreva em primeira pessoa (Eu sou...).
        4. NÃO use hashtags.
        5. Seja direto e evite clichês excessivos.
        6. O texto deve ser formatado como um parágrafo único pronto para publicação.`
      }]
    }]
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt)
    }
  )

  const data = await response.json()
  
  if (data.error) {
    console.error("[generate-bio] Erro na API do Gemini:", data.error)
    throw new Error(data.error.message)
  }

  const generatedBio = data.candidates[0].content.parts[0].text.trim()

  return new Response(
    JSON.stringify({ bio: generatedBio }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})