// @ts-nocheck
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
    const { profileId, status, reason, userName, userEmail } = await req.json()
    
    console.log(`[verification-result] Processando resultado de verificação para o usuário: ${userName} (ID: ${profileId})`)

    if (status === 'approved') {
      console.log(`[verification-result] APROVADO: O perfil de ${userName} foi verificado com sucesso.`)
      // TODO: Integrar serviço de e-mail (ex: Resend, SendGrid) para enviar um e-mail de boas-vindas.
      // Ex: await sendEmail({ to: userEmail, subject: "Seu perfil foi aprovado!", body: "Parabéns..." })
    } else {
      console.log(`[verification-result] REPROVADO: O perfil de ${userName} foi reprovado. Motivo: ${reason}`)
      // TODO: Integrar serviço de e-mail para enviar a notificação de reprovação com o motivo.
      // Ex: await sendEmail({ to: userEmail, subject: "Ação necessária para seu perfil", body: `Olá, encontramos um problema... Motivo: ${reason}` })
    }

    return new Response(
      JSON.stringify({ message: 'Resultado da verificação processado com sucesso.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("[verification-result] Erro inesperado:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})