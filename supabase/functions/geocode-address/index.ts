import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { address } = await req.json()
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')

    if (!apiKey) {
      console.error("[geocode-address] Erro: GOOGLE_MAPS_API_KEY não configurada nos Secrets.")
      return new Response(
        JSON.stringify({ error: 'Chave do Google Maps não configurada no servidor.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[geocode-address] Buscando: \${address}`)

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=\${encodeURIComponent(address)}&key=\${apiKey}&language=pt-BR`
    )

    const data = await response.json()

    if (data.status !== 'OK') {
      console.error("[geocode-address] Erro Google:", data.status, data.error_message)
      return new Response(
        JSON.stringify({ error: `Erro no Google: \${data.status}`, details: data.error_message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = data.results[0]
    const location = result.geometry.location

    return new Response(
      JSON.stringify({ 
        lat: location.lat, 
        lng: location.lng,
        formatted_address: result.formatted_address 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("[geocode-address] Erro crítico:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})