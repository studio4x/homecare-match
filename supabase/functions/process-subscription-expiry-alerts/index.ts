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
import { timingSafeEqual } from "../_shared/timing-safe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REMINDER_STEPS = [7, 3, 1, 0];
const DAY_MS = 24 * 60 * 60 * 1000;

const toDateOnlyUtc = (value: Date) => {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const getDaysRemaining = (endAtIso: string) => {
  const endAt = new Date(endAtIso);
  if (Number.isNaN(endAt.getTime())) return null;
  const today = toDateOnlyUtc(new Date());
  const endDay = toDateOnlyUtc(endAt);
  return Math.round((endDay.getTime() - today.getTime()) / DAY_MS);
};

const getPlanName = (tier?: string | null) => {
  if (tier === "monthly") return "Plano Mensal";
  if (tier === "yearly") return "Plano Anual";
  return "Plano";
};

const formatDatePt = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

const formatDaysLabel = (days: number) => (days === 1 ? "1 dia" : `${days} dias`);

const buildReminderContent = (tier: string, daysRemaining: number, endAt: string) => {
  const planLabel = getPlanName(tier);
  const dueDateLabel = formatDatePt(endAt);
  const daysLabel = formatDaysLabel(daysRemaining);

  if (tier === "monthly") {
    if (daysRemaining <= 0) {
      return {
        title: "Renovação automática hoje",
        subject: `${planLabel}: renovação automática hoje`,
        body: `Seu ${planLabel} renova automaticamente hoje (${dueDateLabel}). Garanta que seu cartão esteja ativo para evitar interrupção.`,
      };
    }

    return {
      title: "Renovação automática próxima",
      subject: `${planLabel}: renovação em ${daysLabel}`,
      body: `Seu ${planLabel} renova automaticamente em ${daysRemaining} dia(s), na data ${dueDateLabel}. Verifique se seu cartão está regular para manter o acesso.`,
    };
  }

  if (daysRemaining <= 0) {
    return {
      title: "Plano anual vence hoje",
      subject: `${planLabel}: renovação manual hoje`,
      body: `Seu ${planLabel} vence hoje (${dueDateLabel}). A renovação é manual e pode ser feita com parcelamento em até 12x na página de pagamentos.`,
    };
  }

  return {
    title: "Plano anual perto do vencimento",
    subject: `${planLabel}: renovação manual em ${daysLabel}`,
    body: `Seu ${planLabel} vence em ${daysRemaining} dia(s), na data ${dueDateLabel}. A renovação é manual e pode ser feita com parcelamento em até 12x na página de pagamentos.`,
  };
};

const parseRequestBody = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

const applyReminderPathPattern = (pattern: string, reminderKey: string) => {
  const fallback = `/dashboard/pagamentos?renewalReminder=${encodeURIComponent(reminderKey)}`;
  const raw = String(pattern || "").trim();
  if (!raw) return fallback;

  if (raw.includes("{reminder_key}")) {
    return raw.replaceAll("{reminder_key}", encodeURIComponent(reminderKey));
  }

  const joiner = raw.includes("?") ? "&" : "?";
  return `${raw}${joiner}renewalReminder=${encodeURIComponent(reminderKey)}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY ausente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey);
  const payload = await parseRequestBody(req);

  const authHeaderToken = req.headers.get("authorization")?.replace("Bearer ", "").trim() || "";
  const bodyToken = typeof payload?.access_token === "string" ? payload.access_token.trim() : "";
  const authToken = authHeaderToken || bodyToken;

  let authMode: "service_role" | "admin" | null = null;

  if (authToken && timingSafeEqual(authToken, serviceRoleKey)) {
    authMode = "service_role";
  } else if (authToken) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(authToken);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Nao autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    const isAdmin = Boolean(actorProfile?.is_admin || actorProfile?.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado: apenas admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    authMode = "admin";
  }

  if (!authMode) {
    return new Response(JSON.stringify({ error: "Nao autorizado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const targetUserIdRaw = typeof payload?.target_user_id === "string" ? payload.target_user_id.trim() : "";
    const targetUserEmailRaw = typeof payload?.target_user_email === "string" ? payload.target_user_email.trim().toLowerCase() : "";
    const force = payload?.force === true || String(payload?.force || "").toLowerCase() === "true";

    const forceDaysInput = Number(payload?.force_days_remaining);
    const forceDaysRemaining = Number.isFinite(forceDaysInput) ? Math.trunc(forceDaysInput) : null;

    let targetUserId = targetUserIdRaw;

    if (!targetUserId && targetUserEmailRaw) {
      const { data: targetByEmail, error: targetError } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", targetUserEmailRaw)
        .maybeSingle();

      if (targetError) throw targetError;
      targetUserId = targetByEmail?.id || "";
    }

    if (authMode === "admin" && !targetUserId) {
      return new Response(
        JSON.stringify({ error: "Para execucao manual admin, informe target_user_id ou target_user_email." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const now = new Date();
    const maxDate = new Date(now.getTime() + 8 * DAY_MS);

    let candidates: any[] = [];

    if (targetUserId) {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id,email,full_name,subscription_tier,subscription_end_at,cancel_at_period_end")
        .eq("id", targetUserId)
        .limit(1);

      if (error) throw error;
      candidates = data || [];
    } else {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id,email,full_name,subscription_tier,subscription_end_at,cancel_at_period_end")
        .in("subscription_tier", ["monthly", "yearly"])
        .not("subscription_end_at", "is", null)
        .gte("subscription_end_at", new Date(now.getTime() - DAY_MS).toISOString())
        .lte("subscription_end_at", maxDate.toISOString())
        .limit(2000);

      if (error) throw error;
      candidates = data || [];
    }

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          checked: 0,
          notified: 0,
          emailed: 0,
          mode: authMode,
          target_user_id: targetUserId || null,
          message: targetUserId ? "Usuario alvo nao encontrado." : "Nenhuma assinatura em janela de alerta.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpPort = Deno.env.get("SMTP_PORT") || "587";
    const canSendEmail = !!(smtpHost && smtpUser && smtpPass);

    const transporter = canSendEmail
      ? nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort, 10),
          secure: smtpPort === "465",
          auth: { user: smtpUser, pass: smtpPass },
        })
      : null;

    let notified = 0;
    let emailed = 0;
    const errors: Array<{ user_id: string; message: string }> = [];
    const subscriptionWaConfig = await getWhatsappTemplateConfig(
      supabaseAdmin,
      "subscription_renewal_reminder_user",
      "user",
    );

    for (const profile of candidates) {
      try {
        const tier = String(profile.subscription_tier || "").toLowerCase();
        if (!["monthly", "yearly"].includes(tier)) {
          if (targetUserId) {
            throw new Error("Usuario alvo sem subscription_tier elegivel (monthly/yearly).");
          }
          continue;
        }

        const effectiveEndAt = profile.subscription_end_at || new Date(now.getTime() + DAY_MS).toISOString();
        const computedDaysRemaining = getDaysRemaining(effectiveEndAt);

        let daysRemaining = computedDaysRemaining;

        if (force) {
          if (forceDaysRemaining !== null) {
            daysRemaining = forceDaysRemaining;
          } else if (daysRemaining === null) {
            daysRemaining = 1;
          }
        } else {
          if (daysRemaining === null || !REMINDER_STEPS.includes(daysRemaining)) continue;
        }

        if (daysRemaining === null) continue;

        const reminderKey = force
          ? `renewal-test-${tier}-${profile.id}-${Date.now()}-${daysRemaining}`
          : `renewal-${tier}-${effectiveEndAt}-${daysRemaining}`;
        const reminderPathPattern = getWhatsappTemplateVariation(
          subscriptionWaConfig,
          "details_path_pattern",
          String(subscriptionWaConfig?.var3Default || "/dashboard/pagamentos?renewalReminder={reminder_key}"),
        );
        const reminderLink = applyReminderPathPattern(reminderPathPattern, reminderKey);

        if (!force) {
          const { data: existing } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("user_id", profile.id)
            .eq("type", "billing_renewal_reminder")
            .eq("link", reminderLink)
            .maybeSingle();

          if (existing?.id) continue;
        }

        const content = buildReminderContent(tier, daysRemaining, effectiveEndAt);
        const monthlyDueTitle = getWhatsappTemplateVariation(subscriptionWaConfig, "monthly_due_title", "");
        const monthlyUpcomingTitle = getWhatsappTemplateVariation(subscriptionWaConfig, "monthly_upcoming_title", "");
        const yearlyDueTitle = getWhatsappTemplateVariation(subscriptionWaConfig, "yearly_due_title", "");
        const yearlyUpcomingTitle = getWhatsappTemplateVariation(subscriptionWaConfig, "yearly_upcoming_title", "");

        let whatsappTitle = String(content.title || "Lembrete de assinatura");
        if (tier === "monthly" && daysRemaining <= 0 && monthlyDueTitle) {
          whatsappTitle = monthlyDueTitle;
        } else if (tier === "monthly" && daysRemaining > 0 && monthlyUpcomingTitle) {
          whatsappTitle = monthlyUpcomingTitle;
        } else if (tier === "yearly" && daysRemaining <= 0 && yearlyDueTitle) {
          whatsappTitle = yearlyDueTitle;
        } else if (tier === "yearly" && daysRemaining > 0 && yearlyUpcomingTitle) {
          whatsappTitle = yearlyUpcomingTitle;
        }

        const { error: widgetError } = await supabaseAdmin.from("notifications").insert({
          user_id: profile.id,
          title: content.title,
          content: content.body,
          link: reminderLink,
          type: "billing_renewal_reminder",
        });

        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "subscription_renewal_reminder_user",
          channel: "widget",
          status: widgetError ? "failed" : "sent",
          recipientKind: "user",
          recipientUserId: profile.id,
          recipientContact: profile.email || null,
          title: content.title,
          content: content.body,
          errorMessage: widgetError?.message || null,
          metadata: {
            tier,
            daysRemaining,
            subscription_end_at: effectiveEndAt,
            forced: force,
          },
        });

        if (widgetError) throw widgetError;

        notified += 1;

        try {
          await enqueueUserWhatsappNotification({
            supabaseAdmin,
            userId: profile.id,
            eventType: "subscription_renewal_reminder_user",
            templateParams: [
              String(profile.full_name || subscriptionWaConfig?.var1Default || "Usuario"),
              String(whatsappTitle || subscriptionWaConfig?.var2Default || "Lembrete de assinatura"),
              reminderLink,
            ],
            payload: {
              tier,
              daysRemaining,
              subscription_end_at: effectiveEndAt,
              forced: force,
            },
          });
        } catch (waError) {
          console.warn("[process-subscription-expiry-alerts] falha ao enfileirar WhatsApp:", waError?.message || waError);
        }

        if (transporter && profile.email) {
          try {
            await transporter.sendMail({
              from: `"HomeCare Match" <${smtpUser}>`,
              to: profile.email,
              subject: content.subject,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;">
                  <h2 style="margin-bottom:12px;color:#0f172a;">${content.title}</h2>
                  <p style="line-height:1.6;color:#334155;">Ola, ${profile.full_name || "usuario"}.</p>
                  <p style="line-height:1.6;color:#334155;">${content.body}</p>
                  <p style="line-height:1.6;color:#334155;">
                    Para acompanhar e renovar quando necessário, acesse sua página de pagamentos no painel.
                  </p>
                  <a href="https://www.homecarematch.com.br/dashboard/pagamentos"
                     style="display:inline-block;margin-top:10px;background:#1677ff;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">
                    Abrir página de pagamentos
                  </a>
                </div>
              `,
            });

            await logNotificationDelivery({
              supabaseAdmin,
              eventType: "subscription_renewal_reminder_user",
              channel: "email",
              status: "sent",
              recipientKind: "user",
              recipientUserId: profile.id,
              recipientContact: profile.email || null,
              title: content.subject,
              metadata: {
                tier,
                daysRemaining,
                subscription_end_at: effectiveEndAt,
                forced: force,
              },
            });

            emailed += 1;
          } catch (emailError) {
            await logNotificationDelivery({
              supabaseAdmin,
              eventType: "subscription_renewal_reminder_user",
              channel: "email",
              status: "failed",
              recipientKind: "user",
              recipientUserId: profile.id,
              recipientContact: profile.email || null,
              title: content.subject,
              errorMessage: emailError?.message || String(emailError),
              metadata: {
                tier,
                daysRemaining,
                subscription_end_at: effectiveEndAt,
                forced: force,
              },
            });
          }
        } else if (!profile.email) {
          await logNotificationDelivery({
            supabaseAdmin,
            eventType: "subscription_renewal_reminder_user",
            channel: "email",
            status: "skipped",
            recipientKind: "user",
            recipientUserId: profile.id,
            title: content.subject,
            errorMessage: "missing_user_email",
            metadata: {
              tier,
              daysRemaining,
              subscription_end_at: effectiveEndAt,
              forced: force,
            },
          });
        } else {
          await logNotificationDelivery({
            supabaseAdmin,
            eventType: "subscription_renewal_reminder_user",
            channel: "email",
            status: "skipped",
            recipientKind: "user",
            recipientUserId: profile.id,
            recipientContact: profile.email || null,
            title: content.subject,
            errorMessage: "smtp_not_configured",
            metadata: {
              tier,
              daysRemaining,
              subscription_end_at: effectiveEndAt,
              forced: force,
            },
          });
        }
      } catch (userError) {
        errors.push({
          user_id: profile.id,
          message: userError instanceof Error ? userError.message : "Falha ao processar usuario.",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: candidates.length,
        notified,
        emailed,
        mode: authMode,
        target_user_id: targetUserId || null,
        forced: force,
        force_days_remaining: forceDaysRemaining,
        errors: errors.slice(0, 20),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
