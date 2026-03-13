// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer";
import {
  enqueueUserWhatsappNotification,
  getWhatsappTemplateConfig,
  getWhatsappTemplateVariation,
} from "../_shared/whatsapp.ts";
import { logNotificationDelivery } from "../_shared/notification-log.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { professional_id, sender_id, interaction_id } = await req.json();
    if (!professional_id || !sender_id) {
      return new Response(JSON.stringify({ error: "professional_id e sender_id são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // O fluxo oficial de disparo vem do trigger em interactions (com interaction_id).
    // Chamadas legadas do frontend são ignoradas para evitar duplicidade.
    if (!interaction_id) {
      return new Response(JSON.stringify({ success: true, ignored_legacy_call: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let senderName = "Usuário";
    let senderRole = "family";
    const { data: sender, error: senderError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role')
      .eq('id', sender_id)
      .maybeSingle();
    if (senderError) {
      console.warn("[notify-contact] erro ao buscar remetente:", senderError.message);
    }
    if (sender?.full_name) senderName = sender.full_name;
    if (sender?.role) senderRole = sender.role;

    let professionalEmail: string | null = null;
    let professionalName = "Profissional";
    const { data: professional, error: professionalError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', professional_id)
      .maybeSingle();
    if (professionalError) {
      console.warn("[notify-contact] erro ao buscar profissional:", professionalError.message);
    }
    if (professional?.email) professionalEmail = professional.email;
    if (professional?.full_name) professionalName = professional.full_name;

    const senderType = senderRole === 'company' ? 'A empresa' : 'Uma família';
    const { error: widgetError } = await supabaseAdmin.from('notifications').insert({
      user_id: professional_id,
      title: "👤 Novo Interesse no seu Perfil!",
      content: `${senderType} (${senderName}) salvou seu contato e pode te chamar no WhatsApp em breve.`,
      link: "/dashboard/contatos",
      type: 'info'
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "new_contact_interest_user",
      channel: "widget",
      status: widgetError ? "failed" : "sent",
      recipientKind: "user",
      recipientUserId: professional_id,
      title: "Novo Interesse no seu Perfil",
      content: `${senderType} (${senderName}) salvou seu contato.`,
      errorMessage: widgetError?.message || null,
      metadata: { sender_id, interaction_id: interaction_id || null },
    });

    if (widgetError) throw widgetError;

    try {
      const waConfig = await getWhatsappTemplateConfig(supabaseAdmin, "new_contact_interest_user", "user");
      const actionText = getWhatsappTemplateVariation(
        waConfig,
        "action_text",
        String(waConfig?.var2Default || "demonstrou interesse no seu perfil"),
      );
      const contactPath = getWhatsappTemplateVariation(
        waConfig,
        "cta_path",
        String(waConfig?.var3Default || "/dashboard/contatos"),
      );
      const senderNameParam = String(senderName || waConfig?.var1Default || "Um recrutador");

      await enqueueUserWhatsappNotification({
        supabaseAdmin,
        userId: professional_id,
        eventType: "new_contact_interest_user",
        templateParams: [
          senderNameParam,
          actionText,
          contactPath,
        ],
        payload: {
          professional_id,
          sender_id,
          interaction_id: interaction_id || null,
        },
      });
    } catch (waError) {
      console.warn("[notify-contact] falha ao enfileirar WhatsApp:", waError?.message || waError);
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const siteUrl = Deno.env.get("SITE_URL") || "https://www.homecarematch.com.br";
    const canSendEmail = !!(smtpHost && smtpUser && smtpPass && smtpPort);

    if (!professionalEmail) {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType: "new_contact_interest_user",
        channel: "email",
        status: "skipped",
        recipientKind: "user",
        recipientUserId: professional_id,
        title: "Novo interesse no seu perfil",
        errorMessage: "missing_user_email",
        metadata: { sender_id, interaction_id: interaction_id || null },
      });
    } else if (!canSendEmail) {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType: "new_contact_interest_user",
        channel: "email",
        status: "skipped",
        recipientKind: "user",
        recipientUserId: professional_id,
        recipientContact: professionalEmail,
        title: "Novo interesse no seu perfil",
        errorMessage: "smtp_not_configured",
        metadata: { sender_id, interaction_id: interaction_id || null },
      });
    } else {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number.parseInt(smtpPort, 10),
        secure: smtpPort === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      try {
        await transporter.sendMail({
          from: `"HomeCare Match" <${smtpUser}>`,
          to: professionalEmail,
          subject: "Novo interesse no seu perfil - HomeCare Match",
          html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 680px; margin: 0 auto; padding: 20px;">
              <h2 style="margin: 0 0 12px; color: #2563eb;">Novo interesse no seu perfil</h2>
              <p style="margin: 0 0 12px;">Olá, ${professionalName || "profissional"}.</p>
              <p style="margin: 0 0 12px;">
                ${senderType} <strong>${senderName || "Usuário"}</strong> salvou seu contato.
              </p>
              <p style="margin: 0 0 16px;">Acesse seu painel para acompanhar:</p>
              <a href="${siteUrl}/dashboard/contatos" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
                Abrir contatos
              </a>
            </div>
          `,
        });

        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "new_contact_interest_user",
          channel: "email",
          status: "sent",
          recipientKind: "user",
          recipientUserId: professional_id,
          recipientContact: professionalEmail,
          title: "Novo interesse no seu perfil",
          metadata: { sender_id, interaction_id: interaction_id || null },
        });
      } catch (emailError) {
        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "new_contact_interest_user",
          channel: "email",
          status: "failed",
          recipientKind: "user",
          recipientUserId: professional_id,
          recipientContact: professionalEmail,
          title: "Novo interesse no seu perfil",
          errorMessage: emailError?.message || String(emailError),
          metadata: { sender_id, interaction_id: interaction_id || null },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
