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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeText = (value: unknown, max = 500) => String(value || "").trim().slice(0, max);
const normalizeEmail = (value: unknown) => normalizeText(value, 200).toLowerCase();
const normalizePixKeyType = (value: unknown) => {
  const raw = normalizeText(value, 20);
  if (!raw) return null;

  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (normalized === "cpf") return "cpf";
  if (normalized === "cnpj") return "cnpj";
  if (normalized === "email" || normalized === "mail") return "email";
  if (normalized === "phone" || normalized === "telefone" || normalized === "celular" || normalized === "whatsapp") {
    return "phone";
  }
  if (normalized === "random" || normalized === "aleatorio" || normalized === "aleatoria") return "random";

  return null;
};
const escapeHtml = (value: unknown) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolveSiteUrl = () => String(Deno.env.get("SITE_URL") || "https://www.homecarematch.com.br").replace(/\/+$/, "");

const notifyAffiliateInterest = async (supabaseAdmin: any, application: any) => {
  const fullName = String(application?.full_name || "Candidato");
  const email = String(application?.email || "");
  const phone = String(application?.phone || "");
  const audience = String(application?.audience || "Público não informado");
  const siteUrl = resolveSiteUrl();
  const detailsPath = "/admin/afiliados";
  const detailsLink = `${siteUrl}${detailsPath}`;

  const widgetTitle = "Nova candidatura de afiliado";
  const widgetContent = `${fullName} enviou cadastro de interesse (${email || "sem e-mail"}).`;

  try {
    const { error: widgetError } = await supabaseAdmin.from("admin_notifications").insert({
      title: widgetTitle,
      content: widgetContent,
      link: detailsPath,
      type: "info",
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_admin",
      channel: "widget",
      status: widgetError ? "failed" : "sent",
      recipientKind: "admin",
      recipientContact: "admin_notifications",
      title: widgetTitle,
      content: widgetContent,
      errorMessage: widgetError?.message || null,
      metadata: {
        application_id: application?.id || null,
        candidate_email: email || null,
      },
    });
  } catch (error: any) {
    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_admin",
      channel: "widget",
      status: "failed",
      recipientKind: "admin",
      recipientContact: "admin_notifications",
      title: widgetTitle,
      content: widgetContent,
      errorMessage: error?.message || String(error),
      metadata: {
        application_id: application?.id || null,
        candidate_email: email || null,
      },
    });
  }

  try {
    const waConfig = await getWhatsappTemplateConfig(supabaseAdmin, "affiliate_interest_admin", "admin");
    const configuredDetailsPath = getWhatsappTemplateVariation(
      waConfig,
      "details_path",
      String(waConfig?.var3Default || detailsPath),
    );

    const queued = await enqueueAdminWhatsappNotification({
      supabaseAdmin,
      eventType: "affiliate_interest_admin",
      templateParams: [
        String(fullName || waConfig?.var1Default || "Candidato"),
        String(audience || waConfig?.var2Default || "Público não informado"),
        configuredDetailsPath,
      ],
      payload: {
        application_id: application?.id || null,
        candidate_email: email || null,
        candidate_phone: phone || null,
      },
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_admin",
      channel: "whatsapp",
      status: queued?.queued
        ? "queued"
        : queued?.reason === "whatsapp_disabled" || queued?.reason === "invalid_admin_destination"
          ? "skipped"
          : "failed",
      recipientKind: "admin",
      recipientContact: "whatsapp_admin_destination",
      title: widgetTitle,
      content: widgetContent,
      errorMessage: queued?.queued ? null : queued?.reason || null,
      metadata: {
        application_id: application?.id || null,
      },
    });
  } catch (error: any) {
    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_admin",
      channel: "whatsapp",
      status: "failed",
      recipientKind: "admin",
      recipientContact: "whatsapp_admin_destination",
      title: widgetTitle,
      content: widgetContent,
      errorMessage: error?.message || String(error),
      metadata: {
        application_id: application?.id || null,
      },
    });
  }

  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpPort = Deno.env.get("SMTP_PORT") || "587";
  const adminEmail = Deno.env.get("ADMIN_EMAIL") || "contato@homecarematch.com.br";
  const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass);

  if (!hasSmtp) {
    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_admin",
      channel: "email",
      status: "skipped",
      recipientKind: "admin",
      recipientContact: adminEmail,
      title: widgetTitle,
      errorMessage: "smtp_not_configured",
      metadata: {
        application_id: application?.id || null,
      },
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_received_external",
      channel: "email",
      status: "skipped",
      recipientKind: "external",
      recipientContact: email || null,
      title: "Cadastro de afiliado recebido",
      errorMessage: "smtp_not_configured",
      metadata: {
        application_id: application?.id || null,
      },
    });

    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number.parseInt(smtpPort, 10),
    secure: smtpPort === "465",
    auth: { user: smtpUser, pass: smtpPass },
  });

  const location = [String(application?.city || "").trim(), String(application?.state || "").trim()]
    .filter(Boolean)
    .join(" - ") || "-";

  const adminSubject = `Nova candidatura de afiliado: ${fullName}`;

  try {
    await transporter.sendMail({
      from: `"HomeCare Match" <${smtpUser}>`,
      to: adminEmail,
      subject: adminSubject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 680px; margin: 0 auto; padding: 20px;">
          <h2 style="margin: 0 0 12px; color: #2563eb;">Nova candidatura de afiliado</h2>
          <p style="margin: 0 0 16px;">Um novo cadastro de interesse para o programa de afiliados foi recebido.</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr><td style="padding: 6px 0;"><strong>Nome:</strong></td><td>${escapeHtml(fullName)}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>E-mail:</strong></td><td>${escapeHtml(email || "-")}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Telefone:</strong></td><td>${escapeHtml(phone || "-")}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Cidade/Estado:</strong></td><td>${escapeHtml(location)}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Público:</strong></td><td>${escapeHtml(application?.audience || "-")}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>Experiência:</strong></td><td>${escapeHtml(application?.experience || "-")}</td></tr>
            <tr><td style="padding: 6px 0;"><strong>PIX:</strong></td><td>${escapeHtml(application?.pix_key_type || "-")} / ${escapeHtml(application?.pix_key || "-")}</td></tr>
          </table>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 12px; margin-bottom: 18px; white-space: pre-wrap;">
            ${escapeHtml(application?.message || "Sem mensagem complementar.")}
          </div>
          <a href="${detailsLink}" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
            Abrir candidaturas no admin
          </a>
        </div>
      `,
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_admin",
      channel: "email",
      status: "sent",
      recipientKind: "admin",
      recipientContact: adminEmail,
      title: adminSubject,
      metadata: {
        application_id: application?.id || null,
      },
    });
  } catch (error: any) {
    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_admin",
      channel: "email",
      status: "failed",
      recipientKind: "admin",
      recipientContact: adminEmail,
      title: adminSubject,
      errorMessage: error?.message || String(error),
      metadata: {
        application_id: application?.id || null,
      },
    });
  }

  const candidateEmail = email.includes("@") ? email : "";
  if (!candidateEmail) {
    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_received_external",
      channel: "email",
      status: "skipped",
      recipientKind: "external",
      recipientContact: email || null,
      title: "Cadastro de afiliado recebido",
      errorMessage: "invalid_candidate_email",
      metadata: {
        application_id: application?.id || null,
      },
    });
    return;
  }

  try {
    await transporter.sendMail({
      from: `"HomeCare Match" <${smtpUser}>`,
      to: candidateEmail,
      subject: "Recebemos seu cadastro de interesse de afiliado",
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 680px; margin: 0 auto; padding: 20px;">
          <h2 style="margin: 0 0 12px; color: #2563eb;">Cadastro recebido</h2>
          <p style="margin: 0 0 12px;">Olá, ${escapeHtml(fullName)}.</p>
          <p style="margin: 0 0 12px;">
            Recebemos seu cadastro de interesse para o programa de afiliados da HomeCare Match.
          </p>
          <p style="margin: 0 0 16px;">
            Nossa equipe vai analisar sua candidatura e entrar em contato em breve pelos dados informados.
          </p>
          <a href="${siteUrl}/afiliados" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
            Ver programa de afiliados
          </a>
        </div>
      `,
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_received_external",
      channel: "email",
      status: "sent",
      recipientKind: "external",
      recipientContact: candidateEmail,
      title: "Cadastro de afiliado recebido",
      metadata: {
        application_id: application?.id || null,
      },
    });
  } catch (error: any) {
    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "affiliate_interest_received_external",
      channel: "email",
      status: "failed",
      recipientKind: "external",
      recipientContact: candidateEmail,
      title: "Cadastro de afiliado recebido",
      errorMessage: error?.message || String(error),
      metadata: {
        application_id: application?.id || null,
      },
    });
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Payload inválido. Verifique os dados enviados." }, 400);
    }

    const fullName = normalizeText(body?.full_name, 180);
    const email = normalizeEmail(body?.email);
    const phone = normalizeText(body?.phone, 40);
    const city = normalizeText(body?.city, 120) || null;
    const state = normalizeText(body?.state, 80) || null;
    const pixKey = normalizeText(body?.pix_key, 160) || null;
    const rawPixKeyType = normalizeText(body?.pix_key_type, 20);
    const pixKeyType = normalizePixKeyType(rawPixKeyType);
    const audience = normalizeText(body?.audience, 120) || null;
    const experience = normalizeText(body?.experience, 120) || null;
    const message = normalizeText(body?.message, 2000) || null;
    const termsAccepted = body?.terms_accepted === true;
    const termsVersion = normalizeText(body?.terms_version, 50) || null;

    if (!fullName || !email || !phone) {
      return jsonResponse({ error: "Nome, e-mail e telefone são obrigatórios." }, 400);
    }
    if (!termsAccepted || !termsVersion) {
      return jsonResponse({ error: "Aceite do Termo e Condições é obrigatório para concluir o cadastro." }, 400);
    }
    if (rawPixKeyType && !pixKeyType) {
      return jsonResponse({ error: "Tipo de chave PIX inválido. Use: cpf, cnpj, email, phone ou random." }, 400);
    }

    const { data: existingApplication } = await supabaseAdmin
      .from("affiliate_applications")
      .select("id,status")
      .eq("email_normalized", email)
      .in("status", ["pending", "approved"])
      .maybeSingle();

    if (existingApplication?.id) {
      return jsonResponse({
        success: true,
        already_exists: true,
        status: existingApplication.status,
        message:
          existingApplication.status === "approved"
            ? "Seu cadastro de afiliado já foi aprovado."
            : "Já recebemos seu cadastro. Retornaremos em breve.",
      });
    }

    const { data: existingPartner } = await supabaseAdmin
      .from("affiliate_partners")
      .select("id,status")
      .ilike("email", email)
      .maybeSingle();

    if (existingPartner?.id) {
      return jsonResponse({
        success: true,
        already_exists: true,
        status: existingPartner.status || "active",
        message: "Já existe um parceiro afiliado com este e-mail.",
      });
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id,role")
      .ilike("email", email)
      .maybeSingle();

    if (existingProfile?.id) {
      return jsonResponse(
        {
          error: "Este e-mail já possui conta ativa na plataforma. O programa de afiliados é exclusivo para parceiros dedicados.",
        },
        409,
      );
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("affiliate_applications")
      .insert({
        full_name: fullName,
        email,
        email_normalized: email,
        phone,
        city,
        state,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        audience,
        experience,
        message,
        terms_accepted: true,
        terms_version: termsVersion,
        terms_accepted_at: new Date().toISOString(),
        status: "pending",
      })
      .select("id,status,created_at,full_name,email,phone,city,state,pix_key,pix_key_type,audience,experience,message,terms_accepted,terms_version,terms_accepted_at")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return jsonResponse({
          success: true,
          already_exists: true,
          status: "pending",
          message: "Já recebemos seu cadastro. Retornaremos em breve.",
        });
      }

      if (insertError.code === "23514" && String(insertError.message || "").includes("affiliate_applications_pix_type_check")) {
        return jsonResponse({ error: "Tipo de chave PIX inválido. Use: cpf, cnpj, email, phone ou random." }, 400);
      }

      throw insertError;
    }

    try {
      await notifyAffiliateInterest(supabaseAdmin, created);
    } catch (notifyError: any) {
      console.warn("[affiliate-register-interest] falha ao notificar candidatura:", notifyError?.message || notifyError);
    }

    return jsonResponse({
      success: true,
      application: created,
      message: "Cadastro recebido. Nossa equipe vai analisar e entrar em contato.",
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao registrar interesse de afiliado" }, 500);
  }
});
