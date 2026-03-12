// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer";
import { enqueueAdminWhatsappNotification } from "../_shared/whatsapp.ts";
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
    const reportId = typeof payload?.reportId === "string" ? payload.reportId.trim() : "";
    if (!reportId) {
      return new Response(JSON.stringify({ error: "reportId e obrigatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: report, error: reportError } = await supabaseAdmin
      .from("reports")
      .select("id, reporter_id, reported_id, reason, description")
      .eq("id", reportId)
      .maybeSingle();

    if (reportError || !report) {
      return new Response(JSON.stringify({ error: "Denuncia nao encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reportedProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", report.reported_id)
      .maybeSingle();

    const reportedName = reportedProfile?.full_name || "Perfil";
    const reportedEmail = reportedProfile?.email || null;
    const reasonLabel = report.reason || "Motivo nao informado";
    const description = report.description || "-";

    const widgetTitle = "Nova denuncia de perfil";
    const widgetContent = `O perfil de ${reportedName} foi denunciado por: ${reasonLabel}`;

    const { error: widgetError } = await supabaseAdmin.from("admin_notifications").insert({
      title: widgetTitle,
      content: widgetContent,
      link: "/admin/denuncias",
      type: "error",
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "report_created_admin",
      channel: "widget",
      status: widgetError ? "failed" : "sent",
      recipientKind: "admin",
      recipientContact: "admin_notifications",
      title: widgetTitle,
      content: widgetContent,
      errorMessage: widgetError?.message || null,
      metadata: { reportId },
    });

    try {
      await enqueueAdminWhatsappNotification({
        supabaseAdmin,
        eventType: "report_created_admin",
        templateParams: [reportedName, reasonLabel, "/admin/denuncias"],
        payload: {
          reportId,
          reported_email: reportedEmail,
        },
      });
    } catch (waError) {
      console.warn("[notify-report] falha ao enfileirar WhatsApp admin:", waError?.message || waError);
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpPort = Deno.env.get("SMTP_PORT") || "587";
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "contato@homecarematch.com.br";

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpPort === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      const emailSubject = `Nova Denuncia: ${reportedName}`;

      try {
        await transporter.sendMail({
          from: `"Seguranca HomeCare Match" <${smtpUser}>`,
          to: adminEmail,
          subject: emailSubject,
          html: `<div style="font-family: sans-serif; padding: 20px;"><h2 style="color: #ef4444;">Nova denuncia</h2><p><strong>Perfil:</strong> ${reportedName}</p><p><strong>Motivo:</strong> ${reasonLabel}</p><p><strong>Descricao:</strong> ${description}</p></div>`,
        });

        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "report_created_admin",
          channel: "email",
          status: "sent",
          recipientKind: "admin",
          recipientContact: adminEmail,
          title: emailSubject,
          metadata: { reportId },
        });
      } catch (emailError) {
        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "report_created_admin",
          channel: "email",
          status: "failed",
          recipientKind: "admin",
          recipientContact: adminEmail,
          title: emailSubject,
          errorMessage: emailError?.message || String(emailError),
          metadata: { reportId },
        });
      }
    } else {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType: "report_created_admin",
        channel: "email",
        status: "skipped",
        recipientKind: "admin",
        recipientContact: adminEmail,
        title: `Nova Denuncia: ${reportedName}`,
        errorMessage: "smtp_not_configured",
        metadata: { reportId },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[notify-report] erro:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
