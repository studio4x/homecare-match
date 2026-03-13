// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer";
import {
  enqueueUserWhatsappNotification,
  getWhatsappTemplateConfig,
  getWhatsappTemplateVariation,
} from "../_shared/whatsapp.ts";
import { logNotificationDelivery } from "../_shared/notification-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const payload = await req.json();
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
    const adminUser = authData?.user;
    if (authError || !adminUser) {
      return new Response(JSON.stringify({ error: "Nao autorizado: token invalido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", adminUser.id)
      .maybeSingle();

    const isAdmin = Boolean(actorProfile?.is_admin || actorProfile?.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado: apenas admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = normalizeString(payload?.status);
    const reason = normalizeString(payload?.reason);
    const rejectionReason = reason || "nao informado";

    let userName = normalizeString(payload?.userName);
    let userEmail = normalizeString(payload?.userEmail).toLowerCase();
    let userId = normalizeString(payload?.userId) || normalizeString(payload?.user_id);

    if (status !== "approved" && status !== "rejected") {
      return new Response(JSON.stringify({ error: "status invalido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userId && userEmail) {
      const { data: profileByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();

      if (profileByEmail?.id) {
        userId = profileByEmail.id;
      }
    }

    if (!userId || !UUID_REGEX.test(userId)) {
      return new Response(JSON.stringify({ error: "userId ausente." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (!targetProfile?.id) {
      return new Response(JSON.stringify({ error: "Usuario de destino nao encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userName) userName = targetProfile.full_name || "Usuario";
    if (!userEmail) userEmail = (targetProfile.email || "").toLowerCase();

    const widgetTitle = status === "approved" ? "Documentos Aprovados" : "Documentos Rejeitados";
    const widgetContent =
      status === "approved"
        ? "Parabens! Seus documentos foram validados e voce agora possui o selo de verificado."
        : `Infelizmente sua verificacao nao foi aprovada. Motivo: ${rejectionReason}. Por favor, reenvie seus dados.`;

    const recentThresholdIso = new Date(Date.now() - 90 * 1000).toISOString();
    const { data: recentNotification } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("title", widgetTitle)
      .eq("content", widgetContent)
      .gte("created_at", recentThresholdIso)
      .limit(1)
      .maybeSingle();

    let widgetError: unknown = null;
    let widgetStatus: "sent" | "failed" | "skipped" = "sent";

    if (recentNotification?.id) {
      widgetStatus = "skipped";
    } else {
      const { error } = await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title: widgetTitle,
        content: widgetContent,
        link: "/dashboard/perfil",
        type: status === "approved" ? "success" : "error",
      });

      widgetError = error;
      widgetStatus = widgetError ? "failed" : "sent";
    }

    await logNotificationDelivery({
      supabaseAdmin,
      eventType: status === "approved" ? "verification_approved_user" : "verification_rejected_user",
      channel: "widget",
      status: widgetStatus,
      recipientKind: "user",
      recipientUserId: userId || null,
      recipientContact: userEmail || null,
      title: status === "approved" ? "Documentos Aprovados" : "Documentos Rejeitados",
      content: status === "approved" ? "Seus documentos foram validados." : `Motivo da reprovacao: ${rejectionReason}.`,
      errorMessage: widgetError?.message || (widgetStatus === "skipped" ? "duplicate_recent_notification" : null),
      metadata: { status, reason: reason || null },
    });

    if (widgetError) throw widgetError;

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: adminUser.id,
      action_type: status === "approved" ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED",
      target_id: userId,
      details:
        status === "approved"
          ? `Aprovou os documentos de: ${userName} (${userEmail || "sem_email"})`
          : `Reprovou os documentos de: ${userName} (${userEmail || "sem_email"}). Motivo: ${rejectionReason}`,
    });

    try {
      const waEventType = status === "approved" ? "verification_approved_user" : "verification_rejected_user";
      const waConfig = await getWhatsappTemplateConfig(supabaseAdmin, waEventType, "user");
      const statusTextDefault = status === "approved"
        ? "sua verificacao foi aprovada"
        : "sua verificacao foi reprovada";
      const statusText = getWhatsappTemplateVariation(
        waConfig,
        "status_text",
        String(waConfig?.var2Default || statusTextDefault),
      );
      const detailsValue = status === "approved"
        ? getWhatsappTemplateVariation(
            waConfig,
            "details_path",
            String(waConfig?.var3Default || "/dashboard/perfil"),
          )
        : String(
            rejectionReason ||
              getWhatsappTemplateVariation(
                waConfig,
                "rejection_reason_fallback",
                String(waConfig?.var3Default || "nao informado"),
              ),
          );

      await enqueueUserWhatsappNotification({
        supabaseAdmin,
        userId,
        eventType: waEventType,
        templateParams: [
          String(userName || waConfig?.var1Default || "Usuario"),
          statusText,
          detailsValue,
        ],
        payload: {
          status,
          reason: rejectionReason || null,
          userEmail: userEmail || null,
        },
      });
    } catch (waError) {
      console.warn("[verification-result] falha ao enfileirar WhatsApp:", waError?.message || waError);
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpPort = Deno.env.get("SMTP_PORT");

    if (smtpHost && smtpUser && smtpPass && smtpPort && userEmail) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpPort === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      const emailSubject =
        status === "approved"
          ? "Sua Verificacao de Perfil Foi Aprovada"
          : "Sua Verificacao de Perfil Foi Rejeitada";

      const emailHtml =
        status === "approved"
          ? `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #28a745;">Parabens, ${userName}!</h2>
              <p>Seus documentos foram validados com sucesso.</p>
              <p>Seu perfil agora possui selo de verificado.</p>
              <p><a href="${Deno.env.get("SITE_URL")}/dashboard/perfil" style="display:inline-block;padding:10px 20px;background-color:#007bff;color:white;text-decoration:none;border-radius:5px;">Ir para Meu Perfil</a></p>
              <p>Equipe HomeCare Match</p>
            </div>
          `
          : `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #dc3545;">Ola, ${userName}!</h2>
              <p>Sua solicitacao de verificacao foi rejeitada.</p>
              <p><strong>Motivo da rejeicao:</strong> ${rejectionReason}</p>
              <p>Acesse seu painel para ajustar os dados e reenviar os documentos.</p>
              <p><a href="${Deno.env.get("SITE_URL")}/dashboard/perfil" style="display:inline-block;padding:10px 20px;background-color:#007bff;color:white;text-decoration:none;border-radius:5px;">Acessar Meu Perfil</a></p>
              <p>Equipe HomeCare Match</p>
            </div>
          `;

      try {
        await transporter.sendMail({
          from: `"HomeCare Match" <${smtpUser}>`,
          to: userEmail,
          subject: emailSubject,
          html: emailHtml,
        });

        await logNotificationDelivery({
          supabaseAdmin,
          eventType: status === "approved" ? "verification_approved_user" : "verification_rejected_user",
          channel: "email",
          status: "sent",
          recipientKind: "user",
          recipientUserId: userId || null,
          recipientContact: userEmail || null,
          title: emailSubject,
          metadata: { status, reason: rejectionReason || null },
        });
      } catch (emailError) {
        await logNotificationDelivery({
          supabaseAdmin,
          eventType: status === "approved" ? "verification_approved_user" : "verification_rejected_user",
          channel: "email",
          status: "failed",
          recipientKind: "user",
          recipientUserId: userId || null,
          recipientContact: userEmail || null,
          title: emailSubject,
          errorMessage: emailError?.message || String(emailError),
          metadata: { status, reason: rejectionReason || null },
        });
        throw emailError;
      }
    } else {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType: status === "approved" ? "verification_approved_user" : "verification_rejected_user",
        channel: "email",
        status: "skipped",
        recipientKind: "user",
        recipientUserId: userId || null,
        recipientContact: userEmail || null,
        title: status === "approved" ? "Sua Verificacao de Perfil Foi Aprovada" : "Sua Verificacao de Perfil Foi Rejeitada",
        errorMessage: !userEmail ? "missing_user_email" : "smtp_not_configured",
        metadata: { status, reason: rejectionReason || null },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[verification-result] Erro critico:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
