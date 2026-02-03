// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Sanitize string inputs to prevent prompt injection
const sanitizeInput = (str: string, maxLength: number = 200): string => {
  if (!str || typeof str !== 'string') return '';
  // Remove potentially harmful characters and control characters
  return str
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>{}[\]\\]/g, '') // Remove brackets and backslashes
    .trim()
    .slice(0, maxLength);
};

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

    const body = await req.json()
    const { name, specialty, experience, city, state } = body
    
    // Comprehensive input validation with length limits
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 100) {
      return new Response('Invalid Name (2-100 characters)', { status: 400, headers: corsHeaders })
    }
    if (!specialty || typeof specialty !== 'string' || specialty.length < 2 || specialty.length > 100) {
      return new Response('Invalid Specialty (2-100 characters)', { status: 400, headers: corsHeaders })
    }
    if (!experience || typeof experience !== 'string' || experience.length < 2 || experience.length > 500) {
      return new Response('Invalid Experience (2-500 characters)', { status: 400, headers: corsHeaders })
    }
    if (city && (typeof city !== 'string' || city.length > 100)) {
      return new Response('Invalid City (max 100 characters)', { status: 400, headers: corsHeaders })
    }
    if (state && (typeof state !== 'string' || state.length > 50)) {
      return new Response('Invalid State (max 50 characters)', { status: 400, headers: corsHeaders })
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) return new Response('AI Key missing', { status: 500, headers: corsHeaders })

    console.log(`[generate-bio] Gerando para: ${user.id}`)

    // Sanitize all inputs before using in AI prompt to prevent prompt injection
    const safeName = sanitizeInput(name, 100);
    const safeSpecialty = sanitizeInput(specialty, 100);
    const safeExperience = sanitizeInput(experience, 300);
    const safeCity = sanitizeInput(city || '', 100);
    const safeState = sanitizeInput(state || '', 50);

    const promptText = `Crie uma biografia profissional curta (máx 400 caracteres) para um ${safeSpecialty} chamado ${safeName}, com experiência em ${safeExperience}, localizado em ${safeCity}-${safeState}. Use a primeira pessoa e tom profissional.`

    const prompt = {
      contents: [{
        parts: [{ text: promptText }]
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
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})
