// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireMappedExternalCourseId, revokeLmsRelease, syncLmsRelease } from "../_shared/lms-integration.ts";

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

const mapAsaasInactiveReason = (status: string) => {
  if (status.includes("REFUND")) return "refunded";
  if (status.includes("CANCEL")) return "cancelled";
  return "revoked_by_hcm";
};

const asaasEnvFromConfig = (config: any) => {
  if (config?.asaas_environment === "production") return "production";
  return "sandbox";
};

const asaasEnvFromRequest = (requestUrl?: string | null): "sandbox" | "production" | null => {
  if (!requestUrl) return null;
  try {
    const url = new URL(requestUrl);
    const env = String(url.searchParams.get("env") || "").toLowerCase();
    if (env === "sandbox" || env === "production") return env;
  } catch {
    // ignore malformed url
  }
  return null;
};

const getAsaasApiBaseUrl = (env: "sandbox" | "production") => {
  return env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
};

const getAsaasApiKey = (env: "sandbox" | "production") => {
  if (env === "production") {
    return (
      Deno.env.get("ASAAS_API_KEY_PRODUCTION") ||
      Deno.env.get("ASAAS_API_KEY_LIVE") ||
      Deno.env.get("ASAAS_API_KEY")
    );
  }

  return (
    Deno.env.get("ASAAS_API_KEY_SANDBOX") ||
    Deno.env.get("ASAAS_API_KEY_TEST") ||
    Deno.env.get("ASAAS_API_KEY")
  );
};

const truncateText = (value: unknown, maxLength: number, fallback: string) => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
};

const isAsaasGenericDescription = (value?: string | null) => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return true;

  return (
    text.includes("sem descricao informada") ||
    text.includes("sem descri") ||
    text.includes("description not informed") ||
    text.includes("description not provided") ||
    text === "-"
  );
};

const resolveAsaasChargeDescription = async (
  supabaseAdmin: any,
  courseSlug?: string | null,
  planId?: string | null,
) => {
  if (courseSlug) {
    const { data: course } = await supabaseAdmin
      .from("academy_courses")
      .select("title")
      .eq("slug", courseSlug)
      .maybeSingle();
    return truncateText(`Curso: ${course?.title || courseSlug}`, 120, `Curso: ${courseSlug}`);
  }

  if (planId) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("name")
      .eq("id", planId)
      .maybeSingle();
    return truncateText(`Plano: ${plan?.name || planId}`, 120, `Plano: ${planId}`);
  }

  return "Pagamento HomeCare Match";
};

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

