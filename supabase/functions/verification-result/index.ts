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

    const authHeader = req.headers.get('Authorization')
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    
    const { status, reason, userName, userEmail } = await req.json()

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(Deno.env.get('SMTP_PORT') || "587"),
      secure: Deno.env.get('SMTP_PORT') === "465",
      auth: { user: smtpUser, pass: smtpPass },
    });

    const isApproved = status === 'approved';
    const subject = isApproved ? "Seu perfil foi aprovado! 🎉" : "Ação necessária no seu perfil ⚠️";
    
    const htmlContent = isApproved 
      ? `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
           <h2 style="color: #10b981;">Parabéns!</h2>
           <p>Olá <strong>${userName}</strong>, seus documentos foram aprovados e seu perfil agora é <strong>Verificado</strong>!</p>
           <div style="margin-top: 25px;"><a href="${SITE_URL}/dashboard" style="display:inline-block; padding:12px 24px; background:#16a34a; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">Acessar Meu Painel</a></div>
         </div>` 
      : `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
           <h2 style="color: #ef4444;">Atenção Necessária</h2>
           <p>Olá <strong>${userName}</strong>, não pudemos concluir a verificação: <strong>${reason}</strong></p>
           <div style="margin-top: 25px;"><a href="${SITE_URL}/dashboard" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">Corrigir Documentos</a></div>
         </div>`;

    await transporter.sendMail({
      from: `"HomeCare Match" <${smtpUser}>`,
      to: userEmail,
      subject: subject,
      html: htmlContent,
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})