import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { subscription, device_type, browser, user_id } = await req.json()
    
    // Captura o IP real do cabeçalho da requisição
    const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '0.0.0.0';
    
    // Tenta obter a cidade via Geo-IP (Supabase Edge Functions fornecem isso em alguns cabeçalhos)
    // Caso não esteja disponível, usamos um fallback ou deixamos vazio
    const city = req.headers.get('x-vercel-ip-city') || 'Desconhecida';

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .insert({
        user_id,
        subscription,
        device_type,
        browser,
        ip_address: ip,
        city: decodeURIComponent(city)
      });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
})