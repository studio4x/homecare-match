// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAID_STATUSES = ["RECEIVED", "CONFIRMED", "PAID"];
const PAID_STATUS_SET = new Set(PAID_STATUSES);
const INACTIVE_STATUSES = ["REFUND_PENDING", "REFUNDED", "CANCELED", "CANCELLED", "VOID", "DELETED"];
const INACTIVE_STATUS_SET = new Set(INACTIVE_STATUSES);

const asaasEnvFromConfig = (config: any) => {
  if (config?.asaas_environment === "production") return "production";
  return "sandbox";
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

const planDurationDaysFromTier = (tier?: string | null) => {
  if (tier === "yearly") return 365;
  if (tier === "monthly") return 30;
  return 30;
};

const parseAsaasDate = (value?: string | null) => {
  if (!value) return new Date();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dateOnly = new Date(`${value}T12:00:00Z`);
    if (!Number.isNaN(dateOnly.getTime())) return dateOnly;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return new Date();
};

const normalizeStatus = (value?: string | null) => String(value || "").trim().toUpperCase();

const dateToMs = (value?: string | Date | null) => {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : 0;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Cabecalho de autorizacao ausente.");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) throw new Error("Usuario nao autenticado ou sessao expirada.");

    const body = await req.json().catch(() => ({}));
    const requestedUserId =
      typeof body?.userId === "string" && body.userId.trim().length > 0
        ? body.userId.trim()
        : null;

    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id,is_admin,role")
      .eq("id", user.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile) {
      throw new Error("Perfil do usuario nao encontrado.");
    }

    const callerRole = String(callerProfile?.role || "").trim().toLowerCase();
    const isAdmin = !!callerProfile?.is_admin || callerRole === "admin";
    const isSupport = callerRole === "support" || callerRole === "suporte";

    if (!isAdmin && !isSupport) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores/suporte." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const targetUserId = requestedUserId || user.id;

    const [{ data: lastPaidPlan, error: txError }, { data: latestInactiveTx, error: inactiveTxError }] =
      await Promise.all([
        supabaseAdmin
          .from("payment_transactions")
          .select("*")
          .eq("user_id", targetUserId)
          .eq("transaction_type", "plan")
          .in("status", PAID_STATUSES)
          .order("payment_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("payment_transactions")
          .select("status,subscription_end_at,updated_at,payment_date,created_at")
          .eq("user_id", targetUserId)
          .eq("transaction_type", "plan")
          .in("status", INACTIVE_STATUSES)
          .order("updated_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (txError && !txError.message?.includes("payment_transactions")) throw txError;
    if (inactiveTxError && !inactiveTxError.message?.includes("payment_transactions")) throw inactiveTxError;

    const latestInactiveAtMs = dateToMs(
      latestInactiveTx?.updated_at || latestInactiveTx?.subscription_end_at || latestInactiveTx?.created_at,
    );

    let activePlanTx = lastPaidPlan || null;
    if (activePlanTx && latestInactiveAtMs > 0) {
      const activeTxDateMs = dateToMs(activePlanTx.payment_date || activePlanTx.created_at || activePlanTx.updated_at);
      if (activeTxDateMs <= latestInactiveAtMs) {
        activePlanTx = null;
      }
    }

    if (!activePlanTx) {
      const [{ data: profile }, { data: config }] = await Promise.all([
        supabaseAdmin.from("profiles").select("asaas_customer_id").eq("id", targetUserId).maybeSingle(),
        supabaseAdmin.from("site_config").select("*").eq("id", 1).maybeSingle(),
      ]);

      if (profile?.asaas_customer_id) {
        const asaasEnv = asaasEnvFromConfig(config) as "sandbox" | "production";
        const asaasApiKey = getAsaasApiKey(asaasEnv);

        if (asaasApiKey) {
          const asaasApiBaseUrl = getAsaasApiBaseUrl(asaasEnv);
          const params = new URLSearchParams({
            customer: profile.asaas_customer_id,
            limit: "100",
            offset: "0",
          });

          const [sessionsRes, paymentsRes] = await Promise.all([
            supabaseAdmin
              .from("asaas_checkout_sessions")
              .select("*")
              .eq("user_id", targetUserId)
              .not("plan_id", "is", null)
              .order("created_at", { ascending: false })
              .limit(50),
            fetch(`${asaasApiBaseUrl}/payments?${params.toString()}`, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                access_token: asaasApiKey,
              },
            }),
          ]);

          const sessions = sessionsRes.data || [];
          const paymentsJson = await paymentsRes.json().catch(() => ({}));
          const payments = Array.isArray(paymentsJson?.data) ? paymentsJson.data : [];

          const validSessions = sessions.filter((session: any) => {
            const sessionStatus = normalizeStatus(session?.status);
            const sessionPaymentStatus = normalizeStatus(session?.payment_status);
            return !INACTIVE_STATUS_SET.has(sessionStatus) && !INACTIVE_STATUS_SET.has(sessionPaymentStatus);
          });

          const paidPayments = payments
            .filter((p: any) => PAID_STATUS_SET.has(normalizeStatus(p?.status)))
            .filter((p: any) => {
              if (!latestInactiveAtMs) return true;
              const paymentDate = parseAsaasDate(
                p?.paymentDate || p?.clientPaymentDate || p?.confirmedDate || p?.dateCreated || p?.dueDate,
              );
              return paymentDate.getTime() > latestInactiveAtMs;
            });

          if (validSessions.length > 0 && paidPayments.length > 0) {
            let matchedSession: any = null;
            let matchedPayment: any = null;

            for (const session of validSessions) {
              const candidate = paidPayments.find((p: any) => {
                const sameValue = Math.abs(Number(p?.value || 0) - Number(session?.amount || 0)) <= 0.01;
                const paymentDate = parseAsaasDate(p?.paymentDate || p?.clientPaymentDate || p?.dateCreated);
                const sessionDate = new Date(session?.created_at || Date.now());
                const nearDate = paymentDate.getTime() >= sessionDate.getTime() - 24 * 60 * 60 * 1000;
                return sameValue && nearDate;
              });

              if (candidate) {
                const { data: existingCandidateTx } = await supabaseAdmin
                  .from("payment_transactions")
                  .select("status")
                  .eq("provider", "asaas")
                  .eq("payment_id", candidate.id)
                  .maybeSingle();

                const existingCandidateStatus = normalizeStatus(existingCandidateTx?.status);
                if (INACTIVE_STATUS_SET.has(existingCandidateStatus)) {
                  continue;
                }

                matchedSession = session;
                matchedPayment = candidate;
                break;
              }
            }

            if (matchedSession && matchedPayment) {
              const paymentDate = parseAsaasDate(
                matchedPayment.paymentDate || matchedPayment.clientPaymentDate || matchedPayment.confirmedDate || matchedPayment.dateCreated,
              );

              const txPayload = {
                provider: "asaas",
                payment_id: matchedPayment.id,
                user_id: targetUserId,
                transaction_type: "plan",
                plan_id: matchedSession.plan_id,
                plan_duration_days: matchedSession.plan_duration_days || planDurationDaysFromTier(matchedSession.plan_id),
                amount: Number(matchedPayment.value || matchedSession.amount || 0),
                currency: "BRL",
                status: String(matchedPayment.status || "CONFIRMED").toUpperCase(),
                description: matchedPayment.description || `Plano ${matchedSession.plan_id}`,
                invoice_url: matchedPayment.invoiceUrl || matchedPayment.bankSlipUrl || matchedSession.checkout_url || null,
                asaas_checkout_id: matchedSession.checkout_id,
                asaas_customer_id: matchedPayment.customer || profile.asaas_customer_id,
                payment_date: paymentDate.toISOString(),
                confirmed_at: new Date().toISOString(),
                last_event: "MANUAL_SYNC",
                raw_payload: { source: "sync-user-subscription", payment: matchedPayment },
                updated_at: new Date().toISOString(),
              };

              const { data: insertedTx } = await supabaseAdmin
                .from("payment_transactions")
                .upsert(txPayload, { onConflict: "payment_id,provider" })
                .select("*")
                .maybeSingle();

              await supabaseAdmin
                .from("asaas_checkout_sessions")
                .update({
                  payment_id: matchedPayment.id,
                  payment_status: String(matchedPayment.status || "CONFIRMED").toUpperCase(),
                  status: "CONFIRMED",
                  paid_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", matchedSession.id);

              activePlanTx = insertedTx || { ...txPayload };
            }
          }
        }
      }
    }

    if (!activePlanTx && latestInactiveTx) {
      const canceledAt =
        latestInactiveTx.subscription_end_at ||
        latestInactiveTx.updated_at ||
        latestInactiveTx.created_at ||
        new Date().toISOString();

      const { data: canceledProfile, error: canceledProfileError } = await supabaseAdmin
        .from("profiles")
        .update({
          subscription_tier: "free_trial",
          subscription_end_at: canceledAt,
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select("*")
        .single();

      if (canceledProfileError) throw canceledProfileError;

      return new Response(
        JSON.stringify({
          success: true,
          message: "Assinatura permanece cancelada.",
          profile: canceledProfile,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    if (!activePlanTx) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nenhum pagamento de plano confirmado foi encontrado.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const baseDate = activePlanTx.payment_date
      ? new Date(activePlanTx.payment_date)
      : activePlanTx.created_at
      ? new Date(activePlanTx.created_at)
      : new Date();

    const durationDays = Number(activePlanTx.plan_duration_days || planDurationDaysFromTier(activePlanTx.plan_id));
    const subscriptionEndAt =
      activePlanTx.subscription_end_at || new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from("payment_transactions")
      .update({ subscription_end_at: subscriptionEndAt, updated_at: new Date().toISOString() })
      .eq("provider", "asaas")
      .eq("payment_id", activePlanTx.payment_id);

    const updatePayload: Record<string, any> = {
      subscription_tier: activePlanTx.plan_id,
      subscription_end_at: subscriptionEndAt,
      cancel_at_period_end: activePlanTx.plan_id !== "monthly",
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", targetUserId)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Assinatura sincronizada com sucesso!",
        profile: updatedProfile,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
