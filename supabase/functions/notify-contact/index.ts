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
    
    if (!smtpHost || !smtpUser || !smtpPass) throw new Error("SMTP configuration missing");

    const authHeader = req.headers.get('Authorization');
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));

    const { professional_id, sender_id } = await req.json();

    const { data: professional } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', professional_id).single();
    const { data: sender } = await supabaseAdmin.from('profiles').select('full_name, role, city, state, bio').eq('id', sender_id).single();

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(Deno.env.get('SMTP_PORT') || "587"),
      secure: Deno.env.get('SMTP_PORT') === "465",
      auth: { user: smtpUser, pass: smtpPass },
    });

    const senderRoleText = sender.role === 'company' ? 'a empresa' : 'a família';
    const senderProfileLink = `${SITE_URL}/recruiter/${sender_id}`;

    await transporter.sendMail({
      from: `"HomeCare Match" <${smtpUser}>`,
      to: professional.email,
      subject: `🎉 Boa notícia! Você recebeu um novo contato!`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #2563eb;">Olá, ${professional.full_name}!</h2>
          <p>Temos uma ótima notícia: ${senderRoleText} <strong>${sender.full_name}</strong> demonstrou interesse no seu perfil.</p>
          <div style="margin: 20px 0; padding: 15px; background: #f1f5f9; border-radius: 8px;">
            <p><strong>Localização:</strong> ${sender.city || 'Não informado'} - ${sender.state || 'Não informado'}</p>
            <p><strong>Sobre:</strong> ${sender.bio || 'Nenhuma descrição fornecida.'}</p>
          </div>
          <div style="margin-top: 20px;">
            <a href="${senderProfileLink}" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">Ver Perfil do Recrutador</a>
          </div>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})