// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createTransport } from "https://esm.sh/nodemailer@6.9.13"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MASTER_ADMIN_EMAIL = "contato@homecarematch.com.br";
const DEFAULT_SITE_URL = "https://homecarematch.com.br";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { type, ticketId, senderId, message } = await req.json();
    const SITE_URL = Deno.env.get('SITE_URL') || DEFAULT_SITE_URL;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar dados do ticket e do usuário que abriu
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .select('*, user:profiles!support_tickets_user_id_fkey(full_name, email)')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) throw new Error("Ticket não encontrado");

    // Buscar dados de quem enviou a ação atual
    const { data: sender } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role, is_admin')
      .eq('id', senderId)
      .single();

    const isAdminAction = sender?.is_admin || sender?.role === 'admin';

    // Configurar SMTP
    const transporter = createTransport({
      host: Deno.env.get('SMTP_HOST'),
      port: parseInt(Deno.env.get('SMTP_PORT') || "587"),
      secure: parseInt(Deno.env.get('SMTP_PORT') || "587") === 465,
      auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASS') },
    });

    let mailOptions = {
      from: `"Suporte HomeCare Match" <${Deno.env.get('SMTP_USER')}>`,
    };

    const ticketLink = `${SITE_URL}/dashboard/suporte/${ticketId}`;

    switch (type) {
      case 'new_ticket':
        mailOptions.to = MASTER_ADMIN_EMAIL;
        mailOptions.subject = `🎫 Novo Ticket: ${ticket.subject}`;
        mailOptions.html = `
          <h2>Novo chamado aberto</h2>
          <p><strong>Usuário:</strong> ${ticket.user.full_name} (${ticket.user.email})</p>
          <p><strong>Assunto:</strong> ${ticket.subject}</p>
          <p><strong>Prioridade:</strong> ${ticket.priority}</p>
          <p><strong>Descrição:</strong> ${ticket.description}</p>
          <a href="${SITE_URL}/admin/suporte" style="display:inline-block; padding:10px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:5px;">Ver no Painel Admin</a>
        `;
        break;

      case 'new_message':
        if (isAdminAction) {
          // Admin respondeu -> Notifica o Usuário
          mailOptions.to = ticket.user.email;
          mailOptions.subject = `💬 Nova resposta no seu chamado: ${ticket.subject}`;
          mailOptions.html = `
            <p>Olá, ${ticket.user.full_name}.</p>
            <p>Nossa equipe de suporte respondeu ao seu chamado <strong>"${ticket.subject}"</strong>.</p>
            <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin:15px 0;">
              ${message}
            </div>
            <a href="${ticketLink}" style="display:inline-block; padding:10px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:5px;">Responder no Chat</a>
          `;
        } else {
          // Usuário respondeu -> Notifica o Admin
          mailOptions.to = MASTER_ADMIN_EMAIL;
          mailOptions.subject = `📩 Nova mensagem no Ticket: ${ticket.subject}`;
          mailOptions.html = `
            <p>O usuário <strong>${ticket.user.full_name}</strong> enviou uma nova mensagem no ticket #${ticketId.slice(0,8)}.</p>
            <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin:15px 0;">
              ${message}
            </div>
            <a href="${SITE_URL}/admin/suporte" style="display:inline-block; padding:10px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:5px;">Ver no Painel Admin</a>
          `;
        }
        break;

      case 'ticket_closed':
        mailOptions.to = ticket.user.email;
        mailOptions.subject = `✅ Chamado Encerrado: ${ticket.subject}`;
        mailOptions.html = `
          <p>Olá, ${ticket.user.full_name}.</p>
          <p>Seu chamado <strong>"${ticket.subject}"</strong> foi marcado como encerrado.</p>
          <p>Esperamos ter ajudado! Se precisar de algo mais, sinta-se à vontade para abrir um novo ticket.</p>
          <a href="${ticketLink}" style="display:inline-block; padding:10px 20px; background:#64748b; color:white; text-decoration:none; border-radius:5px;">Ver Histórico</a>
        `;
        break;
    }

    await transporter.sendMail(mailOptions);

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error("[notify-support] Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})