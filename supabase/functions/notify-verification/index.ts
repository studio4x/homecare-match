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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Validar Token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response('Invalid token', { status: 401, headers: corsHeaders })

    const { userName, userEmail, userId } = await req.json()
    
    // Validação de entrada
    if (!userName || typeof userName !== 'string' || userName.length < 3) {
      return new Response('Invalid Name', { status: 400, headers: corsHeaders })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const MASTER_ADMIN_EMAIL = "homecarematch@studio4x.com.br"
    
    console.log(`[notify-verification] Processando solicitação de: ${userName} (${userId})`)

    if (RESEND_API_KEY) {
      // Enviar e-mail para o Admin
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'HomeCareMatch <notificacoes@resend.dev>',
          to: [MASTER_ADMIN_EMAIL],
          subject: `Nova Solicitação de Verificação: ${userName}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #007BFF;">Nova Verificação Pendente</h2>
              <p>O profissional <strong>${userName}</strong> (${userEmail}) enviou os documentos para análise.</p>
              <div style="margin-top: 30px;">
                <a href="https://rkjvtnadqkbwomgzyswr.supabase.co/admin" 
                   style="background-color: #007BFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Acessar Painel de Verificações
                </a>
              </div>
            </div>
          `,
        }),
      })
    }

    // Atualizar o perfil para marcar que a verificação foi enviada (importante para o UI do dashboard)
    await supabaseClient
      .from('profiles')
      .update({ verification_sent: true })
      .eq('id', user.id)

    return new Response(JSON.stringify({ message: 'Solicitação registrada com sucesso' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[notify-verification] Erro:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})