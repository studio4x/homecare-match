// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createTransport } from "https://esm.sh/nodemailer@6.9.13"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MASTER_ADMIN_EMAIL = "contato@homecarematch.com.br";
const DEFAULT_SITE_URL = "https://www.homecarematch.com.br";

serve(async (req) => {
  console.log("[notify-support] Função iniciada.");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, ticketId, senderId, message } = await req.json();
    const SITE_URL = Deno.env.get('SITE_URL') || DEFAULT_SITE_URL;

    console.log(`[notify-support] Processando evento: ${type} para o ticket: ${ticketId}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar dados do ticket
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error("[notify-support] Erro ao buscar ticket:", ticketError);
      throw new Error("Ticket não encontrado");
    }

    // 2. Buscar dados do dono do ticket (quem abriu)
    const { data: ticketOwner, error: ownerError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', ticket.user_id)
      .single();

    if (ownerError || !ticketOwner) {
      console.error("[notify-support] Erro ao buscar dono do ticket:", ownerError);
      throw new Error("Dono do ticket não encontrado");
    }

    // 3. Buscar dados de quem enviou a ação atual (remetente)
    const { data: sender, error: senderError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role, is_admin')
      .eq('id', senderId)
      .single();

    if (senderError || !sender) {
      console.error("[notify-support] Erro ao buscar remetente:", senderError);
    }

    const isAdminAction = sender?.is_admin || sender?.role === 'admin';

    // 4. Configurar SMTP
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpPort = Deno.env.get('SMTP_PORT') || "587";

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("[notify-support] Erro: Configurações SMTP ausentes nas Secrets!");
      throw new Error("SMTP configuration missing");
    }

    const transporter = createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpPort === "465",
      auth: { user: smtpUser, pass: smtpPass },
    });

    let mailOptions = {
      from: `"Suporte HomeCare Match" <${smtpUser}>`,
    };

    const ticketLink = `${SITE_URL}/dashboard/suporte/${ticketId}`;
    const adminLink = `${SITE_URL}/admin/suporte`;

    switch (type) {
      case 'new_ticket':
        mailOptions.to = MASTER_ADMIN_EMAIL;
        mailOptions.subject = `🎫 Novo Ticket: ${ticket.subject}`;
        mailOptions.html = `
          <div style="font-family: sans-serif; color: #1e293b;">
            <h2 style="color: #2563eb;">Novo chamado aberto</h2>
            <p><strong>Usuário:</strong> ${ticketOwner.full_name} (${ticketOwner.email})</p>
            <p><strong>Assunto:</strong> ${ticket.subject}</p>
            <p><strong>Prioridade:</strong> ${ticket.priority}</p>
            <p><strong>Descrição:</strong> ${ticket.description}</p>
            <div style="margin-top: 20px;">
              <a href="${adminLink}" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">Ver no Painel Admin</a>
            </div>
          </div>
        `;
        break;

      case 'new_message':
        if (isAdminAction) {
          // Admin respondeu -> Notifica o Usuário
          mailOptions.to = ticketOwner.email;
          mailOptions.subject = `💬 Nova resposta no seu chamado: ${ticket.subject}`;
          mailOptions.html = `
            <div style="font-family: sans-serif; color: #1e293b;">
              <p>Olá, <strong>${ticketOwner.full_name}</strong>.</p>
              <p>Nossa equipe de suporte respondeu ao seu chamado <strong>"${ticket.subject}"</strong>.</p>
              <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin:15px 0; border-left: 4px solid #2563eb;">
                ${message}
              </div>
              <div style="margin-top: 20px;">
                <a href="${ticketLink}" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">Responder no Chat</a>
              </div>
            </div>
          `;
        } else {
          // Usuário respondeu -> Notifica o Admin
          mailOptions.to = MASTER_ADMIN_EMAIL;
          mailOptions.subject = `📩 Nova mensagem no Ticket: ${ticket.subject}`;
          mailOptions.html = `
            <div style="font-family: sans-serif; color: #1e293b;">
              <p>O usuário <strong>${ticketOwner.full_name}</strong> enviou uma nova mensagem no ticket #${ticketId.slice(0,8)}.</p>
              <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin:15px 0; border-left: 4px solid #2563eb;">
                ${message}
              </div>
              <div style="margin-top: 20px;">
                <a href="${adminLink}" style="display:inline-block; padding:12px 24px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">Ver no Painel Admin</a>
              </div>
            </div>
          `;
        }
        break;

      case 'ticket_closed':
        mailOptions.to = ticketOwner.email;
        mailOptions.subject = `✅ Chamado Encerrado: ${ticket.subject}`;
        mailOptions.html = `
          <div style="font-family: sans-serif; color: #1e293b;">
            <p>Olá, <strong>${ticketOwner.full_name}</strong>.</p>
            <p>Seu chamado <strong>"${ticket.subject}"</strong> foi marcado como encerrado.</p>
            <p>Esperamos ter ajudado! Se precisar de algo mais, sinta-se à vontade para abrir um novo ticket.</p>
            <div style="margin-top: 20px;">
              <a href="${ticketLink}" style="display:inline-block; padding:12px 24px; background:#64748b; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">Ver Histórico</a>
            </div>
          </div>
        `;
        break;
    }

    console.log(`[notify-support] Tentando enviar e-mail para: ${mailOptions.to}`);
    await transporter.sendMail(mailOptions);
    console.log("[notify-support] E-mail enviado com sucesso!");

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error("[notify-support] Erro crítico:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})