const parseAsaasTimestamp = (value?: string | null) => {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(value)) {
    const [datePart, timePart] = value.split(" ");
    const parsed = new Date(`${datePart}T${timePart}-03:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return parseAsaasDate(value);
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
  const checkoutId =
    payment?.checkout ||
    payment?.checkoutSession ||
    payment?.paymentLink ||
    payload?.checkout?.id ||
    payload?.checkoutId ||
    payload?.paymentLink?.id ||
    payload?.paymentLink ||
    null;
  const paymentStatus = normalizeStatus(payment?.status);
  const subscriptionId = payment?.subscription || getPayloadSubscriptionId(payload);
  const externalReference = String(
    payment?.externalReference || payment?.reference || payload?.externalReference || ""
  ).trim();

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

    if ((!courseSlug || !planId) && externalReference) {
      if (!courseSlug && externalReference.toLowerCase().startsWith("course:")) {
        courseSlug = externalReference.split(":").slice(1).join(":").trim() || courseSlug;
      }
      if (!planId && externalReference.toLowerCase().startsWith("plan:")) {
        planId = externalReference.split(":").slice(1).join(":").trim() || planId;
      }
    }

    if (!session && userId) {
      const paymentValue = Number(payment?.value || 0);
      const { data: pendingSessions } = await supabaseAdmin
        .from("asaas_checkout_sessions")
        .select("*")
        .eq("user_id", userId)
        .is("payment_id", null)
        .order("created_at", { ascending: false })
        .limit(15);

      if (pendingSessions?.length) {
        session =
          pendingSessions.find((candidate: any) => Number(candidate?.amount || 0) === paymentValue) ||
          pendingSessions[0];
      }
    }

    if (!userId && session?.user_id) userId = session.user_id;
    if (!planId && session?.plan_id) planId = session.plan_id;
    if (!courseSlug && session?.course_slug) courseSlug = session.course_slug;

    if (userId && payment?.customer) {
      try {
        await supabaseAdmin
          .from("profiles")
          .update({ asaas_customer_id: payment.customer })
          .eq("id", userId)
          .is("asaas_customer_id", null);
      } catch {
        // ignore
      }
    }

    let resolvedPaymentDescription = String(payment?.description || "").trim();

    if (paymentId && (courseSlug || planId)) {
      const desiredPaymentDescription = await resolveAsaasChargeDescription(supabaseAdmin, courseSlug, planId);
      const shouldForceCourseDescription =
        Boolean(courseSlug) && resolvedPaymentDescription !== desiredPaymentDescription;
      const shouldUpdateAsaasDescription =
        isAsaasGenericDescription(resolvedPaymentDescription) || shouldForceCourseDescription;

      const { data: config } = await supabaseAdmin
        .from("site_config")
        .select("asaas_environment")
        .eq("id", 1)
        .maybeSingle();

      const configEnv = asaasEnvFromConfig(config) as "sandbox" | "production";
      const requestEnv = asaasEnvFromRequest(req.url);
      const asaasEnvCandidates: ("sandbox" | "production")[] = [];

      if (requestEnv) asaasEnvCandidates.push(requestEnv);
      if (!asaasEnvCandidates.includes(configEnv)) asaasEnvCandidates.push(configEnv);
      if (!asaasEnvCandidates.includes("production")) asaasEnvCandidates.push("production");
      if (!asaasEnvCandidates.includes("sandbox")) asaasEnvCandidates.push("sandbox");

      if (shouldUpdateAsaasDescription) {
        let updatedOnAsaas = false;

        for (const envCandidate of asaasEnvCandidates) {
          const asaasApiKey = getAsaasApiKey(envCandidate);
          if (!asaasApiKey) continue;

          try {
            const updateRes = await fetch(
              `${getAsaasApiBaseUrl(envCandidate)}/payments/${encodeURIComponent(String(paymentId))}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  access_token: asaasApiKey,
                  Authorization: `Bearer ${asaasApiKey}`,
                },
                body: JSON.stringify({
                  description: desiredPaymentDescription,
                }),
              },
            );

            const updateJson = await updateRes.json().catch(() => ({}));
            if (updateRes.ok) {
              if (typeof updateJson?.description === "string" && updateJson.description.trim()) {
                resolvedPaymentDescription = updateJson.description.trim();
              } else {
                resolvedPaymentDescription = desiredPaymentDescription;
              }
              updatedOnAsaas = true;
              break;
            }

            const shouldTryNextEnv = updateRes.status === 404 || updateRes.status === 401 || updateRes.status === 403;
            if (!shouldTryNextEnv) {
              console.warn("[asaas-webhook] Falha ao atualizar descricao no Asaas:", {
                status: updateRes.status,
                env: envCandidate,
                body: updateJson,
              });
              break;
            }
          } catch (error) {
            console.warn("[asaas-webhook] Erro ao atualizar descricao no Asaas:", {
              env: envCandidate,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (!updatedOnAsaas) {
          // fallback local: mantem descricao correta no historico interno
          resolvedPaymentDescription = desiredPaymentDescription;
        }
      } else if (!resolvedPaymentDescription || isAsaasGenericDescription(resolvedPaymentDescription)) {
        resolvedPaymentDescription = desiredPaymentDescription;
      }
    }

    if (!resolvedPaymentDescription && (courseSlug || planId)) {
      resolvedPaymentDescription = await resolveAsaasChargeDescription(supabaseAdmin, courseSlug, planId);
    }

    if (paymentId) {
      const transactionType = courseSlug ? "course" : planId ? "plan" : "unknown";
      const webhookCreatedAt = parseAsaasTimestamp(payload?.dateCreated);
      const parsedPaymentDate =
        parseAsaasDate(payment?.paymentDate) ||
        parseAsaasDate(payment?.clientPaymentDate) ||
        parseAsaasDate(payment?.confirmedDate) ||
        parseAsaasDate(payment?.dateCreated) ||
        parseAsaasDate(payment?.dueDate) ||
        webhookCreatedAt;

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
          resolvedPaymentDescription ||
          existingTx?.description ||
          (courseSlug ? `Curso: ${courseSlug}` : planId ? `Plano: ${planId}` : "Pagamento HomeCare Match"),
        asaas_checkout_id: checkoutId || existingTx?.asaas_checkout_id || null,
        asaas_customer_id: payment?.customer || session?.asaas_customer_id || existingTx?.asaas_customer_id || null,
        invoice_url: payment?.invoiceUrl || payment?.bankSlipUrl || existingTx?.invoice_url || session?.checkout_url || null,
        payment_date: parsedPaymentDate || existingTx?.payment_date || null,
        confirmed_at: isPaidNow ? webhookCreatedAt || new Date().toISOString() : existingTx?.confirmed_at || null,
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
        const webhookCreatedAt = parseAsaasTimestamp(payload?.dateCreated);
        const paymentBaseDate =
          parseAsaasDate(payment?.paymentDate) ||
          parseAsaasDate(payment?.clientPaymentDate) ||
          parseAsaasDate(payment?.confirmedDate) ||
          webhookCreatedAt ||
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
            access_status: "active",
            release_source: "purchase",
            external_reference_id: paymentId || checkoutId || `course:${courseSlug}:${userId}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,course_slug" });

        try {
          const [{ data: course }, { data: profile }] = await Promise.all([
            supabaseAdmin
              .from("academy_courses")
              .select("slug,title,external_course_id")
              .eq("slug", courseSlug)
              .maybeSingle(),
            supabaseAdmin
              .from("profiles")
              .select("id,email,full_name")
              .eq("id", userId)
              .maybeSingle(),
          ]);

          const externalCourseId = requireMappedExternalCourseId(course);
          await syncLmsRelease(supabaseAdmin, {
            request_id: `purchase:${paymentId || checkoutId || crypto.randomUUID()}`,
            source_system: "homecare_match",
            release_source: "purchase",
            external_reference_id: paymentId || checkoutId || `course:${courseSlug}:${userId}`,
            user: {
              external_user_id: userId,
              email: profile?.email || "",
              full_name: profile?.full_name || profile?.email || "Aluno HomeCare Match",
            },
            course: { external_course_id: externalCourseId },
            access: {
              status: "active",
              starts_at: new Date().toISOString(),
              ends_at: null,
              revoked_reason: null,
            },
          });
        } catch (lmsError) {
          console.error("[asaas-webhook] Falha ao sincronizar liberacao LMS:", {
            request_id: `purchase:${paymentId || checkoutId || ""}`,
            courseSlug,
            userId,
            error: lmsError?.message || lmsError,
          });
        }

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

    const incomingInactive = event ? INACTIVE_STATUSES.has(event) : false;
    const statusInactive = paymentStatus ? INACTIVE_STATUSES.has(paymentStatus) : false;

    if ((incomingInactive || statusInactive) && courseSlug && userId) {
      const inactiveStatus = normalizeStatus(paymentStatus || event || "REVOKED") || "REVOKED";
      await supabaseAdmin
        .from("academy_enrollments")
        .update({
          access_status: "revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("course_slug", courseSlug);

      try {
        const { data: course } = await supabaseAdmin
          .from("academy_courses")
          .select("slug,external_course_id")
          .eq("slug", courseSlug)
          .maybeSingle();

        await revokeLmsRelease(supabaseAdmin, {
          request_id: `revoke:${paymentId || checkoutId || crypto.randomUUID()}`,
          source_system: "homecare_match",
          external_reference_id: paymentId || checkoutId || `course:${courseSlug}:${userId}`,
          user: { external_user_id: userId },
          course: { external_course_id: requireMappedExternalCourseId(course) },
          reason: mapAsaasInactiveReason(inactiveStatus),
        });
      } catch (lmsError) {
        console.error("[asaas-webhook] Falha ao revogar liberacao LMS:", {
          request_id: `revoke:${paymentId || checkoutId || ""}`,
          courseSlug,
          userId,
          error: lmsError?.message || lmsError,
        });
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
