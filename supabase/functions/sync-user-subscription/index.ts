// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAID_STATUSES = ["RECEIVED", "CONFIRMED", "paid", "received", "confirmed"];

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

    const { data: lastPaidPlan, error: txError } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("transaction_type", "plan")
      .in("status", PAID_STATUSES)
      .order("payment_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (txError && !txError.message?.includes("payment_transactions")) {
      throw txError;
    }

    let activePlanTx = lastPaidPlan || null;

    if (!activePlanTx) {
      const [{ data: profile }, { data: config }] = await Promise.all([
        supabaseAdmin.from("profiles").select("asaas_customer_id").eq("id", user.id).maybeSingle(),
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
              .eq("user_id", user.id)
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

          const paidPayments = payments.filter((p: any) => ["RECEIVED", "CONFIRMED"].includes(String(p?.status || "").toUpperCase()));

          if (sessions.length > 0 && paidPayments.length > 0) {
            let matchedSession: any = null;
            let matchedPayment: any = null;

            for (const session of sessions) {
              const candidate = paidPayments.find((p: any) => {
                const sameValue = Math.abs(Number(p?.value || 0) - Number(session?.amount || 0)) <= 0.01;
                const paymentDate = parseAsaasDate(p?.paymentDate || p?.clientPaymentDate || p?.dateCreated);
                const sessionDate = new Date(session?.created_at || Date.now());
                const nearDate = paymentDate.getTime() >= sessionDate.getTime() - 24 * 60 * 60 * 1000;
                return sameValue && nearDate;
              });

              if (candidate) {
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
                user_id: user.id,
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
      .eq("id", user.id)
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
