// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const PAID_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "PAID"]);
const INACTIVE_STATUSES = new Set([
  "REFUND_PENDING",
  "REFUNDED",
  "CANCELED",
  "CANCELLED",
  "VOID",
  "DELETED",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
]);

const parseAsaasDate = (value?: string | null) => {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dateOnly = new Date(`${value}T12:00:00Z`);
    if (!Number.isNaN(dateOnly.getTime())) return dateOnly.toISOString();
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  return null;
};

const tierToDurationDays = (planId?: string | null) => {
  if (planId === "yearly") return 365;
  if (planId === "monthly") return 30;
  return 30;
};

const normalizeStatus = (status?: string | null) => {
  if (!status) return null;
  return String(status).toUpperCase();
};

const getPayloadSubscriptionId = (raw: any) => {
  return (
    raw?.payment?.subscription ||
    raw?.data?.payment?.subscription ||
    raw?.data?.subscription ||
    raw?.subscription?.id ||
    null
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo nao permitido." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const expectedWebhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const incomingWebhookToken =
      req.headers.get("asaas-access-token") ||
      req.headers.get("x-asaas-access-token") ||
      req.headers.get("authorization")?.replace("Bearer ", "");

    if (expectedWebhookToken && incomingWebhookToken !== expectedWebhookToken) {
      return new Response(JSON.stringify({ error: "Webhook token invalido." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const textBody = await req.text();
    const payload = textBody ? JSON.parse(textBody) : {};

    const event = String(payload?.event || "").toUpperCase();
    const payment = payload?.payment || payload?.data?.payment || payload?.data || null;

    const paymentId = payment?.id || null;
    const checkoutId = payment?.checkout || payment?.checkoutSession || payload?.checkout?.id || payload?.checkoutId || null;
    const paymentStatus = normalizeStatus(payment?.status);
    const subscriptionId = payment?.subscription || getPayloadSubscriptionId(payload);

    let session = null;

    if (checkoutId) {
      const { data: byCheckoutSession } = await supabaseAdmin
        .from("asaas_checkout_sessions")
        .select("*")
        .eq("checkout_id", checkoutId)
        .maybeSingle();
      session = byCheckoutSession || null;
    }

    if (!session && paymentId) {
      const { data: byPaymentSession } = await supabaseAdmin
        .from("asaas_checkout_sessions")
        .select("*")
        .eq("payment_id", paymentId)
        .maybeSingle();
      session = byPaymentSession || null;
    }

    let userId = session?.user_id || null;
    let planId = session?.plan_id || null;
    let courseSlug = session?.course_slug || null;

    if (!userId && payment?.customer) {
      const { data: profileByCustomer } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("asaas_customer_id", payment.customer)
        .maybeSingle();

      if (profileByCustomer?.id) {
        userId = profileByCustomer.id;
      }
    }

    const { data: existingTx } = paymentId
      ? await supabaseAdmin
          .from("payment_transactions")
          .select("*")
          .eq("provider", "asaas")
          .eq("payment_id", paymentId)
          .maybeSingle()
      : { data: null };

    if (!planId && existingTx?.plan_id) planId = existingTx.plan_id;
    if (!courseSlug && existingTx?.course_slug) courseSlug = existingTx.course_slug;
    if (!userId && existingTx?.user_id) userId = existingTx.user_id;

    if (!planId && subscriptionId && userId) {
      const { data: candidateTxs } = await supabaseAdmin
        .from("payment_transactions")
        .select("plan_id,raw_payload")
        .eq("provider", "asaas")
        .eq("user_id", userId)
        .eq("transaction_type", "plan")
        .order("created_at", { ascending: false })
        .limit(50);

      const bySubscription = (candidateTxs || []).find((tx: any) => {
        return getPayloadSubscriptionId(tx?.raw_payload) === subscriptionId;
      });

      if (bySubscription?.plan_id) {
        planId = bySubscription.plan_id;
      }
    }

    if (!planId && userId) {
      const { data: profileTier } = await supabaseAdmin
        .from("profiles")
        .select("subscription_tier")
        .eq("id", userId)
        .maybeSingle();

      if (["monthly", "yearly"].includes(String(profileTier?.subscription_tier || "").toLowerCase())) {
        planId = String(profileTier?.subscription_tier).toLowerCase();
      }
    }

    if (paymentId) {
      const transactionType = courseSlug ? "course" : planId ? "plan" : "unknown";
      const parsedPaymentDate =
        parseAsaasDate(payment?.paymentDate) ||
        parseAsaasDate(payment?.clientPaymentDate) ||
        parseAsaasDate(payment?.confirmedDate) ||
        parseAsaasDate(payment?.dateCreated) ||
        parseAsaasDate(payment?.dueDate);

      const isPaidNow = PAID_EVENTS.has(event) || (paymentStatus ? PAID_STATUSES.has(paymentStatus) : false);
      const existingStatus = normalizeStatus(existingTx?.status);
      const existingIsInactive = INACTIVE_STATUSES.has(existingStatus || "");
      const keepInactiveStatus = existingIsInactive && isPaidNow;
      const statusForUpsert =
        keepInactiveStatus
          ? existingTx?.status
          : paymentStatus || event || existingTx?.status || "EVENT_RECEIVED";

      const txPayload: Record<string, any> = {
        provider: "asaas",
        payment_id: paymentId,
        user_id: userId,
        transaction_type: transactionType,
        plan_id: planId,
        course_slug: courseSlug,
        plan_duration_days: session?.plan_duration_days || existingTx?.plan_duration_days || null,
        amount: Number(payment?.value || existingTx?.amount || session?.amount || 0),
        currency: "BRL",
        status: statusForUpsert,
        description:
          payment?.description ||
          existingTx?.description ||
          (courseSlug ? `Curso: ${courseSlug}` : planId ? `Plano: ${planId}` : "Pagamento HomeCare Match"),
        asaas_checkout_id: checkoutId || existingTx?.asaas_checkout_id || null,
        asaas_customer_id: payment?.customer || session?.asaas_customer_id || existingTx?.asaas_customer_id || null,
        invoice_url: payment?.invoiceUrl || payment?.bankSlipUrl || existingTx?.invoice_url || session?.checkout_url || null,
        payment_date: parsedPaymentDate || existingTx?.payment_date || null,
        confirmed_at: isPaidNow ? new Date().toISOString() : existingTx?.confirmed_at || null,
        last_event: event || existingTx?.last_event || null,
        raw_payload: payload,
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin.from("payment_transactions").upsert(txPayload, { onConflict: "payment_id,provider" });
    }

    if (session?.id) {
      const sessionStatus = normalizeStatus(session?.status);
      const sessionPaymentStatus = normalizeStatus(session?.payment_status);
      const incomingPaid = PAID_EVENTS.has(event) || (paymentStatus ? PAID_STATUSES.has(paymentStatus) : false);
      const sessionIsInactive =
        INACTIVE_STATUSES.has(sessionStatus || "") ||
        INACTIVE_STATUSES.has(sessionPaymentStatus || "");
      const keepInactiveSessionState = sessionIsInactive && incomingPaid;

      const checkoutUpdatePayload: Record<string, any> = {
        status: keepInactiveSessionState ? session.status : paymentStatus || event || "EVENT_RECEIVED",
        payment_id: paymentId || session.payment_id || null,
        payment_status: keepInactiveSessionState ? session.payment_status : paymentStatus || null,
        raw_response: payload,
        updated_at: new Date().toISOString(),
      };

      if (!keepInactiveSessionState && (PAID_EVENTS.has(event) || (paymentStatus ? PAID_STATUSES.has(paymentStatus) : false))) {
        checkoutUpdatePayload.paid_at = new Date().toISOString();
      }

      await supabaseAdmin.from("asaas_checkout_sessions").update(checkoutUpdatePayload).eq("id", session.id);
    }

    const previousStatus = normalizeStatus(existingTx?.status) || "";
    const wasPaidBefore = PAID_STATUSES.has(previousStatus);
    const wasInactiveBefore = INACTIVE_STATUSES.has(previousStatus);
    const isPaidNow = PAID_EVENTS.has(event) || (paymentStatus ? PAID_STATUSES.has(paymentStatus) : false);

    if (isPaidNow && !wasPaidBefore && !wasInactiveBefore && userId) {
      if (planId) {
        const planDurationDays = Number(session?.plan_duration_days || existingTx?.plan_duration_days || tierToDurationDays(planId));
        const paymentBaseDate =
          parseAsaasDate(payment?.paymentDate) ||
          parseAsaasDate(payment?.clientPaymentDate) ||
          parseAsaasDate(payment?.confirmedDate) ||
          new Date().toISOString();

        const baseDate = new Date(paymentBaseDate);
        const subscriptionEndAt = new Date(baseDate.getTime() + planDurationDays * 24 * 60 * 60 * 1000).toISOString();

        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_tier: planId,
            subscription_end_at: subscriptionEndAt,
            cancel_at_period_end: planId !== "monthly",
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (paymentId) {
          await supabaseAdmin
            .from("payment_transactions")
            .update({ subscription_end_at: subscriptionEndAt, updated_at: new Date().toISOString() })
            .eq("provider", "asaas")
            .eq("payment_id", paymentId);
        }

        try {
          const renewalText =
            planId === "monthly"
              ? "Sua assinatura mensal foi confirmada e seguira com renovacao automatica."
              : `Sua assinatura do plano ${planId} foi ativada com sucesso.`;
          await supabaseAdmin.from("notifications").insert({
            user_id: userId,
            title: "Pagamento confirmado",
            content: renewalText,
            link: "/dashboard",
            type: "success",
          });
        } catch {
          // not critical
        }

        try {
          await supabaseAdmin.from("admin_notifications").insert({
            title: "Nova assinatura confirmada",
            content: `Plano ativado: ${planId}`,
            link: "/admin/usuarios",
            type: "success",
          });
        } catch {
          // not critical
        }
      }

      if (courseSlug) {
        await supabaseAdmin
          .from("academy_enrollments")
          .upsert({
            user_id: userId,
            course_slug: courseSlug,
            created_at: new Date().toISOString(),
          }, { onConflict: "user_id,course_slug" });

        try {
          const { data: course } = await supabaseAdmin
            .from("academy_courses")
            .select("title")
            .eq("slug", courseSlug)
            .maybeSingle();

          await supabaseAdmin.from("notifications").insert({
            user_id: userId,
            title: "Curso adquirido",
            content: `Seu acesso ao curso ${course?.title || courseSlug} foi liberado.`,
            link: `/cursos/${courseSlug}`,
            type: "success",
          });
        } catch {
          // not critical
        }

        try {
          await supabaseAdmin.from("admin_notifications").insert({
            title: "Novo curso vendido",
            content: `Curso adquirido: ${courseSlug}`,
            link: "/admin/cursos",
            type: "success",
          });
        } catch {
          // not critical
        }
      }
    }

    return new Response(
      JSON.stringify({
        received: true,
        event,
        paymentId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
