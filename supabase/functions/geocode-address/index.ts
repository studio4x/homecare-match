import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { address } = await req.json()
    // Limpa espaços extras que podem ter vindo ao colar a chave nos Secrets
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim()

    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Configuração Ausente', 
          details: 'A chave GOOGLE_MAPS_API_KEY não foi encontrada nos Secrets do Supabase.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=pt-BR`
    const response = await fetch(url)
    const data = await response.json()

    if (data.status !== 'OK') {
      let details = data.error_message || `Erro: ${data.status}`;
      
      if (data.status === 'REQUEST_DENIED') {
        details = "Chave Inválida ou Geocoding API desativada no Google Cloud Console.";
      }

      return new Response(
        JSON.stringify({ error: data.status, details }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = data.results[0]
    return new Response(
      JSON.stringify({ 
        lat: result.geometry.location.lat, 
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal Error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})