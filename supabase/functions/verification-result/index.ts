// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

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
    
    console.log(`[verification-result] Processando e-mail para: ${userEmail}`)

    if (!RESEND_API_KEY) {
      console.error("[verification-result] Erro: RESEND_API_KEY não configurada.");
      return new Response(JSON.stringify({ error: 'Configuração de e-mail ausente' }), { status: 500, headers: corsHeaders })
    }

    const isApproved = status === 'approved'
    const subject = isApproved ? "Seu perfil foi aprovado! 🎉" : "Ação necessária no seu perfil ⚠️"
    
    const htmlContent = isApproved 
      ? `<p>Olá <strong>${userName}</strong>,</p><p>Parabéns! Seus documentos foram verificados e seu perfil agora possui o selo de confiança do HomeCareMatch.</p><p>Você já está visível para empresas e contratantes.</p>`
      : `<p>Olá <strong>${userName}</strong>,</p><p>Analisamos sua solicitação de verificação e encontramos um detalhe que precisa de correção:</p><p style="color: #e11d48; font-weight: bold;">Motivo: ${reason}</p><p>Por favor, acesse seu painel, reenvie os documentos necessários e solicite uma nova análise.</p>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'HomeCareMatch <onboarding@resend.dev>', // No futuro, use seu domínio próprio
        to: [userEmail],
        subject: subject,
        html: htmlContent,
      }),
    })

    if (!res.ok) {
      const errorData = await res.json()
      throw new Error(`Erro Resend: ${JSON.stringify(errorData)}`)
    }

    return new Response(
      JSON.stringify({ message: 'E-mail enviado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("[verification-result] Erro crítico:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})