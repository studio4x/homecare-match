// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response('Invalid token', { status: 401, headers: corsHeaders })

    const { name, specialty, experience, city, state } = await req.json()
    
    // Validação rigorosa
    if (!name || !specialty || !experience || specialty.length < 2) {
      return new Response('Invalid profile data', { status: 400, headers: corsHeaders })
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    console.log(`[generate-bio] Gerando para: ${user.id}`)

    const prompt = {
      contents: [{
        parts: [{
          text: `Crie uma biografia profissional curta (máx 400 caracteres) para um ${specialty} chamado ${name}, com experiência em ${experience}, localizado em ${city}-${state}. Use a primeira pessoa e tom profissional.`
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
    const generatedBio = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Erro ao gerar biografia."

    return new Response(JSON.stringify({ bio: generatedBio }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[generate-bio] Erro:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})