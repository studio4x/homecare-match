// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { userName, userEmail, userId } = await req.json()
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // --- NOTIFICAÇÃO NO PAINEL ---
    await supabaseAdmin.from('admin_notifications').insert({
      title: "🛡️ Nova Solicitação de Verificação",
      content: `O profissional ${userName} enviou documentos para análise.`,
      link: "/admin/verificacoes",
      type: 'info'
    });

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpPort = Deno.env.get('SMTP_PORT'); // Adicionado para configuração do transporter

    if (smtpHost && smtpUser && smtpPass && smtpPort) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort), // Usar a porta configurada
        secure: smtpPort === "465", // true for 465, false for other ports
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"HomeCare Match" <${smtpUser}>`,
        to: "contato@homecarematch.com.br", // E-mail do admin
        subject: `⚠️ Verificação Pendente: ${userName}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2563eb;">Nova Solicitação de Verificação</h2>
            <p>O profissional <strong>${userName}</strong> enviou documentos para análise.</p>
            <p><strong>E-mail do Profissional:</strong> ${userEmail}</p>
            <p>Acesse o painel administrativo para revisar e aprovar ou rejeitar os documentos:</p>
            <p><a href="${Deno.env.get('SITE_URL')}/admin/verificacoes" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Ir para Verificações</a></p>
            <p>Atenciosamente,<br>Equipe HomeCare Match</p>
          </div>
        `,
      });
    } else {
      console.warn("[notify-verification] Variáveis SMTP não configuradas. E-mail para o admin não enviado.");
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error("[notify-verification] Erro crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})