// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
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

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(Deno.env.get('SMTP_PORT') || "587"),
        secure: Deno.env.get('SMTP_PORT') === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"HomeCare Match" <${smtpUser}>`,
        to: "contato@homecarematch.com.br",
        subject: `⚠️ Verificação Pendente: ${userName}`,
        html: `<div style="font-family: sans-serif; padding: 20px;"><h2 style="color: #2563eb;">Nova Solicitação</h2><p>O profissional <strong>${userName}</strong> enviou documentos.</p><p>E-mail: ${userEmail}</p></div>`,
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})