// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createTransport } from "https://esm.sh/nodemailer@6.9.13"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- CONFIGURAÇÃO ---
// Para alterar o domínio, mude aqui OU configure a Secret 'SITE_URL' no Supabase
const DEFAULT_SITE_URL = "https://homecarematch.lovable.app";
// --------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const SITE_URL = Deno.env.get('SITE_URL') || DEFAULT_SITE_URL;

    // Verificar configurações SMTP
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("[notify-verification] Erro: Secrets do SMTP não configuradas!");
      throw new Error("SMTP configuration missing");
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    // Validar usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response('Invalid token', { status: 401, headers: corsHeaders })

    const { userName, userEmail, userId } = await req.json()
    const MASTER_ADMIN_EMAIL = "homecarematch@studio4x.com.br"
    
    console.log(`[notify-verification] Processando pedido de: ${userName} (${userEmail})`);

    // Configurar Nodemailer
    const transporter = createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || "587"),
      secure: parseInt(smtpPort || "587") === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Enviar E-mail
    await transporter.sendMail({
      from: `"HomeCare Match" <${smtpUser}>`,
      to: MASTER_ADMIN_EMAIL,
      subject: `⚠️ Verificação Pendente: ${userName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #2563eb;">Nova Solicitação de Verificação</h2>
          <p>O profissional <strong>${userName}</strong> enviou documentos para análise.</p>
          <div style="margin: 20px 0; padding: 15px; background: #f1f5f9; border-radius: 8px;">
            <p><strong>E-mail:</strong> ${userEmail}</p>
            <p><strong>ID:</strong> ${userId}</p>
          </div>
          <p>Acesse o painel administrativo para validar.</p>
          <div style="margin-top: 20px;">
            <a href="${SITE_URL}/admin" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">
              Acessar Painel Admin
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
            Link configurado para: ${SITE_URL}
          </p>
        </div>
      `,
    });

    console.log("[notify-verification] E-mail enviado com sucesso!");

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[notify-verification] Erro crítico:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})