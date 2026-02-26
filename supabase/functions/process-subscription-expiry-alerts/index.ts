// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer";

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

const buildReminderContent = (tier: string, daysRemaining: number, endAt: string) => {
  const planLabel = getPlanName(tier);
  const dueDateLabel = formatDatePt(endAt);

  if (tier === "monthly") {
    if (daysRemaining <= 0) {
      return {
        title: "Renovacao automatica hoje",
        subject: `${planLabel}: renovacao automatica hoje`,
        body: `Seu ${planLabel} renova automaticamente hoje (${dueDateLabel}). Garanta que seu cartao esteja ativo para evitar interrupcao.`,
      };
    }

    return {
      title: "Renovacao automatica proxima",
      subject: `${planLabel}: renovacao em ${daysRemaining} dia(s)`,
      body: `Seu ${planLabel} renova automaticamente em ${daysRemaining} dia(s), na data ${dueDateLabel}. Verifique se seu cartao esta regular para manter o acesso.`,
    };
  }

  if (daysRemaining <= 0) {
    return {
      title: "Plano anual vence hoje",
      subject: `${planLabel}: renovacao manual hoje`,
      body: `Seu ${planLabel} vence hoje (${dueDateLabel}). A renovacao e manual e pode ser feita com parcelamento em ate 12x na pagina de pagamentos.`,
    };
  }

  return {
    title: "Plano anual perto do vencimento",
    subject: `${planLabel}: renovacao manual em ${daysRemaining} dia(s)`,
    body: `Seu ${planLabel} vence em ${daysRemaining} dia(s), na data ${dueDateLabel}. A renovacao e manual e pode ser feita com parcelamento em ate 12x na pagina de pagamentos.`,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "").trim() || "";

  if (!serviceRoleKey || authToken !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Nao autorizado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
    );

    const now = new Date();
    const maxDate = new Date(now.getTime() + 8 * DAY_MS);

    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,subscription_tier,subscription_end_at,cancel_at_period_end")
      .in("subscription_tier", ["monthly", "yearly"])
      .not("subscription_end_at", "is", null)
      .gte("subscription_end_at", new Date(now.getTime() - DAY_MS).toISOString())
      .lte("subscription_end_at", maxDate.toISOString())
      .limit(2000);

    if (candidatesError) throw candidatesError;

    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          checked: 0,
          notified: 0,
          emailed: 0,
          message: "Nenhuma assinatura em janela de alerta.",
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
    const smtpPort = Deno.env.get("SMTP_PORT");
    const canSendEmail = !!(smtpHost && smtpUser && smtpPass && smtpPort);

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

    for (const profile of candidates) {
      try {
        const tier = String(profile.subscription_tier || "").toLowerCase();
        if (!["monthly", "yearly"].includes(tier)) continue;

        const daysRemaining = getDaysRemaining(profile.subscription_end_at);
        if (daysRemaining === null || !REMINDER_STEPS.includes(daysRemaining)) continue;

        const reminderKey = `renewal-${tier}-${profile.subscription_end_at}-${daysRemaining}`;
        const reminderLink = `/dashboard/pagamentos?renewalReminder=${encodeURIComponent(reminderKey)}`;

        const { data: existing } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("user_id", profile.id)
          .eq("type", "billing_renewal_reminder")
          .eq("link", reminderLink)
          .maybeSingle();

        if (existing?.id) continue;

        const content = buildReminderContent(tier, daysRemaining, profile.subscription_end_at);

        await supabaseAdmin.from("notifications").insert({
          user_id: profile.id,
          title: content.title,
          content: content.body,
          link: reminderLink,
          type: "billing_renewal_reminder",
        });

        notified += 1;

        if (transporter && profile.email) {
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
                  Para acompanhar e renovar quando necessario, acesse sua pagina de pagamentos no painel.
                </p>
                <a href="https://www.homecarematch.com.br/dashboard/pagamentos"
                   style="display:inline-block;margin-top:10px;background:#1677ff;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">
                  Abrir pagina de pagamentos
                </a>
              </div>
            `,
          });
          emailed += 1;
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
        errors: errors.slice(0, 20),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
