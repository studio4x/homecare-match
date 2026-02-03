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
    const MASTER_ADMIN_EMAIL = "homecarematch@studio4x.com.br"
    
    console.log(`[notify-verification] Processando pedido de: ${userName}`);

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("[notify-verification] Erro: Secrets do SMTP não configuradas!");
      return new Response(JSON.stringify({ error: "SMTP configuration missing" }), { status: 500, headers: corsHeaders });
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: parseInt(smtpPort || "587"),
        tls: true,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      },
    });

    try {
      await client.send({
        from: smtpUser,
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
            <p>Acesse o painel administrativo para validar.</p>
          </div>
        `,
      });
      await client.close();
      console.log("[notify-verification] E-mail enviado com sucesso!");
    } catch (smtpError) {
      console.error("[notify-verification] Erro ao conectar/enviar e-mail:", smtpError);
      throw smtpError;
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[notify-verification] Erro crítico:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})