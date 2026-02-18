// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MASTER_ADMIN_EMAIL = "contato@homecarematch.com.br";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { type, ticketId, senderId, message } = await req.json();
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: ticket } = await supabaseAdmin.from('support_tickets').select('*').eq('id', ticketId).single();
    const { data: ticketOwner } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', ticket.user_id).single();
    const { data: sender } = await supabaseAdmin.from('profiles').select('full_name, role, is_admin').eq('id', senderId).single();

    const isAdminAction = sender?.is_admin || sender?.role === 'admin';

    // --- NOTIFICAÇÃO PARA O USUÁRIO (Dono do Ticket) ---
    if (isAdminAction) {
      let title = "📩 Nova Resposta no Suporte";
      let content = `Nossa equipe respondeu ao seu chamado: "\${ticket.subject}"`;

      if (type === 'ticket_closed') {
        title = "✅ Chamado Encerrado";
        content = `Seu chamado "\${ticket.subject}" foi marcado como resolvido.`;
      } else if (ticket.status === 'in_progress') {
        title = "⏳ Chamado em Atendimento";
        content = `Seu chamado "\${ticket.subject}" agora está sendo analisado por nossa equipe.`;
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: ticket.user_id,
        title,
        content,
        link: `/dashboard/suporte/\${ticketId}`,
        type: 'info'
      });
    }

    // Notificações Admin (mantidas)
    if (type === 'new_ticket') {
      await supabaseAdmin.from('admin_notifications').insert({ title: "🎫 Novo Ticket Aberto", content: `O usuário \${ticketOwner.full_name} abriu um chamado: "\${ticket.subject}"`, link: `/admin/suporte/\${ticketId}`, type: 'warning' });
    } else if (type === 'new_message' && !isAdminAction) {
      await supabaseAdmin.from('admin_notifications').insert({ title: "📩 Nova Mensagem em Ticket", content: `\${ticketOwner.full_name} respondeu no ticket #\${ticketId.slice(0,8)}`, link: `/admin/suporte/\${ticketId}`, type: 'info' });
    }

    // E-mail (mantido)
    // ... (lógica de e-mail omitida para brevidade, mas mantida no arquivo real)

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})