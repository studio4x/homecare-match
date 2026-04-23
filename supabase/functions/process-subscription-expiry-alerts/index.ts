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
const FREE_TRIAL_EXTENSION_DAYS = 30;
const BONUS_AUTOMATION_TARGETS = ["free_trial", "monthly_coupon", "both"] as const;

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

const normalizeBonusAutomationTarget = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  return BONUS_AUTOMATION_TARGETS.includes(normalized as (typeof BONUS_AUTOMATION_TARGETS)[number])
    ? normalized
    : "free_trial";
};

const getDaysFromPeriod = (periodValue: string | null | undefined, fallbackDays: number) => {
  const period = String(periodValue || "").toLowerCase();
  if (!period) return fallbackDays;

  const numberMatch = period.match(/\d+/);
  const amount = numberMatch ? Number(numberMatch[0]) : 1;
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;

  if (period.includes("dia")) return safeAmount;
  if (period.includes("ano")) return safeAmount * 365;
  if (period.includes("mes") || period.includes("mês")) return safeAmount * 30;
  return fallbackDays;
};

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

const buildTrialBonusContent = (endAt: string, source: "free_trial" | "monthly_coupon") => {
  const dueDateLabel = formatDatePt(endAt);
  const bodyBySource =
    source === "monthly_coupon"
      ? `Seu periodo gratuito atual no Plano Mensal terminou e seu acesso recebeu mais 30 dias gratuitos ate ${dueDateLabel}. Nao houve cobranca automatica nesse bonus.`
      : `Seu periodo de teste terminou e seu perfil foi movido automaticamente para o Plano Mensal, com mais 30 dias gratuitos ate ${dueDateLabel}. Nao houve cobranca automatica nesse bonus.`;

  return {
    title: "Voce ganhou mais 30 dias gratis",
    subject: "Voce ganhou mais 30 dias gratis no Plano Mensal",
    body: bodyBySource,
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
  const scheduledJobSecret = Deno.env.get("SCHEDULED_JOB_SECRET") || "";

  const authHeaderToken = req.headers.get("authorization")?.replace("Bearer ", "").trim() || "";
  const bodyToken = typeof payload?.access_token === "string" ? payload.access_token.trim() : "";
  const authToken = authHeaderToken || bodyToken;

  let authMode: "service_role" | "scheduled_job" | "admin" | null = null;

  if (authToken && timingSafeEqual(authToken, serviceRoleKey)) {
    authMode = "service_role";
  } else if (scheduledJobSecret && authToken && timingSafeEqual(authToken, scheduledJobSecret)) {
    authMode = "scheduled_job";
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
    const nowIso = now.toISOString();

    const [{ data: siteConfig }, { data: freeTrialPlan }] = await Promise.all([
      supabaseAdmin
        .from("site_config")
        .select("free_trial_monthly_upgrade_enabled,free_trial_monthly_upgrade_target")
        .eq("id", 1)
        .maybeSingle(),
      supabaseAdmin
        .from("plans")
        .select("period")
        .eq("id", "free_trial")
        .maybeSingle(),
    ]);

    const freeTrialDurationDays = getDaysFromPeriod(freeTrialPlan?.period, 7);
    const freeTrialMonthlyUpgradeEnabled = siteConfig?.free_trial_monthly_upgrade_enabled !== false;
    const freeTrialMonthlyUpgradeTarget = normalizeBonusAutomationTarget(siteConfig?.free_trial_monthly_upgrade_target);
    const shouldProcessFreeTrialBonus =
      (freeTrialMonthlyUpgradeEnabled &&
        (freeTrialMonthlyUpgradeTarget === "free_trial" || freeTrialMonthlyUpgradeTarget === "both")) ||
      (force && !!targetUserId);
    const shouldProcessCouponMonthlyBonus =
      (freeTrialMonthlyUpgradeEnabled &&
        (freeTrialMonthlyUpgradeTarget === "monthly_coupon" || freeTrialMonthlyUpgradeTarget === "both")) ||
      (force && !!targetUserId);

    let candidates: any[] = [];
    let freeTrialCandidates: any[] = [];
    let couponMonthlyCandidates: any[] = [];
    let couponExpiredResets = 0;

    if (targetUserId) {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id,email,full_name,role,subscription_tier,trial_started_at,subscription_end_at,cancel_at_period_end,coupon_days")
        .eq("id", targetUserId)
        .limit(1);

      if (error) throw error;
      const targetProfiles = data || [];
      candidates = targetProfiles;
      freeTrialCandidates = targetProfiles;
      couponMonthlyCandidates = targetProfiles;
    } else {
      const [paidQuery, freeTrialQuery, couponMonthlyQuery] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id,email,full_name,role,subscription_tier,trial_started_at,subscription_end_at,cancel_at_period_end,coupon_days")
          .in("subscription_tier", ["monthly", "yearly"])
          .not("subscription_end_at", "is", null)
          .gte("subscription_end_at", new Date(now.getTime() - DAY_MS).toISOString())
          .lte("subscription_end_at", maxDate.toISOString())
          .limit(2000),
        shouldProcessFreeTrialBonus
          ? supabaseAdmin
              .from("profiles")
              .select("id,email,full_name,role,subscription_tier,trial_started_at,subscription_end_at,cancel_at_period_end,coupon_days")
              .eq("role", "professional")
              .eq("subscription_tier", "free_trial")
              .limit(2000)
          : Promise.resolve({ data: [], error: null }),
        shouldProcessCouponMonthlyBonus
          ? supabaseAdmin
              .from("profiles")
              .select("id,email,full_name,role,subscription_tier,trial_started_at,subscription_end_at,cancel_at_period_end,coupon_days")
              .eq("subscription_tier", "monthly")
              .not("coupon_days", "is", null)
              .eq("cancel_at_period_end", true)
              .not("subscription_end_at", "is", null)
              .lte("subscription_end_at", nowIso)
              .limit(2000)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (paidQuery.error) throw paidQuery.error;
      if (freeTrialQuery.error) throw freeTrialQuery.error;
      if (couponMonthlyQuery.error) throw couponMonthlyQuery.error;
      candidates = paidQuery.data || [];
      freeTrialCandidates = freeTrialQuery.data || [];
      couponMonthlyCandidates = couponMonthlyQuery.data || [];
    }

    const checkedProfilesCount = new Set(
      [...candidates, ...freeTrialCandidates, ...couponMonthlyCandidates]
        .map((profile) => String(profile?.id || ""))
        .filter(Boolean),
    ).size;

    if (candidates.length === 0 && freeTrialCandidates.length === 0 && couponMonthlyCandidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          checked: 0,
          notified: 0,
          emailed: 0,
          trial_bonus_upgrades: 0,
          trial_bonus_emailed: 0,
          coupon_monthly_bonus_upgrades: 0,
          coupon_monthly_bonus_emailed: 0,
          bonus_upgrades_total: 0,
          bonus_emailed_total: 0,
          coupon_expired_resets: couponExpiredResets,
          mode: authMode,
          target_user_id: targetUserId || null,
          free_trial_monthly_upgrade_enabled: freeTrialMonthlyUpgradeEnabled,
          free_trial_monthly_upgrade_target: freeTrialMonthlyUpgradeTarget,
          message: targetUserId
            ? couponExpiredResets > 0
              ? "Usuario alvo processado: assinatura via cupom expirada e resetada para sem plano."
              : shouldProcessFreeTrialBonus || shouldProcessCouponMonthlyBonus
                ? "Usuario alvo sem assinatura elegivel na janela de alerta e sem bonus expirado para conversao."
                : "Usuario alvo sem assinatura elegivel na janela de alerta."
            : shouldProcessFreeTrialBonus || shouldProcessCouponMonthlyBonus
              ? "Nenhuma assinatura em janela de alerta ou periodo bonificado expirado para conversao."
              : "Nenhuma assinatura em janela de alerta.",
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
    let trialBonusUpgrades = 0;
    let trialBonusEmailed = 0;
    let couponMonthlyBonusUpgrades = 0;
    let couponMonthlyBonusEmailed = 0;
    const errors: Array<{ user_id: string; message: string }> = [];
    const bonusProcessedUserIds = new Set<string>();
    const freeTrialWaConfig = await getWhatsappTemplateConfig(
      supabaseAdmin,
      "free_trial_bonus_upgrade_user",
      "user",
    );
    const subscriptionWaConfig = await getWhatsappTemplateConfig(
      supabaseAdmin,
      "subscription_renewal_reminder_user",
      "user",
    );

    for (const profile of freeTrialCandidates) {
      try {
        const tier = String(profile.subscription_tier || "").toLowerCase();
        if (tier !== "free_trial" || String(profile.role || "").toLowerCase() !== "professional") {
          continue;
        }

        const effectiveTrialEndAt =
          profile.subscription_end_at ||
          (profile.trial_started_at
            ? new Date(new Date(profile.trial_started_at).getTime() + freeTrialDurationDays * DAY_MS).toISOString()
            : null);

        if (!effectiveTrialEndAt) {
          continue;
        }

        const isExpired = new Date(effectiveTrialEndAt).getTime() <= now.getTime();
        if (!force && !isExpired) continue;

        const bonusEndAt = new Date(now.getTime() + FREE_TRIAL_EXTENSION_DAYS * DAY_MS).toISOString();
        const content = buildTrialBonusContent(bonusEndAt, "free_trial");
        const detailsPath = getWhatsappTemplateVariation(
          freeTrialWaConfig,
          "details_path",
          String(freeTrialWaConfig?.var3Default || "/dashboard/pagamentos?trialBonus=extended"),
        );

        const { error: updateProfileError } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_tier: "monthly",
            subscription_end_at: bonusEndAt,
            cancel_at_period_end: true,
            trial_started_at: null,
            coupon_days: null,
            updated_at: nowIso,
          })
          .eq("id", profile.id)
          .eq("subscription_tier", "free_trial");

        if (updateProfileError) throw updateProfileError;

        const { error: widgetError } = await supabaseAdmin.from("notifications").insert({
          user_id: profile.id,
          title: content.title,
          content: content.body,
          link: detailsPath,
          type: "trial_bonus_upgrade",
        });

        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "free_trial_bonus_upgrade_user",
          channel: "widget",
          status: widgetError ? "failed" : "sent",
          recipientKind: "user",
          recipientUserId: profile.id,
          recipientContact: profile.email || null,
          title: content.title,
          content: content.body,
          errorMessage: widgetError?.message || null,
          metadata: {
            previous_tier: "free_trial",
            new_tier: "monthly",
            previous_trial_end_at: effectiveTrialEndAt,
            subscription_end_at: bonusEndAt,
            bonus_days: FREE_TRIAL_EXTENSION_DAYS,
            forced: force,
          },
        });

        if (widgetError) throw widgetError;

        trialBonusUpgrades += 1;
        bonusProcessedUserIds.add(profile.id);

        try {
          await enqueueUserWhatsappNotification({
            supabaseAdmin,
            userId: profile.id,
            eventType: "free_trial_bonus_upgrade_user",
            templateParams: [
              String(profile.full_name || freeTrialWaConfig?.var1Default || "Usuario"),
              String(
                getWhatsappTemplateVariation(
                  freeTrialWaConfig,
                  "status_text",
                  freeTrialWaConfig?.var2Default || "voce ganhou mais 30 dias gratis no Plano Mensal",
                ),
              ),
              detailsPath,
            ],
            payload: {
              previous_tier: "free_trial",
              new_tier: "monthly",
              previous_trial_end_at: effectiveTrialEndAt,
              subscription_end_at: bonusEndAt,
              bonus_days: FREE_TRIAL_EXTENSION_DAYS,
              forced: force,
            },
          });
        } catch (waError) {
          console.warn("[process-subscription-expiry-alerts] falha ao enfileirar WhatsApp do bonus trial:", waError?.message || waError);
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
                    Seu acesso segue ativo no Plano Mensal ate <strong>${formatDatePt(bonusEndAt)}</strong>.
                    Se quiser continuar depois desse periodo, basta renovar pela pagina de pagamentos.
                  </p>
                  <a href="https://www.homecarematch.com.br/dashboard/pagamentos"
                     style="display:inline-block;margin-top:10px;background:#1677ff;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">
                    Abrir pagina de pagamentos
                  </a>
                </div>
              `,
            });

            await logNotificationDelivery({
              supabaseAdmin,
              eventType: "free_trial_bonus_upgrade_user",
              channel: "email",
              status: "sent",
              recipientKind: "user",
              recipientUserId: profile.id,
              recipientContact: profile.email || null,
              title: content.subject,
              metadata: {
                previous_tier: "free_trial",
                new_tier: "monthly",
                previous_trial_end_at: effectiveTrialEndAt,
                subscription_end_at: bonusEndAt,
                bonus_days: FREE_TRIAL_EXTENSION_DAYS,
                forced: force,
              },
            });

            trialBonusEmailed += 1;
          } catch (emailError) {
            await logNotificationDelivery({
              supabaseAdmin,
              eventType: "free_trial_bonus_upgrade_user",
              channel: "email",
              status: "failed",
              recipientKind: "user",
              recipientUserId: profile.id,
              recipientContact: profile.email || null,
              title: content.subject,
              errorMessage: emailError?.message || String(emailError),
              metadata: {
                previous_tier: "free_trial",
                new_tier: "monthly",
                previous_trial_end_at: effectiveTrialEndAt,
                subscription_end_at: bonusEndAt,
                bonus_days: FREE_TRIAL_EXTENSION_DAYS,
                forced: force,
              },
            });
          }
        } else if (!profile.email) {
          await logNotificationDelivery({
            supabaseAdmin,
            eventType: "free_trial_bonus_upgrade_user",
            channel: "email",
            status: "skipped",
            recipientKind: "user",
            recipientUserId: profile.id,
            title: content.subject,
            errorMessage: "missing_user_email",
            metadata: {
              previous_tier: "free_trial",
              new_tier: "monthly",
              previous_trial_end_at: effectiveTrialEndAt,
              subscription_end_at: bonusEndAt,
              bonus_days: FREE_TRIAL_EXTENSION_DAYS,
              forced: force,
            },
          });
        } else {
          await logNotificationDelivery({
            supabaseAdmin,
            eventType: "free_trial_bonus_upgrade_user",
            channel: "email",
            status: "skipped",
            recipientKind: "user",
            recipientUserId: profile.id,
            recipientContact: profile.email || null,
            title: content.subject,
            errorMessage: "smtp_not_configured",
            metadata: {
              previous_tier: "free_trial",
              new_tier: "monthly",
              previous_trial_end_at: effectiveTrialEndAt,
              subscription_end_at: bonusEndAt,
              bonus_days: FREE_TRIAL_EXTENSION_DAYS,
              forced: force,
            },
          });
        }
      } catch (userError) {
        errors.push({
          user_id: profile.id,
          message: userError instanceof Error ? userError.message : "Falha ao processar bonus de trial.",
        });
      }
    }

    for (const profile of couponMonthlyCandidates) {
      try {
        const tier = String(profile.subscription_tier || "").toLowerCase();
        const couponDays = Number(profile.coupon_days || 0);

        if (tier !== "monthly" || couponDays <= 0 || profile.cancel_at_period_end !== true) {
          continue;
        }

        const effectiveCouponEndAt = profile.subscription_end_at || null;
        if (!effectiveCouponEndAt) {
          continue;
        }

        const isExpired = new Date(effectiveCouponEndAt).getTime() <= now.getTime();
        if (!force && !isExpired) continue;

        const bonusEndAt = new Date(now.getTime() + FREE_TRIAL_EXTENSION_DAYS * DAY_MS).toISOString();
        const content = buildTrialBonusContent(bonusEndAt, "monthly_coupon");
        const detailsPath = getWhatsappTemplateVariation(
          freeTrialWaConfig,
          "details_path",
          String(freeTrialWaConfig?.var3Default || "/dashboard/pagamentos?trialBonus=extended"),
        );

        const { error: updateProfileError } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_tier: "monthly",
            subscription_end_at: bonusEndAt,
            cancel_at_period_end: true,
            trial_started_at: null,
            coupon_days: null,
            updated_at: nowIso,
          })
          .eq("id", profile.id)
          .eq("subscription_tier", "monthly");

        if (updateProfileError) throw updateProfileError;

        const { error: widgetError } = await supabaseAdmin.from("notifications").insert({
          user_id: profile.id,
          title: content.title,
          content: content.body,
          link: detailsPath,
          type: "trial_bonus_upgrade",
        });

        await logNotificationDelivery({
          supabaseAdmin,
          eventType: "free_trial_bonus_upgrade_user",
          channel: "widget",
          status: widgetError ? "failed" : "sent",
          recipientKind: "user",
          recipientUserId: profile.id,
          recipientContact: profile.email || null,
          title: content.title,
          content: content.body,
          errorMessage: widgetError?.message || null,
          metadata: {
            previous_tier: "monthly",
            new_tier: "monthly",
            previous_coupon_days: couponDays,
            previous_coupon_end_at: effectiveCouponEndAt,
            subscription_end_at: bonusEndAt,
            bonus_days: FREE_TRIAL_EXTENSION_DAYS,
            bonus_source: "monthly_coupon",
            forced: force,
          },
        });

        if (widgetError) throw widgetError;

        couponMonthlyBonusUpgrades += 1;
        bonusProcessedUserIds.add(profile.id);

        try {
          await enqueueUserWhatsappNotification({
            supabaseAdmin,
            userId: profile.id,
            eventType: "free_trial_bonus_upgrade_user",
            templateParams: [
              String(profile.full_name || freeTrialWaConfig?.var1Default || "Usuario"),
              String(
                getWhatsappTemplateVariation(
                  freeTrialWaConfig,
                  "status_text",
                  freeTrialWaConfig?.var2Default || "voce ganhou mais 30 dias gratis no Plano Mensal",
                ),
              ),
              detailsPath,
            ],
            payload: {
              previous_tier: "monthly",
              new_tier: "monthly",
              previous_coupon_days: couponDays,
              previous_coupon_end_at: effectiveCouponEndAt,
              subscription_end_at: bonusEndAt,
              bonus_days: FREE_TRIAL_EXTENSION_DAYS,
              bonus_source: "monthly_coupon",
              forced: force,
            },
          });
        } catch (waError) {
          console.warn("[process-subscription-expiry-alerts] falha ao enfileirar WhatsApp do bonus por cupom:", waError?.message || waError);
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
                    Seu acesso segue ativo no Plano Mensal ate <strong>${formatDatePt(bonusEndAt)}</strong>.
                    Se quiser continuar depois desse periodo, basta renovar pela pagina de pagamentos.
                  </p>
                  <a href="https://www.homecarematch.com.br/dashboard/pagamentos"
                     style="display:inline-block;margin-top:10px;background:#1677ff;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">
                    Abrir pagina de pagamentos
                  </a>
                </div>
              `,
            });

            await logNotificationDelivery({
              supabaseAdmin,
              eventType: "free_trial_bonus_upgrade_user",
              channel: "email",
              status: "sent",
              recipientKind: "user",
              recipientUserId: profile.id,
              recipientContact: profile.email || null,
              title: content.subject,
              metadata: {
                previous_tier: "monthly",
                new_tier: "monthly",
                previous_coupon_days: couponDays,
                previous_coupon_end_at: effectiveCouponEndAt,
                subscription_end_at: bonusEndAt,
                bonus_days: FREE_TRIAL_EXTENSION_DAYS,
                bonus_source: "monthly_coupon",
                forced: force,
              },
            });

            couponMonthlyBonusEmailed += 1;
          } catch (emailError) {
            await logNotificationDelivery({
              supabaseAdmin,
              eventType: "free_trial_bonus_upgrade_user",
              channel: "email",
              status: "failed",
              recipientKind: "user",
              recipientUserId: profile.id,
              recipientContact: profile.email || null,
              title: content.subject,
              errorMessage: emailError?.message || String(emailError),
              metadata: {
                previous_tier: "monthly",
                new_tier: "monthly",
                previous_coupon_days: couponDays,
                previous_coupon_end_at: effectiveCouponEndAt,
                subscription_end_at: bonusEndAt,
                bonus_days: FREE_TRIAL_EXTENSION_DAYS,
                bonus_source: "monthly_coupon",
                forced: force,
              },
            });
          }
        } else if (!profile.email) {
          await logNotificationDelivery({
            supabaseAdmin,
            eventType: "free_trial_bonus_upgrade_user",
            channel: "email",
            status: "skipped",
            recipientKind: "user",
            recipientUserId: profile.id,
            title: content.subject,
            errorMessage: "missing_user_email",
            metadata: {
              previous_tier: "monthly",
              new_tier: "monthly",
              previous_coupon_days: couponDays,
              previous_coupon_end_at: effectiveCouponEndAt,
              subscription_end_at: bonusEndAt,
              bonus_days: FREE_TRIAL_EXTENSION_DAYS,
              bonus_source: "monthly_coupon",
              forced: force,
            },
          });
        } else {
          await logNotificationDelivery({
            supabaseAdmin,
            eventType: "free_trial_bonus_upgrade_user",
            channel: "email",
            status: "skipped",
            recipientKind: "user",
            recipientUserId: profile.id,
            recipientContact: profile.email || null,
            title: content.subject,
            errorMessage: "smtp_not_configured",
            metadata: {
              previous_tier: "monthly",
              new_tier: "monthly",
              previous_coupon_days: couponDays,
              previous_coupon_end_at: effectiveCouponEndAt,
              subscription_end_at: bonusEndAt,
              bonus_days: FREE_TRIAL_EXTENSION_DAYS,
              bonus_source: "monthly_coupon",
              forced: force,
            },
          });
        }
      } catch (userError) {
        errors.push({
          user_id: profile.id,
          message: userError instanceof Error ? userError.message : "Falha ao processar bonus do mensal via cupom.",
        });
      }
    }

    const resetExpiredCouponsQuery = supabaseAdmin
      .from("profiles")
      .update({
        subscription_tier: null,
        coupon_days: null,
        cancel_at_period_end: true,
        updated_at: nowIso,
      })
      .in("subscription_tier", ["monthly", "yearly", "annual"])
      .not("coupon_days", "is", null)
      .eq("cancel_at_period_end", true)
      .not("subscription_end_at", "is", null)
      .lte("subscription_end_at", nowIso);

    if (targetUserId) {
      resetExpiredCouponsQuery.eq("id", targetUserId);
    }

    const { data: resetExpiredCouponsRows, error: resetExpiredCouponsError } = await resetExpiredCouponsQuery.select("id");
    if (resetExpiredCouponsError) throw resetExpiredCouponsError;

    couponExpiredResets = Array.isArray(resetExpiredCouponsRows) ? resetExpiredCouponsRows.length : 0;

    for (const profile of candidates) {
      try {
        if (bonusProcessedUserIds.has(profile.id)) continue;

        const tier = String(profile.subscription_tier || "").toLowerCase();
        if (!["monthly", "yearly"].includes(tier)) {
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
        checked: checkedProfilesCount,
        notified,
        emailed,
        trial_bonus_upgrades: trialBonusUpgrades,
        trial_bonus_emailed: trialBonusEmailed,
        coupon_monthly_bonus_upgrades: couponMonthlyBonusUpgrades,
        coupon_monthly_bonus_emailed: couponMonthlyBonusEmailed,
        bonus_upgrades_total: trialBonusUpgrades + couponMonthlyBonusUpgrades,
        bonus_emailed_total: trialBonusEmailed + couponMonthlyBonusEmailed,
        coupon_expired_resets: couponExpiredResets,
        mode: authMode,
        target_user_id: targetUserId || null,
        forced: force,
        force_days_remaining: forceDaysRemaining,
        free_trial_monthly_upgrade_enabled: freeTrialMonthlyUpgradeEnabled,
        free_trial_monthly_upgrade_target: freeTrialMonthlyUpgradeTarget,
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
