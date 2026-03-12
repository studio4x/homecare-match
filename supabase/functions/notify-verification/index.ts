// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer"
import { enqueueAdminWhatsappNotification, enqueueUserWhatsappNotification } from "../_shared/whatsapp.ts";
import { logNotificationDelivery } from "../_shared/notification-log.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const payload = await req.json()
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "").trim() || "";
    const bodyToken = typeof payload?.access_token === "string" ? payload.access_token.trim() : "";
    const token = bearerToken || bodyToken;

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    let authenticatedUserId: string | null = null;
    if (token) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authData?.user) {
        return new Response(JSON.stringify({ error: "Nao autorizado: token invalido." }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authenticatedUserId = authData.user.id;
    }

    const userId = payload?.userId || authenticatedUserId;
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId ausente." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (authenticatedUserId && userId !== authenticatedUserId) {
      return new Response(JSON.stringify({ error: "Acesso negado: userId invalido." }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let userName = payload?.userName || "";
    let userEmail = payload?.userEmail || "";
    const { data: requesterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (!userName) userName = requesterProfile?.full_name || "Profissional";
    if (!userEmail) userEmail = requesterProfile?.email || "";

    // --- NOTIFICAÇÃO NO PAINEL DO ADMIN ---
    const { error: adminWidgetError } = await supabaseAdmin.from('admin_notifications').insert({
      title: "🛡️ Nova Solicitação de Verificação",
      content: `O profissional ${userName} enviou documentos para análise.`,
      link: "/admin/verificacoes",
      type: 'info'
    });
    await logNotificationDelivery({
      supabaseAdmin,
      eventType: "verification_request_admin",
      channel: "widget",
      status: adminWidgetError ? "failed" : "sent",
      recipientKind: "admin",
      recipientContact: "admin_notifications",
      title: "Nova Solicitacao de Verificacao",
      content: `O profissional ${userName} enviou documentos para analise.`,
      errorMessage: adminWidgetError?.message || null,
      metadata: { userId: userId || null, userEmail: userEmail || null },
    });
    if (adminWidgetError) throw adminWidgetError;

    try {
      await enqueueAdminWhatsappNotification({
        supabaseAdmin,
        eventType: "verification_request_admin",
        templateParams: [
          String(userName || "Profissional"),
          "enviou documentos para verificacao",
          "/admin/verificacoes",
        ],
        payload: {
          userId: userId || null,
          userEmail: userEmail || null,
        },
      });
    } catch (waError) {
      console.warn("[notify-verification] falha ao enfileirar WhatsApp para admin:", waError?.message || waError);
    }

    try {
      await enqueueUserWhatsappNotification({
        supabaseAdmin,
        userId,
        eventType: "verification_request_user_confirmation",
        templateParams: [
          String(userName || "Usuario"),
          "recebemos seus documentos para verificacao",
          "/dashboard/perfil",
        ],
        payload: {
          userEmail: userEmail || null,
        },
      });
    } catch (waError) {
      console.warn("[notify-verification] falha ao enfileirar WhatsApp para usuario:", waError?.message || waError);
    }

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "contato@homecarematch.com.br";

    if (smtpHost && smtpUser && smtpPass && smtpPort) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort),
        secure: smtpPort === "465",
        auth: { user: smtpUser, pass: smtpPass },
      });

      // --- E-MAIL PARA O ADMIN ---
      try {
        await transporter.sendMail({
          from: `"HomeCare Match" <${smtpUser}>`,
          to: adminEmail, // E-mail do admin
          subject: `⚠️ Verificação Pendente: ${userName}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #2563eb;">Nova Solicitação de Verificação</h2>
              <p>O profissional <strong>${userName}</strong> enviou documentos para análise.</p>
              <p><strong>E-mail do Profissional:</strong> ${userEmail}</p>
              <p>Acesse o painel administrativo para revisar e aprovar ou rejeitar os documentos:</p>
              <p><a href="${Deno.env.get('SITE_URL')}/admin/verificacoes" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Ir para Verificações</a></p>
              <p>Atenciosamente,<br>Equipe HomeCare Match</p>
            </div>
          `,
        });
        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "verification_request_admin",
          channel: "email",
          status: "sent",
          recipientKind: "admin",
          recipientContact: adminEmail,
          title: `Verificacao Pendente: ${userName}`,
          metadata: { userId: userId || null, userEmail: userEmail || null },
        });
      } catch (adminEmailError) {
        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "verification_request_admin",
          channel: "email",
          status: "failed",
          recipientKind: "admin",
          recipientContact: adminEmail,
          title: `Verificacao Pendente: ${userName}`,
          errorMessage: adminEmailError?.message || String(adminEmailError),
          metadata: { userId: userId || null, userEmail: userEmail || null },
        });
        throw adminEmailError;
      }

      // --- NOVO: E-MAIL DE CONFIRMAÇÃO PARA O PROFISSIONAL ---
      try {
        await transporter.sendMail({
          from: `"HomeCare Match" <${smtpUser}>`,
          to: userEmail, // E-mail do profissional
          subject: `✅ Documentos Enviados para Verificação - HomeCare Match`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #28a745;">Olá, ${userName}!</h2>
              <p>Confirmamos o recebimento dos seus documentos para verificação de perfil na plataforma HomeCare Match.</p>
              <p>Nossa equipe está analisando suas informações e você receberá um retorno por e-mail em até <strong>24 horas úteis</strong>.</p>
              <p>Você pode acompanhar o status da sua solicitação a qualquer momento em seu painel:</p>
              <p><a href="${Deno.env.get('SITE_URL')}/dashboard/perfil" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Acompanhar Status</a></p>
              <p>Agradecemos a sua paciência!</p>
              <p>Atenciosamente,<br>Equipe HomeCare Match</p>
            </div>
          `,
        });
        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "verification_request_user_confirmation",
          channel: "email",
          status: "sent",
          recipientKind: "user",
          recipientUserId: userId || null,
          recipientContact: userEmail || null,
          title: "Documentos enviados para verificacao",
          metadata: { userId: userId || null },
        });
      } catch (userEmailError) {
        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "verification_request_user_confirmation",
          channel: "email",
          status: "failed",
          recipientKind: "user",
          recipientUserId: userId || null,
          recipientContact: userEmail || null,
          title: "Documentos enviados para verificacao",
          errorMessage: userEmailError?.message || String(userEmailError),
          metadata: { userId: userId || null },
        });
        throw userEmailError;
      }

    } else {
      console.warn("[notify-verification] Variáveis SMTP não configuradas. E-mails não enviados.");
      await logNotificationDelivery({
        supabaseAdmin,
        eventType: "verification_request_admin",
        channel: "email",
        status: "skipped",
        recipientKind: "admin",
        recipientContact: adminEmail,
        title: `Verificacao Pendente: ${userName}`,
        errorMessage: "smtp_not_configured",
        metadata: { userId: userId || null, userEmail: userEmail || null },
      });
      await logNotificationDelivery({
        supabaseAdmin,
        eventType: "verification_request_user_confirmation",
        channel: "email",
        status: "skipped",
        recipientKind: "user",
        recipientUserId: userId || null,
        recipientContact: userEmail || null,
        title: "Documentos enviados para verificacao",
        errorMessage: "smtp_not_configured",
        metadata: { userId: userId || null },
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error("[notify-verification] Erro crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
