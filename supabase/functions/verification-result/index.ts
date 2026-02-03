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
    
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !caller) return new Response('Invalid session', { status: 401, headers: corsHeaders })

    const { status, reason, userName, userEmail } = await req.json()
    console.log(`[verification-result] Enviando resultado para: ${userEmail} (${status})`);

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost || "",
        port: parseInt(smtpPort || "587"),
        tls: true,
        auth: {
          user: smtpUser || "",
          pass: smtpPass || "",
        },
      },
    });

    try {
      const isApproved = status === 'approved';
      await client.send({
        from: smtpUser || "notificacoes@homecarematch.com.br",
        to: userEmail,
        subject: isApproved ? "Seu perfil foi aprovado! 🎉" : "Ação necessária no seu perfil ⚠️",
        content: "text/html",
        html: isApproved ? `<h2>Boas notícias, ${userName}! Seu perfil foi aprovado.</h2>` : `<h2>Olá ${userName}, sua verificação não foi aprovada. Motivo: ${reason}</h2>`,
      });
      await client.close();
      console.log("[verification-result] E-mail enviado com sucesso!");
    } catch (smtpError) {
      console.error("[verification-result] Erro SMTP:", smtpError);
      throw smtpError;
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[verification-result] Erro fatal:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})