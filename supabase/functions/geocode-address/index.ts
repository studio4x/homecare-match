import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Resposta imediata para preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { address } = await req.json()
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')

    if (!apiKey) {
      console.error("[geocode-address] ERRO: Variável GOOGLE_MAPS_API_KEY não encontrada nos Secrets do Supabase.")
      return new Response(
        JSON.stringify({ 
          error: 'Configuração Ausente', 
          details: 'A chave GOOGLE_MAPS_API_KEY não foi configurada nos Secrets do projeto Supabase.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[geocode-address] Solicitando geocodificação para: \${address}`)

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=\${encodeURIComponent(address)}&key=\${apiKey}&language=pt-BR`
    const response = await fetch(url)
    const data = await response.json()

    if (data.status !== 'OK') {
      console.error(`[geocode-address] Google API retornou erro: \${data.status}`, data.error_message || '')
      
      // Mapeia erros comuns do Google para mensagens amigáveis
      let userFriendlyError = `Erro no Google: \${data.status}`
      if (data.status === 'REQUEST_DENIED') userFriendlyError = "Acesso Negado: Verifique se a Geocoding API está ativa no Google Cloud e se a chave não tem restrições de IP/Referer incompatíveis."
      if (data.status === 'OVER_QUERY_LIMIT') userFriendlyError = "Limite Excedido: Verifique se o faturamento (billing) está ativo no seu projeto Google Cloud."

      return new Response(
        JSON.stringify({ 
          error: data.status, 
          details: data.error_message || userFriendlyError 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = data.results[0]
    const location = result.geometry.location

    console.log(`[geocode-address] Sucesso! Coordenadas encontradas: \${location.lat}, \${location.lng}`)

    return new Response(
      JSON.stringify({ 
        lat: location.lat, 
        lng: location.lng,
        formatted_address: result.formatted_address 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("[geocode-address] Erro crítico na execução:", error.message)
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})