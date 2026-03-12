// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer";
import { enqueueAdminWhatsappNotification } from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { requestId } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: "requestId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conciergeRequest, error: requestError } = await supabaseAdmin
      .from("concierge_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !conciergeRequest) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requesterId = authData.user.id;
    const { data: requesterProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, is_admin, role")
      .eq("id", requesterId)
      .maybeSingle();

    const isAdmin = requesterProfile?.is_admin || requesterProfile?.role === "admin";
    if (!isAdmin && conciergeRequest.user_id !== requesterId) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("admin_notifications").insert({
      title: "🎯 Novo pedido de Concierge",
      content: `${conciergeRequest.requester_name || "Usuário"} enviou uma solicitação de busca personalizada.`,
      link: "/admin/concierge",
      type: "info",
    });

    try {
      await enqueueAdminWhatsappNotification({
        supabaseAdmin,
        eventType: "concierge_request_admin",
        templateParams: [
          String(conciergeRequest.requester_name || "Usuario"),
          String(conciergeRequest.specialty || "Especialidade nao informada"),
          "/admin/concierge",
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
    const smtpPort = Deno.env.get("SMTP_PORT");
    const siteUrl = Deno.env.get("SITE_URL") || "https://www.homecarematch.com.br";
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "contato@homecarematch.com.br";

    if (smtpHost && smtpUser && smtpPass && smtpPort) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpPort === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      const roleLabel = conciergeRequest.requester_role === "company" ? "Empresa" : "Família";
      const urgencyLabel =
        conciergeRequest.urgency === "urgente-24h"
          ? "Urgente (até 24h)"
          : conciergeRequest.urgency === "sem-urgencia"
          ? "Sem urgência"
          : "Ainda esta semana";

      await transporter.sendMail({
        from: `"HomeCare Match" <${smtpUser}>`,
        to: adminEmail,
        subject: `🎯 Novo Pedido Concierge (${roleLabel})`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 680px; margin: 0 auto; padding: 20px;">
            <h2 style="margin: 0 0 12px; color: #2563eb;">Nova Solicitação de Concierge</h2>
            <p style="margin: 0 0 16px;">Uma nova solicitação de busca personalizada foi enviada.</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <tr><td style="padding: 6px 0;"><strong>Solicitante:</strong></td><td>${conciergeRequest.requester_name || "-"}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>E-mail:</strong></td><td>${conciergeRequest.requester_email || "-"}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Tipo:</strong></td><td>${roleLabel}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Especialidade:</strong></td><td>${conciergeRequest.specialty || "-"}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Cidade/UF:</strong></td><td>${[conciergeRequest.city, conciergeRequest.state].filter(Boolean).join(" - ") || "-"}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Bairro:</strong></td><td>${conciergeRequest.neighborhood || "-"}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Disponibilidade:</strong></td><td>${conciergeRequest.availability || "-"}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Público-alvo:</strong></td><td>${conciergeRequest.patient_profile || "-"}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Valor/Hora Máx.:</strong></td><td>${conciergeRequest.max_hourly_rate ? `R$ ${Number(conciergeRequest.max_hourly_rate).toFixed(2).replace(".", ",")}` : "-"}</td></tr>
              <tr><td style="padding: 6px 0;"><strong>Urgência:</strong></td><td>${urgencyLabel}</td></tr>
            </table>
            <div style="background: #f3f4f6; border-radius: 8px; padding: 12px; margin-bottom: 18px; white-space: pre-wrap;">
              ${conciergeRequest.details}
            </div>
            <a href="${siteUrl}/admin/concierge" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
              Abrir Painel Concierge
            </a>
          </div>
        `,
      });
    } else {
      console.warn("[notify-concierge] SMTP não configurado. E-mail não enviado.");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notify-concierge] Erro:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
