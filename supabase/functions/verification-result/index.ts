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
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    
    const authHeader = req.headers.get('Authorization')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser } } = await supabaseAdmin.auth.getUser(token)

    const { status, reason, userName, userEmail, userId } = await req.json()

    // REGISTRO DE AUDITORIA
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminUser.id,
      action_type: status === 'approved' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      target_id: userId,
      details: status === 'approved' 
        ? `Aprovou os documentos de: \${userName} (\${userEmail})` 
        : `Reprovou os documentos de: \${userName} (\${userEmail}). Motivo: \${reason}`
    })

    // Configurar SMTP e enviar e-mail (mantendo lógica anterior)
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    if (!smtpHost || !smtpUser || !smtpPass) throw new Error("SMTP configuration missing");

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(Deno.env.get('SMTP_PORT') || "587"),
      secure: Deno.env.get('SMTP_PORT') === "465",
      auth: { user: smtpUser, pass: smtpPass },
    });

    const isApproved = status === 'approved';
    const subject = isApproved ? "Seu perfil foi aprovado! 🎉" : "Ação necessária no seu perfil ⚠️";
    const SITE_URL = Deno.env.get('SITE_URL') || "https://homecarematch.com.br";
    
    const htmlContent = isApproved 
      ? `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;"><h2 style="color: #10b981;">Parabéns!</h2><p>Olá <strong>\${userName}</strong>, seus documentos foram aprovados!</p></div>` 
      : `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;"><h2 style="color: #ef4444;">Atenção Necessária</h2><p>Olá <strong>\${userName}</strong>, não pudemos concluir a verificação: <strong>\${reason}</strong></p></div>`;

    await transporter.sendMail({ from: `"HomeCare Match" <\${smtpUser}>`, to: userEmail, subject, html: htmlContent });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})