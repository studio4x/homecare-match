import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LIMIT_PER_24H = 20;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

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
      .eq('resource_type', 'geocoding')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (count >= LIMIT_PER_24H) {
      return new Response(
        JSON.stringify({ error: "Limite de detecção de endereço atingido por hoje." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { address } = await req.json()
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim()

    // Log temporário para depuração
    // console.log(`[geocode-address] API Key (primeiros 5 caracteres): ${apiKey ? apiKey.substring(0, 5) : 'N/A'}`);

    if (!apiKey) throw new Error("Configuração de Mapas ausente.");

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=pt-BR`
    const response = await fetch(url)
    const data = await response.json()

    if (data.status !== 'OK') {
      let errorMessage = data.status;
      if (data.status === 'REQUEST_DENIED') {
        errorMessage = "A chave da API do Google Maps está inválida ou não tem permissões. Verifique as configurações no Painel Admin.";
      } else if (data.error_message) {
        errorMessage = data.error_message;
      }
      return new Response(JSON.stringify({ error: errorMessage }), { status: 400, headers: corsHeaders })
    }

    const result = data.results[0]
    
    // Registrar uso bem-sucedido
    await supabaseAdmin.from('api_usage_logs').insert({
      user_id: user.id,
      resource_type: 'geocoding'
    });

    return new Response(
      JSON.stringify({ 
        lat: result.geometry.location.lat, 
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})