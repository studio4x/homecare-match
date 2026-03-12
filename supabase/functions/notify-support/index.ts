// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer";
import {
  enqueueAdminWhatsappNotification,
  enqueueUserWhatsappNotification,
} from "../_shared/whatsapp.ts";
import { logNotificationDelivery } from "../_shared/notification-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, ticketId, senderId } = payload || {};

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "").trim() || "";
    const bodyToken = typeof payload?.access_token === "string" ? payload.access_token.trim() : "";
    const token = bearerToken || bodyToken;

    if (!token) {
      return new Response(JSON.stringify({ error: "Nao autorizado: token ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Nao autorizado: token invalido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorId = authData.user.id;
    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, role, is_admin")
      .eq("id", actorId)
      .maybeSingle();

    const actorIsAdmin = Boolean(actorProfile?.is_admin || actorProfile?.role === "admin");

    if (senderId && senderId !== actorId && !actorIsAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado: remetente invalido." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket nao encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!actorIsAdmin && ticket.user_id !== actorId) {
      return new Response(JSON.stringify({ error: "Acesso negado ao ticket." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "ticket_closed" && !actorIsAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admin pode encerrar ticket." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ticketOwner } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", ticket.user_id)
      .maybeSingle();

    const siteUrl = Deno.env.get("SITE_URL") || "https://www.homecarematch.com.br";
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "contato@homecarematch.com.br";
    const hasSmtpConfig = !!(smtpHost && smtpUser && smtpPass && smtpPort);

    const sendEmail = async (to: string, subject: string, html: string) => {
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
        to,
        subject,
        html,
      });
    };

    const sendAdminEmail = async (subject: string, html: string) => {
      await sendEmail(adminEmail, subject, html);
    };

    if (actorIsAdmin) {
      let title = "Nova resposta no suporte";
      let content = `Nossa equipe respondeu ao seu chamado: "${ticket.subject}"`;

      if (type === "ticket_closed") {
        title = "Chamado encerrado";
        content = `Seu chamado "${ticket.subject}" foi marcado como resolvido.`;
      } else if (ticket.status === "in_progress") {
        title = "Chamado em atendimento";
        content = `Seu chamado "${ticket.subject}" agora esta sendo analisado por nossa equipe.`;
      }

      const { error: widgetError } = await supabaseAdmin.from("notifications").insert({
        user_id: ticket.user_id,
        title,
        content,
        link: `/dashboard/suporte/${ticketId}`,
        type: "info",
      });
      await logNotificationDelivery({
        supabaseAdmin,
        eventType: type === "ticket_closed" ? "support_ticket_closed_user" : "support_new_message_user",
        channel: "widget",
        status: widgetError ? "failed" : "sent",
        recipientKind: "user",
        recipientUserId: ticket.user_id,
        recipientContact: ticketOwner?.email || null,
        title,
        content,
        errorMessage: widgetError?.message || null,
        metadata: { ticketId, type },
      });
      if (widgetError) throw widgetError;

      if (type === "new_message" || type === "ticket_closed") {
        try {
          await enqueueUserWhatsappNotification({
            supabaseAdmin,
            userId: ticket.user_id,
            eventType: type === "ticket_closed" ? "support_ticket_closed_user" : "support_new_message_user",
            templateParams: [
              String(ticket?.subject || "Chamado"),
              type === "ticket_closed" ? "foi encerrado pela equipe" : "recebeu nova resposta da equipe",
              `/dashboard/suporte/${ticketId}`,
            ],
            payload: {
              ticketId,
              type,
            },
          });
        } catch (waError) {
          console.warn("[notify-support] falha ao enfileirar WhatsApp para usuario:", waError?.message || waError);
        }
      }

      const ownerEmail = ticketOwner?.email || "";
      const ownerName = ticketOwner?.full_name || "Usuario";
      const ticketSubject = ticket?.subject || "Sem assunto";
      const userTicketUrl = `${siteUrl}/dashboard/suporte/${ticketId}`;
      const canEmailOwner = ownerEmail.includes("@");

      if (canEmailOwner && (type === "new_message" || type === "ticket_closed")) {
        const emailSubject =
          type === "ticket_closed"
            ? `Chamado encerrado: ${ticketSubject}`
            : `Seu ticket recebeu nova resposta: ${ticketSubject}`;

        const emailTitle = type === "ticket_closed" ? "Chamado Encerrado" : "Nova Resposta no Suporte";
        const emailDescription =
          type === "ticket_closed"
            ? `Seu chamado "${ticketSubject}" foi encerrado por nossa equipe.`
            : `Nossa equipe respondeu ao seu chamado "${ticketSubject}".`;

        if (!hasSmtpConfig) {
          await logNotificationDelivery({
            supabaseAdmin,
            eventType: type === "ticket_closed" ? "support_ticket_closed_user" : "support_new_message_user",
            channel: "email",
            status: "skipped",
            recipientKind: "user",
            recipientUserId: ticket.user_id,
            recipientContact: ownerEmail,
            title: emailSubject,
            errorMessage: "smtp_not_configured",
            metadata: { ticketId, type },
          });
        } else {
          try {
            await sendEmail(
              ownerEmail,
              emailSubject,
              `
                <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 680px; margin: 0 auto; padding: 20px;">
                  <h2 style="margin: 0 0 12px; color: #2563eb;">${emailTitle}</h2>
                  <p style="margin: 0 0 16px;">Ola, ${ownerName}.</p>
                  <p style="margin: 0 0 16px;">${emailDescription}</p>
                  <a href="${userTicketUrl}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
                    Abrir meu chamado
                  </a>
                </div>
              `,
            );
            await logNotificationDelivery({
              supabaseAdmin,
              eventType: type === "ticket_closed" ? "support_ticket_closed_user" : "support_new_message_user",
              channel: "email",
              status: "sent",
              recipientKind: "user",
              recipientUserId: ticket.user_id,
              recipientContact: ownerEmail,
              title: emailSubject,
              metadata: { ticketId, type },
            });
          } catch (emailError) {
            console.error("[notify-support] falha ao enviar e-mail para usuario:", emailError?.message || emailError);
            await logNotificationDelivery({
              supabaseAdmin,
              eventType: type === "ticket_closed" ? "support_ticket_closed_user" : "support_new_message_user",
              channel: "email",
              status: "failed",
              recipientKind: "user",
              recipientUserId: ticket.user_id,
              recipientContact: ownerEmail,
              title: emailSubject,
              errorMessage: emailError?.message || String(emailError),
              metadata: { ticketId, type },
            });
          }
        }
      } else if (type === "new_message" || type === "ticket_closed") {
        await logNotificationDelivery({
          supabaseAdmin,
          eventType: type === "ticket_closed" ? "support_ticket_closed_user" : "support_new_message_user",
          channel: "email",
          status: "skipped",
          recipientKind: "user",
          recipientUserId: ticket.user_id,
          recipientContact: ownerEmail || null,
          title: ticketSubject,
          errorMessage: "invalid_owner_email",
          metadata: { ticketId, type },
        });
      }
    }

    if (type === "new_ticket") {
      const ownerName = ticketOwner?.full_name || "Usuario";
      const ownerEmail = ticketOwner?.email || "E-mail nao informado";
      const ticketSubject = ticket?.subject || "Sem assunto";
      const ticketCategory = ticket?.category || "nao informada";
      const ticketPriority = ticket?.priority || "nao definida";
      const ticketUrl = `${siteUrl}/admin/suporte/${ticketId}`;

      const { error: adminWidgetError } = await supabaseAdmin.from("admin_notifications").insert({
        title: "Novo ticket aberto",
        content: `O usuario ${ownerName} abriu um chamado: "${ticketSubject}"`,
        link: `/admin/suporte/${ticketId}`,
        type: "warning",
      });
      await logNotificationDelivery({
        supabaseAdmin,
        eventType: "support_new_ticket_admin",
        channel: "widget",
        status: adminWidgetError ? "failed" : "sent",
        recipientKind: "admin",
        recipientContact: "admin_notifications",
        title: "Novo ticket aberto",
        content: `O usuario ${ownerName} abriu um chamado: "${ticketSubject}"`,
        errorMessage: adminWidgetError?.message || null,
        metadata: { ticketId, ownerEmail, priority: ticketPriority, category: ticketCategory },
      });
      if (adminWidgetError) throw adminWidgetError;

      try {
        await enqueueAdminWhatsappNotification({
          supabaseAdmin,
          eventType: "support_new_ticket_admin",
          templateParams: [
            ownerName,
            ticketSubject,
            `/admin/suporte/${ticketId}`,
          ],
          payload: {
            ticketId,
            ownerEmail,
            priority: ticketPriority,
            category: ticketCategory,
          },
        });
      } catch (waError) {
        console.warn("[notify-support] falha ao enfileirar WhatsApp admin (new_ticket):", waError?.message || waError);
      }

      const adminEmailSubject = `Novo ticket de suporte: ${ticketSubject}`;
      if (!hasSmtpConfig) {
        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "support_new_ticket_admin",
          channel: "email",
          status: "skipped",
          recipientKind: "admin",
          recipientContact: adminEmail,
          title: adminEmailSubject,
          errorMessage: "smtp_not_configured",
          metadata: { ticketId, ownerEmail, priority: ticketPriority, category: ticketCategory },
        });
      } else {
        try {
          await sendAdminEmail(
            adminEmailSubject,
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
          await logNotificationDelivery({
            supabaseAdmin,
            eventType: "support_new_ticket_admin",
            channel: "email",
            status: "sent",
            recipientKind: "admin",
            recipientContact: adminEmail,
            title: adminEmailSubject,
            metadata: { ticketId, ownerEmail, priority: ticketPriority, category: ticketCategory },
          });
        } catch (emailError) {
          console.error("[notify-support] falha ao enviar e-mail admin:", emailError?.message || emailError);
          await logNotificationDelivery({
            supabaseAdmin,
            eventType: "support_new_ticket_admin",
            channel: "email",
            status: "failed",
            recipientKind: "admin",
            recipientContact: adminEmail,
            title: adminEmailSubject,
            errorMessage: emailError?.message || String(emailError),
            metadata: { ticketId, ownerEmail, priority: ticketPriority, category: ticketCategory },
          });
        }
      }
    } else if (type === "new_message" && !actorIsAdmin) {
      const { error: adminWidgetError } = await supabaseAdmin.from("admin_notifications").insert({
        title: "Nova mensagem em ticket",
        content: `${ticketOwner?.full_name || "Usuario"} respondeu no ticket #${String(ticketId).slice(0, 8)}`,
        link: `/admin/suporte/${ticketId}`,
        type: "info",
      });
      await logNotificationDelivery({
        supabaseAdmin,
        eventType: "support_new_message_admin",
        channel: "widget",
        status: adminWidgetError ? "failed" : "sent",
        recipientKind: "admin",
        recipientContact: "admin_notifications",
        title: "Nova mensagem em ticket",
        content: `${ticketOwner?.full_name || "Usuario"} respondeu no ticket #${String(ticketId).slice(0, 8)}`,
        errorMessage: adminWidgetError?.message || null,
        metadata: { ticketId, senderId: actorId },
      });
      if (adminWidgetError) throw adminWidgetError;

      try {
        await enqueueAdminWhatsappNotification({
          supabaseAdmin,
          eventType: "support_new_message_admin",
          templateParams: [
            String(ticketOwner?.full_name || "Usuario"),
            String(ticket?.subject || "Chamado"),
            `/admin/suporte/${ticketId}`,
          ],
          payload: {
            ticketId,
            senderId: actorId,
          },
        });
      } catch (waError) {
        console.warn("[notify-support] falha ao enfileirar WhatsApp admin (new_message):", waError?.message || waError);
      }
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
