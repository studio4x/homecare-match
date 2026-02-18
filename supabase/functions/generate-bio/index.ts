// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMIT_PER_24H = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Validar Usuário
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
    }

    // 2. Verificar Rate Limit (Últimas 24h)
    const { count } = await supabaseAdmin
      .from('api_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('resource_type', 'ai_bio')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (count >= LIMIT_PER_24H) {
      return new Response(
        JSON.stringify({ error: "Limite diário atingido. Você pode gerar até 5 biografias por dia." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { name, specialty, experience, professional_experiences, city, state } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) throw new Error("Configuração de IA ausente.");

    const prompt = `Escreva uma biografia profissional e humanizada em terceira pessoa para: Nome: \${name}, Especialidade: \${specialty}, Formações: \${experience}, Experiências: \${professional_experiences}, Localização: \${city} - \${state}. Retorne APENAS o texto.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=\${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );

    const result = await response.json();
    const bio = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (bio) {
      // Registrar uso bem-sucedido
      await supabaseAdmin.from('api_usage_logs').insert({
        user_id: user.id,
        resource_type: 'ai_bio'
      });
    }

    return new Response(JSON.stringify({ bio: bio.trim() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});