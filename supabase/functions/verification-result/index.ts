// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { profileId, status, reason, userName, userEmail } = await req.json()
    
    console.log(`[verification-result] Processando ${status} para ${userName} (${userEmail})`)

    if (status === 'approved') {
      console.log(`[verification-result] SUCESSO: Usuário ${userName} aprovado.`)
      // Aqui você integraria o envio de e-mail de Boas-vindas/Aprovação
    } else {
      console.log(`[verification-result] REPROVADO: Usuário ${userName}. Motivo: ${reason}`)
      // Aqui você integraria o envio de e-mail de Reprovação com a variável 'reason'
    }

    return new Response(
      JSON.stringify({ message: 'Resultado processado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("[verification-result] Erro:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})