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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SITE_URL = Deno.env.get('SITE_URL') || DEFAULT_SITE_URL;
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { professional_id, sender_id } = await req.json();

    const { data: professional } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', professional_id).single();
    const { data: sender } = await supabaseAdmin.from('profiles').select('full_name, role, city, state, bio').eq('id', sender_id).single();

    // --- NOTIFICAÇÃO PARA O PROFISSIONAL ---
    const senderType = sender.role === 'company' ? 'Uma empresa' : 'Uma família';
    await supabaseAdmin.from('notifications').insert({
      user_id: professional_id,
      title: "👤 Novo Interesse no seu Perfil!",
      content: `\${senderType} (\${sender.full_name}) salvou seu contato e pode te chamar no WhatsApp em breve.`,
      link: "/dashboard/contatos",
      type: 'info'
    });

    // E-mail (mantido)
    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(Deno.env.get('SMTP_PORT') || "587"),
        secure: Deno.env.get('SMTP_PORT') === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });
      const senderRoleText = sender.role === 'company' ? 'a empresa' : 'a família';
      await transporter.sendMail({
        from: `"HomeCare Match" <\${smtpUser}>`,
        to: professional.email,
        subject: `🎉 Boa notícia! Você recebeu um novo contato!`,
        html: `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;"><h2 style="color: #2563eb;">Olá, \${professional.full_name}!</h2><p>Temos uma ótima notícia: \${senderRoleText} <strong>\${sender.full_name}</strong> demonstrou interesse no seu perfil.</p></div>`,
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})