// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response('Invalid token', { status: 401, headers: corsHeaders })

    const { userName, userEmail, userId } = await req.json()
    
    // E-MAIL DE DESTINO (ADMINISTRADOR)
    const MASTER_ADMIN_EMAIL = "homecarematch@studio4x.com.br"
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    console.log(`[notify-verification] Iniciando processo para: ${userName} (${userId})`)

    // 1. Atualizar o status no banco de dados
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ verification_sent: true })
      .eq('id', user.id)

    if (updateError) {
      console.error("[notify-verification] Erro ao atualizar banco:", updateError)
      throw updateError
    }

    // 2. Enviar e-mail via Resend
    if (!RESEND_API_KEY) {
      console.error("[notify-verification] RESEND_API_KEY não encontrada nas Secrets do Supabase!")
      return new Response(JSON.stringify({ error: 'Configuração de e-mail ausente' }), { status: 500, headers: corsHeaders })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'HomeCareMatch <onboarding@resend.dev>', // Usando o remetente padrão do Resend
        to: [MASTER_ADMIN_EMAIL],
        subject: `⚠️ Verificação Pendente: ${userName}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #2563eb;">Nova Solicitação de Verificação</h2>
            <p>O profissional <strong>${userName}</strong> enviou documentos para análise.</p>
            <div style="margin: 20px 0; padding: 15px; background: #f1f5f9; border-radius: 8px;">
              <p><strong>E-mail:</strong> ${userEmail}</p>
              <p><strong>ID:</strong> ${userId}</p>
            </div>
            <a href="https://rkjvtnadqkbwomgzyswr.supabase.co/admin" 
               style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Acessar Painel Admin
            </a>
          </div>
        `,
      }),
    })

    const resData = await res.json()
    console.log("[notify-verification] Resposta do Resend:", resData)

    if (!res.ok) {
      throw new Error(`Erro no Resend: ${JSON.stringify(resData)}`)
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[notify-verification] Erro fatal:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})