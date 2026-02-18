// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MASTER_ADMIN_EMAIL = "contato@homecarematch.com.br";
const DEFAULT_SITE_URL = "https://www.homecarematch.com.br";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { type, ticketId, senderId, message } = await req.json();
    const SITE_URL = Deno.env.get('SITE_URL') || DEFAULT_SITE_URL;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: ticket } = await supabaseAdmin.from('support_tickets').select('*').eq('id', ticketId).single();
    const { data: ticketOwner } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', ticket.user_id).single();
    const { data: sender } = await supabaseAdmin.from('profiles').select('full_name, role, is_admin').eq('id', senderId).single();

    const isAdminAction = sender?.is_admin || sender?.role === 'admin';

    // --- GERAÇÃO DE NOTIFICAÇÃO NO PAINEL ---
    if (type === 'new_ticket') {
      await supabaseAdmin.from('admin_notifications').insert({
        title: "🎫 Novo Ticket Aberto",
        content: `O usuário ${ticketOwner.full_name} abriu um chamado: "${ticket.subject}"`,
        link: `/admin/suporte/${ticketId}`,
        type: 'warning'
      });
    } else if (type === 'new_message' && !isAdminAction) {
      await supabaseAdmin.from('admin_notifications').insert({
        title: "📩 Nova Mensagem em Ticket",
        content: `${ticketOwner.full_name} respondeu no ticket #${ticketId.slice(0,8)}`,
        link: `/admin/suporte/${ticketId}`,
        type: 'info'
      });
    }

    // Lógica de E-mail (mantida)
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpPort = Deno.env.get('SMTP_PORT') || "587";

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpPort === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      let mailOptions = { from: `"Suporte HomeCare Match" <${smtpUser}>` };
      const ticketLink = `${SITE_URL}/dashboard/suporte/${ticketId}`;
      const adminLink = `${SITE_URL}/admin/suporte`;

      if (type === 'new_ticket') {
        mailOptions.to = MASTER_ADMIN_EMAIL;
        mailOptions.subject = `🎫 Novo Ticket: ${ticket.subject}`;
        mailOptions.html = `<div style="font-family: sans-serif;"><h2 style="color: #2563eb;">Novo chamado</h2><p><strong>Usuário:</strong> ${ticketOwner.full_name}</p><p><strong>Assunto:</strong> ${ticket.subject}</p><a href="${adminLink}" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px;">Ver no Painel</a></div>`;
      } else if (type === 'new_message') {
        if (isAdminAction) {
          mailOptions.to = ticketOwner.email;
          mailOptions.subject = `💬 Nova resposta no seu chamado: ${ticket.subject}`;
          mailOptions.html = `<div style="font-family: sans-serif;"><p>Olá, <strong>${ticketOwner.full_name}</strong>.</p><p>Nossa equipe respondeu ao seu chamado.</p><div style="background:#f1f5f9; padding:15px; border-radius:8px;">${message}</div><a href="${ticketLink}" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; margin-top:20px;">Responder no Chat</a></div>`;
        } else {
          mailOptions.to = MASTER_ADMIN_EMAIL;
          mailOptions.subject = `📩 Nova mensagem no Ticket: ${ticket.subject}`;
          mailOptions.html = `<div style="font-family: sans-serif;"><p>O usuário <strong>${ticketOwner.full_name}</strong> enviou uma mensagem no ticket #${ticketId.slice(0,8)}.</p><div style="background:#f1f5f9; padding:15px; border-radius:8px;">${message}</div><a href="${adminLink}" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; margin-top:20px;">Ver no Painel</a></div>`;
        }
      }

      await transporter.sendMail(mailOptions);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})