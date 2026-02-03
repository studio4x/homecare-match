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
    
    if (!userName || typeof userName !== 'string') {
      return new Response('Invalid Name', { status: 400, headers: corsHeaders })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const MASTER_ADMIN_EMAIL = "homecarematch@studio4x.com.br"
    
    console.log(`[notify-verification] Processando solicitação de: ${userName} (${userId})`)

    // 1. Atualizar o perfil no banco de dados
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ verification_sent: true })
      .eq('id', user.id)

    if (updateError) {
      console.error("[notify-verification] Erro ao atualizar perfil:", updateError)
      throw updateError
    }

    // 2. Enviar e-mail para o Admin se a chave estiver configurada
    if (RESEND_API_KEY) {
      try {
        const adminUrl = "https://rkjvtnadqkbwomgzyswr.supabase.co/admin"; // URL do seu painel administrativo

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'HomeCareMatch <notificacoes@resend.dev>',
            to: [MASTER_ADMIN_EMAIL],
            subject: `⚠️ Verificação Pendente: ${userName}`,
            html: `
              <div style="font-family: sans-serif; padding: 40px; color: #1e293b; background-color: #f8fafc; border-radius: 12px;">
                <div style="background-color: white; padding: 32px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                  <h2 style="color: #2563eb; margin-top: 0; font-size: 24px;">Nova Verificação de Perfil</h2>
                  <p style="font-size: 16px; line-height: 24px; color: #475569;">
                    Um profissional acaba de enviar documentos para análise e aguarda a sua validação.
                  </p>
                  
                  <div style="margin: 24px 0; padding: 20px; background-color: #f1f5f9; border-radius: 8px;">
                    <p style="margin: 0 0 10px 0;"><strong>Nome:</strong> ${userName}</p>
                    <p style="margin: 0 0 10px 0;"><strong>E-mail:</strong> ${userEmail}</p>
                    <p style="margin: 0;"><strong>ID do Usuário:</strong> <code style="font-size: 12px; color: #64748b;">${userId}</code></p>
                  </div>

                  <div style="margin-top: 32px; text-align: center;">
                    <a href="https://rkjvtnadqkbwomgzyswr.supabase.co/admin" 
                       style="display: inline-block; background-color: #2563eb; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Acessar Painel de Controle
                    </a>
                  </div>
                  
                  <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
                    Esta é uma notificação automática do sistema HomeCareMatch.
                  </p>
                </div>
              </div>
            `,
          }),
        })
      } catch (emailErr) {
        console.error("[notify-verification] Erro ao enviar e-mail:", emailErr)
      }
    }

    return new Response(JSON.stringify({ message: 'Solicitação registrada e administrador notificado' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[notify-verification] Erro fatal:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})