// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_SITE_URL = "https://homecarematch.com.br";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const SITE_URL = Deno.env.get('SITE_URL') || DEFAULT_SITE_URL;
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');

    if (!smtpHost || !smtpUser || !smtpPass) throw new Error("SMTP configuration missing");

    const { userName, userEmail, userId } = await req.json()
    const MASTER_ADMIN_EMAIL = "contato@homecarematch.com.br"

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(Deno.env.get('SMTP_PORT') || "587"),
      secure: Deno.env.get('SMTP_PORT') === "465",
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"HomeCare Match" <${smtpUser}>`,
      to: MASTER_ADMIN_EMAIL,
      subject: `⚠️ Verificação Pendente: ${userName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #2563eb;">Nova Solicitação de Verificação</h2>
          <p>O profissional <strong>${userName}</strong> enviou documentos para análise.</p>
          <p><strong>E-mail:</strong> ${userEmail}</p>
          <div style="margin-top: 20px;"><a href="${SITE_URL}/admin" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">Acessar Painel Admin</a></div>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})