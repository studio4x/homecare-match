// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, ticketId, senderId } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error("Ticket nao encontrado.");
    }

    const { data: ticketOwner } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", ticket.user_id)
      .maybeSingle();

    const { data: sender } = await supabaseAdmin
      .from("profiles")
      .select("full_name, role, is_admin")
      .eq("id", senderId)
      .maybeSingle();

    const isAdminAction = Boolean(sender?.is_admin || sender?.role === "admin");

    const siteUrl = Deno.env.get("SITE_URL") || "https://www.homecarematch.com.br";
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "contato@homecarematch.com.br";

    const sendAdminEmail = async (subject: string, html: string) => {
      if (!smtpHost || !smtpUser || !smtpPass || !smtpPort) {
        console.warn("[notify-support] SMTP nao configurado. E-mail nao enviado.");
        return;
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number.parseInt(smtpPort, 10),
        secure: smtpPort === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"HomeCare Match" <${smtpUser}>`,
        to: adminEmail,
        subject,
        html,
      });
    };

    if (isAdminAction) {
      let title = "Nova resposta no suporte";
      let content = `Nossa equipe respondeu ao seu chamado: "${ticket.subject}"`;

      if (type === "ticket_closed") {
        title = "Chamado encerrado";
        content = `Seu chamado "${ticket.subject}" foi marcado como resolvido.`;
      } else if (ticket.status === "in_progress") {
        title = "Chamado em atendimento";
        content = `Seu chamado "${ticket.subject}" agora esta sendo analisado por nossa equipe.`;
      }

      await supabaseAdmin.from("notifications").insert({
        user_id: ticket.user_id,
        title,
        content,
        link: `/dashboard/suporte/${ticketId}`,
        type: "info",
      });
    }

    if (type === "new_ticket") {
      await supabaseAdmin.from("admin_notifications").insert({
        title: "Novo ticket aberto",
        content: `O usuario ${ticketOwner?.full_name || "Usuario"} abriu um chamado: "${ticket.subject}"`,
        link: `/admin/suporte/${ticketId}`,
        type: "warning",
      });

      const ownerName = ticketOwner?.full_name || "Usuario";
      const ownerEmail = ticketOwner?.email || "E-mail nao informado";
      const ticketSubject = ticket?.subject || "Sem assunto";
      const ticketCategory = ticket?.category || "nao informada";
      const ticketPriority = ticket?.priority || "nao definida";
      const ticketUrl = `${siteUrl}/admin/suporte/${ticketId}`;

      await sendAdminEmail(
        `Novo ticket de suporte: ${ticketSubject}`,
        `
          <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 680px; margin: 0 auto; padding: 20px;">
            <h2 style="margin: 0 0 12px; color: #2563eb;">Novo Ticket de Suporte</h2>
            <p style="margin: 0 0 16px;">Um novo chamado foi aberto na plataforma.</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <tr><td style="padding: 6px 0;"><strong>Usuario:</strong></td><td>${ownerName}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>E-mail:</strong></td><td>${ownerEmail}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Assunto:</strong></td><td>${ticketSubject}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Categoria:</strong></td><td>${ticketCategory}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Prioridade:</strong></td><td>${ticketPriority}</td></tr>
            </table>
            <a href="${ticketUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
              Abrir ticket no admin
            </a>
          </div>
        `,
      );
    } else if (type === "new_message" && !isAdminAction) {
      await supabaseAdmin.from("admin_notifications").insert({
        title: "Nova mensagem em ticket",
        content: `${ticketOwner?.full_name || "Usuario"} respondeu no ticket #${String(ticketId).slice(0, 8)}`,
        link: `/admin/suporte/${ticketId}`,
        type: "info",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notify-support] erro:", error?.message || error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
