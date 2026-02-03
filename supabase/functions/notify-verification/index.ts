// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

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
    
    console.log(`[notify-verification] Iniciando processo para: ${userName} (${userId})`)

    // 1. Atualizar o status no banco de dados
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ verification_sent: true })
      .eq('id', user.id)

    if (updateError) throw updateError

    // 2. Configurar o cliente SMTP com as credenciais que você deve adicionar nas Secrets
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOST') || "", // Ex: smtp.gmail.com
        port: parseInt(Deno.env.get('SMTP_PORT') || "587"),
        tls: true,
        auth: {
          user: Deno.env.get('SMTP_USER') || "", // Seu e-mail de envio
          pass: Deno.env.get('SMTP_PASS') || "", // Sua senha
        },
      },
    });

    // 3. Enviar o e-mail
    await client.send({
      from: Deno.env.get('SMTP_USER') || "notificacoes@homecarematch.com.br",
      to: MASTER_ADMIN_EMAIL,
      subject: `⚠️ Verificação Pendente: ${userName}`,
      content: "text/html",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #2563eb;">Nova Solicitação de Verificação</h2>
          <p>O profissional <strong>${userName}</strong> enviou documentos para análise.</p>
          <div style="margin: 20px 0; padding: 15px; background: #f1f5f9; border-radius: 8px;">
            <p><strong>E-mail:</strong> ${userEmail}</p>
            <p><strong>ID:</strong> ${userId}</p>
          </div>
          <p>Você pode validar este perfil no painel administrativo.</p>
          <a href="https://rkjvtnadqkbwomgzyswr.supabase.co/admin" 
             style="display: inline-flex; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Acessar Painel Admin
          </a>
        </div>
      `,
    });

    await client.close();
    console.log("[notify-verification] E-mail enviado com sucesso via SMTP.");

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[notify-verification] Erro fatal:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})