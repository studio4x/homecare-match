// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CANCELLATION_WINDOW_DAYS = 7;
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "PAID", "SUCCEEDED"]);
const ALREADY_CANCELED_STATUSES = new Set(["REFUNDED", "CANCELED", "CANCELLED", "VOID", "DELETED"]);
const ACTIVE_PLAN_TIERS = new Set(["monthly", "yearly"]);

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

const parseAsaasErrorMessage = (payload: any, fallback: string) => {
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const first = payload.errors[0];
    if (typeof first?.description === "string" && first.description.trim()) return first.description;
  }
  return fallback;
};

const isInsufficientBalanceError = (message?: string | null) => {
  const normalized = String(message || "").toLowerCase();
  return normalized.includes("saldo insuficiente");
};

const normalizePlanId = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "annual") return "yearly";
  return normalized;
};

const isNonRemovableInstallmentError = (message?: string | null) => {
  const normalized = String(message || "").toLowerCase();
  const normalizedAscii = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    normalizedAscii.includes("parcelamento") &&
    normalizedAscii.includes("nao pode ser removido")
  ) || (
    normalizedAscii.includes("installment") &&
    normalizedAscii.includes("cannot be removed")
  );
};

const normalizeStatus = (value?: string | null) => String(value || "").trim().toUpperCase();

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatPtDate = (value: Date) => {
  return value.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Autenticacao ausente.");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) throw new Error("Usuario nao autenticado.");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const activeTier = normalizePlanId(profile?.subscription_tier);
    const hasActivePaidTier = ACTIVE_PLAN_TIERS.has(activeTier);
    if (!hasActivePaidTier) {
      throw new Error("Nenhuma assinatura ativa foi encontrada para cancelamento.");
    }

    const { data: planTransactions, error: txError } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("transaction_type", "plan")
      .order("payment_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (txError && !txError.message?.includes("payment_transactions")) throw txError;
    const transactions = Array.isArray(planTransactions) ? planTransactions : [];
    if (transactions.length === 0) throw new Error("Nenhuma assinatura encontrada para cancelamento.");

    const paidTransactions = transactions.filter((candidate: any) => {
      const status = normalizeStatus(candidate?.status);
      return PAID_STATUSES.has(status) && !ALREADY_CANCELED_STATUSES.has(status);
    });

    const paidFromActiveTier = paidTransactions.filter(
      (candidate: any) => normalizePlanId(candidate?.plan_id) === activeTier,
    );

    const tx = (paidFromActiveTier[0] || null) as any;

    if (!tx) {
      const canceledFromActiveTier = transactions.find((candidate: any) => {
        const status = normalizeStatus(candidate?.status);
        return (
          normalizePlanId(candidate?.plan_id) === activeTier &&
          ALREADY_CANCELED_STATUSES.has(status)
        );
      });

      if (canceledFromActiveTier) {
        return new Response(
          JSON.stringify({
            success: true,
            alreadyCanceled: true,
            message: "Esta assinatura ativa ja esta cancelada.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      throw new Error("Nao foi encontrada uma assinatura ativa com pagamento confirmado para cancelamento.");
    }

    const txStatus = normalizeStatus(tx.status);
    if (ALREADY_CANCELED_STATUSES.has(txStatus)) {
      return new Response(
        JSON.stringify({
          success: true,
          alreadyCanceled: true,
          message: "Esta assinatura ja esta cancelada.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    if (!PAID_STATUSES.has(txStatus)) {
      throw new Error("Somente assinaturas com pagamento confirmado podem ser canceladas.");
    }

    const paymentDate =
      parseDate(tx.payment_date) ||
      parseDate(tx.confirmed_at) ||
      parseDate(tx.created_at);

    if (!paymentDate) {
      throw new Error("Nao foi possivel identificar a data do pagamento da assinatura.");
    }

    const deadline = new Date(paymentDate.getTime() + CANCELLATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();
    if (now.getTime() > deadline.getTime()) {
      throw new Error(`Cancelamento indisponivel: o prazo terminou em ${formatPtDate(deadline)}.`);
    }

    if (!tx.payment_id) {
      throw new Error("Nao foi possivel identificar o pagamento vinculado a assinatura.");
    }

    const { data: config } = await supabaseAdmin
      .from("site_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const asaasEnv = asaasEnvFromConfig(config) as "sandbox" | "production";
    const asaasApiKey = getAsaasApiKey(asaasEnv);
    if (!asaasApiKey) {
      throw new Error("Chave da Asaas nao configurada para processar cancelamento.");
    }

    const asaasApiBaseUrl = getAsaasApiBaseUrl(asaasEnv);
    const asaasHeaders = {
      "Content-Type": "application/json",
      access_token: asaasApiKey,
    };

    const requestAsaas = async (method: string, path: string, body?: Record<string, unknown>) => {
      const response = await fetch(`${asaasApiBaseUrl}${path}`, {
        method,
        headers: asaasHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(parseAsaasErrorMessage(json, "Falha ao cancelar no Asaas."));
        (error as any).asaasPayload = json;
        (error as any).status = response.status;
        throw error;
      }
      return json;
    };

    const paymentDetails = await requestAsaas("GET", `/payments/${encodeURIComponent(tx.payment_id)}`);
    const paymentStatus = normalizeStatus(paymentDetails?.status || tx.status);
    const subscriptionId = paymentDetails?.subscription || null;
    const installmentId = paymentDetails?.installment || null;
    const asaasOperations: string[] = [];
    let refundPending = false;
    let refundErrorMessage: string | null = null;
    let installmentRemovalSkipped = false;

    if (subscriptionId) {
      await requestAsaas("DELETE", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
      asaasOperations.push("delete-subscription");
    }

    if (installmentId) {
      try {
        await requestAsaas("DELETE", `/installments/${encodeURIComponent(installmentId)}`);
        asaasOperations.push("delete-installment");
      } catch (installmentError) {
        const message =
          installmentError instanceof Error
            ? installmentError.message
            : "Falha ao cancelar parcelamento no Asaas.";

        if (!isNonRemovableInstallmentError(message)) {
          throw installmentError;
        }

        installmentRemovalSkipped = true;
        asaasOperations.push("skip-delete-installment-non-removable");
      }
    }

    if (PAID_STATUSES.has(paymentStatus)) {
      if (installmentId) {
        try {
          await requestAsaas("POST", `/installments/${encodeURIComponent(installmentId)}/refund`);
          asaasOperations.push("refund-installment");
        } catch (refundError) {
          const parsedMessage =
            refundError instanceof Error ? refundError.message : "Falha ao estornar parcelamento no Asaas.";

          if (!isInsufficientBalanceError(parsedMessage)) {
            throw refundError;
          }

          refundPending = true;
          refundErrorMessage = parsedMessage;
          asaasOperations.push("refund-installment-pending-insufficient-balance");
        }
      } else {
        try {
          await requestAsaas("POST", `/payments/${encodeURIComponent(tx.payment_id)}/refund`, {
            description: "Cancelamento solicitado pelo usuario dentro do prazo de 7 dias.",
          });
          asaasOperations.push("refund-payment");
        } catch (refundError) {
          const parsedMessage =
            refundError instanceof Error ? refundError.message : "Falha ao estornar pagamento no Asaas.";

          if (!isInsufficientBalanceError(parsedMessage)) {
            throw refundError;
          }

          refundPending = true;
          refundErrorMessage = parsedMessage;
          asaasOperations.push("refund-pending-insufficient-balance");
        }
      }
    } else {
      await requestAsaas("DELETE", `/payments/${encodeURIComponent(tx.payment_id)}`);
      asaasOperations.push("delete-payment");
    }

    const nowIso = new Date().toISOString();
    const cancellationPayload = {
      canceled_at: nowIso,
      canceled_by: user.id,
      source: "cancel-user-subscription",
      asaas_operations: asaasOperations,
      installment_id: installmentId,
      payment_status_at_cancellation: paymentStatus,
      cancellation_window_days: CANCELLATION_WINDOW_DAYS,
      refund_pending: refundPending,
      refund_error: refundErrorMessage,
      installment_removal_skipped: installmentRemovalSkipped,
    };

    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_tier: null,
        coupon_days: null,
        subscription_end_at: nowIso,
        cancel_at_period_end: true,
        updated_at: nowIso,
      })
      .eq("id", user.id);

    if (updateProfileError) throw updateProfileError;

    const { error: updateTxError } = await supabaseAdmin
      .from("payment_transactions")
      .update({
        status: refundPending ? "REFUND_PENDING" : PAID_STATUSES.has(paymentStatus) ? "REFUNDED" : "CANCELED",
        subscription_end_at: nowIso,
        last_event: refundPending ? "USER_CANCELED_REFUND_PENDING" : "USER_CANCELED_WITHIN_7_DAYS",
        raw_payload: {
          ...(tx.raw_payload || {}),
          cancellation: cancellationPayload,
        },
        updated_at: nowIso,
      })
      .eq("provider", "asaas")
      .eq("payment_id", tx.payment_id);

    if (updateTxError) throw updateTxError;

    await supabaseAdmin
      .from("asaas_checkout_sessions")
      .update({
        status: "CANCELED",
        payment_status: refundPending ? "REFUND_PENDING" : PAID_STATUSES.has(paymentStatus) ? "REFUNDED" : "CANCELED",
        updated_at: nowIso,
        raw_response: {
          source: "cancel-user-subscription",
          canceled_at: nowIso,
          asaas_operations: asaasOperations,
          installment_id: installmentId,
          refund_pending: refundPending,
          refund_error: refundErrorMessage,
        },
      })
      .eq("payment_id", tx.payment_id);

    if (refundPending) {
      try {
        await supabaseAdmin.from("admin_notifications").insert({
          title: "Estorno pendente no Asaas",
          content: `Assinatura cancelada por usuario ${user.id}, com estorno pendente no Asaas.`,
          link: "/admin/usuarios",
          type: "warning",
        });
      } catch {
        // not critical
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: refundPending
          ? "Assinatura cancelada com sucesso. O estorno esta pendente no Asaas."
          : "Assinatura cancelada com sucesso.",
        refundPending,
        installmentRemovalSkipped,
        cancellationDeadline: deadline.toISOString(),
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

