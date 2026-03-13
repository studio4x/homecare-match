// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer";
import {
  enqueueAdminWhatsappNotification,
  getWhatsappTemplateConfig,
  getWhatsappTemplateVariation,
} from "../_shared/whatsapp.ts";
import { logNotificationDelivery } from "../_shared/notification-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const payload = await req.json();
    const requestId = typeof payload?.requestId === "string" ? payload.requestId.trim() : "";
    if (!requestId) {
      return new Response(JSON.stringify({ error: "requestId e obrigatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional auth: if token exists and is valid, enforce ownership/admin.
    let requesterId: string | null = null;
    let isAdmin = false;
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "").trim() || "";
    const bodyToken = typeof payload?.access_token === "string" ? payload.access_token.trim() : "";
    const token = bearerToken || bodyToken;

    if (token) {
      const { data: authData } = await supabaseAdmin.auth.getUser(token);
      requesterId = authData?.user?.id || null;

      if (requesterId) {
        const { data: requesterProfile } = await supabaseAdmin
          .from("profiles")
          .select("is_admin, role")
          .eq("id", requesterId)
          .maybeSingle();
        isAdmin = Boolean(requesterProfile?.is_admin || requesterProfile?.role === "admin");
      }
    }

    const { data: conciergeRequest, error: requestError } = await supabaseAdmin
      .from("concierge_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !conciergeRequest) {
      return new Response(JSON.stringify({ error: "Solicitacao nao encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requesterId && !isAdmin && conciergeRequest.user_id !== requesterId) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const widgetTitle = "Novo pedido de concierge";
    const widgetContent = `${conciergeRequest.requester_name || "Usuario"} enviou uma solicitacao de busca personalizada.`;

    const { error: widgetError } = await supabaseAdmin.from("admin_notifications").insert({
      title: widgetTitle,
      content: widgetContent,
      link: "/admin/concierge",
      type: "info",
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "concierge_request_admin",
      channel: "widget",
      status: widgetError ? "failed" : "sent",
      recipientKind: "admin",
      recipientContact: "admin_notifications",
      title: widgetTitle,
      content: widgetContent,
      errorMessage: widgetError?.message || null,
      metadata: { requestId },
    });

    try {
      const waConfig = await getWhatsappTemplateConfig(supabaseAdmin, "concierge_request_admin", "admin");
      const detailsPath = getWhatsappTemplateVariation(
        waConfig,
        "details_path",
        String(waConfig?.var3Default || "/admin/concierge"),
      );

      await enqueueAdminWhatsappNotification({
        supabaseAdmin,
        eventType: "concierge_request_admin",
        templateParams: [
          String(conciergeRequest.requester_name || waConfig?.var1Default || "Usuario"),
          String(conciergeRequest.specialty || waConfig?.var2Default || "Especialidade nao informada"),
          detailsPath,
        ],
        payload: {
          requestId,
          requester_email: conciergeRequest.requester_email || null,
          requester_role: conciergeRequest.requester_role || null,
        },
      });
    } catch (waError) {
      console.warn("[notify-concierge] falha ao enfileirar WhatsApp admin:", waError?.message || waError);
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpPort = Deno.env.get("SMTP_PORT") || "587";
    const siteUrl = Deno.env.get("SITE_URL") || "https://www.homecarematch.com.br";
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "contato@homecarematch.com.br";

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpPort === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      const roleLabel = conciergeRequest.requester_role === "company" ? "Empresa" : "Familia";
      const urgencyLabel =
        conciergeRequest.urgency === "urgente-24h"
          ? "Urgente (ate 24h)"
          : conciergeRequest.urgency === "sem-urgencia"
            ? "Sem urgencia"
            : "Ainda esta semana";

      const emailSubject = `Novo Pedido Concierge (${roleLabel})`;

      try {
        await transporter.sendMail({
          from: `"HomeCare Match" <${smtpUser}>`,
          to: adminEmail,
          subject: emailSubject,
          html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 680px; margin: 0 auto; padding: 20px;">
              <h2 style="margin: 0 0 12px; color: #2563eb;">Nova Solicitacao de Concierge</h2>
              <p style="margin: 0 0 16px;">Uma nova solicitacao de busca personalizada foi enviada.</p>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                <tr><td style="padding: 6px 0;"><strong>Solicitante:</strong></td><td>${conciergeRequest.requester_name || "-"}</td></tr>
                <tr><td style="padding: 6px 0;"><strong>E-mail:</strong></td><td>${conciergeRequest.requester_email || "-"}</td></tr>
                <tr><td style="padding: 6px 0;"><strong>Tipo:</strong></td><td>${roleLabel}</td></tr>
                <tr><td style="padding: 6px 0;"><strong>Especialidade:</strong></td><td>${conciergeRequest.specialty || "-"}</td></tr>
                <tr><td style="padding: 6px 0;"><strong>Estado/Cidade:</strong></td><td>${[conciergeRequest.state, conciergeRequest.city].filter(Boolean).join(" - ") || "-"}</td></tr>
                <tr><td style="padding: 6px 0;"><strong>Bairro:</strong></td><td>${conciergeRequest.neighborhood || "-"}</td></tr>
                <tr><td style="padding: 6px 0;"><strong>Disponibilidade:</strong></td><td>${conciergeRequest.availability || "-"}</td></tr>
                <tr><td style="padding: 6px 0;"><strong>Publico-alvo:</strong></td><td>${conciergeRequest.patient_profile || "-"}</td></tr>
                <tr><td style="padding: 6px 0;"><strong>Valor/Hora Max.:</strong></td><td>${conciergeRequest.max_hourly_rate ? `R$ ${Number(conciergeRequest.max_hourly_rate).toFixed(2).replace(".", ",")}` : "-"}</td></tr>
                <tr><td style="padding: 6px 0;"><strong>Urgencia:</strong></td><td>${urgencyLabel}</td></tr>
              </table>
              <div style="background: #f3f4f6; border-radius: 8px; padding: 12px; margin-bottom: 18px; white-space: pre-wrap;">
                ${conciergeRequest.details || "-"}
              </div>
              <a href="${siteUrl}/admin/concierge" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
                Abrir Painel Concierge
              </a>
            </div>
          `,
        });

        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "concierge_request_admin",
          channel: "email",
          status: "sent",
          recipientKind: "admin",
          recipientContact: adminEmail,
          title: emailSubject,
          metadata: { requestId },
        });
      } catch (emailError) {
        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "concierge_request_admin",
          channel: "email",
          status: "failed",
          recipientKind: "admin",
          recipientContact: adminEmail,
          title: emailSubject,
          errorMessage: emailError?.message || String(emailError),
          metadata: { requestId },
        });
      }
    } else {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType: "concierge_request_admin",
        channel: "email",
        status: "skipped",
        recipientKind: "admin",
        recipientContact: adminEmail,
        title: "Novo Pedido Concierge",
        errorMessage: "smtp_not_configured",
        metadata: { requestId },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[notify-concierge] erro:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
