// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REFUND_RETRY_BATCH_SIZE = 50;

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

const normalizeStatus = (value?: string | null) => String(value || "").trim().toUpperCase();

const isInsufficientBalanceError = (message?: string | null) => {
  const normalized = String(message || "").toLowerCase();
  return normalized.includes("saldo insuficiente");
};

const isAlreadyRefundedError = (message?: string | null) => {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("already refunded") ||
    normalized.includes("ja foi estornado") ||
    normalized.includes("já foi estornado") ||
    normalized.includes("ja estornado") ||
    normalized.includes("já estornado")
  );
};

const asObject = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
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

    const { data: config } = await supabaseAdmin
      .from("site_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const asaasEnv = asaasEnvFromConfig(config) as "sandbox" | "production";
    const asaasApiKey = getAsaasApiKey(asaasEnv);
    if (!asaasApiKey) {
      throw new Error("Chave da Asaas nao configurada para reprocessar estornos.");
    }

    const asaasApiBaseUrl = getAsaasApiBaseUrl(asaasEnv);
    const asaasHeaders = {
      "Content-Type": "application/json",
      access_token: asaasApiKey,
    };

    const { data: pendingTxs, error: pendingError } = await supabaseAdmin
      .from("payment_transactions")
      .select("id,payment_id,user_id,status,raw_payload,updated_at")
      .eq("provider", "asaas")
      .eq("transaction_type", "plan")
      .eq("status", "REFUND_PENDING")
      .order("updated_at", { ascending: true, nullsFirst: false })
      .limit(REFUND_RETRY_BATCH_SIZE);

    if (pendingError) throw pendingError;

    if (!pendingTxs || pendingTxs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          resolved: 0,
          pending: 0,
          message: "Nenhum estorno pendente encontrado.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let resolved = 0;
    let stillPending = 0;
    const errors: Array<{ payment_id: string; message: string }> = [];

    for (const tx of pendingTxs) {
      const nowIso = new Date().toISOString();
      const rawPayload = asObject(tx.raw_payload);
      const previousRetry = asObject(rawPayload.refund_retry);
      const attemptNumber = Number(previousRetry.attempts || 0) + 1;

      if (!tx.payment_id) {
        stillPending += 1;
        errors.push({ payment_id: "unknown", message: "Pagamento sem payment_id para estorno." });

        await supabaseAdmin
          .from("payment_transactions")
          .update({
            status: "REFUND_PENDING",
            last_event: "REFUND_RETRY_PENDING",
            raw_payload: {
              ...rawPayload,
              refund_retry: {
                attempts: attemptNumber,
                last_attempt_at: nowIso,
                last_result: "pending",
                last_message: "Pagamento sem payment_id para estorno.",
              },
            },
            updated_at: nowIso,
          })
          .eq("id", tx.id);
        continue;
      }

      const requestAsaas = async (method: string, path: string, body?: Record<string, unknown>) => {
        const response = await fetch(`${asaasApiBaseUrl}${path}`, {
          method,
          headers: asaasHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        const json = await response.json().catch(() => ({}));
        return {
          ok: response.ok,
          status: response.status,
          json,
          message: parseAsaasErrorMessage(json, "Falha ao consultar Asaas."),
        };
      };

      let resolvedNow = false;
      let lastMessage = "";

      const paymentRes = await requestAsaas("GET", `/payments/${encodeURIComponent(tx.payment_id)}`);

      if (!paymentRes.ok) {
        lastMessage = paymentRes.message || "Nao foi possivel consultar pagamento no Asaas.";
      } else {
        const paymentStatus = normalizeStatus(paymentRes.json?.status);
        if (paymentStatus === "REFUNDED") {
          resolvedNow = true;
          lastMessage = "Estorno ja confirmado no Asaas.";
        } else {
          const refundRes = await requestAsaas("POST", `/payments/${encodeURIComponent(tx.payment_id)}/refund`, {
            description: "Reprocessamento automatico de estorno pendente.",
          });

          if (refundRes.ok) {
            resolvedNow = true;
            lastMessage = "Estorno confirmado no Asaas.";
          } else if (isAlreadyRefundedError(refundRes.message)) {
            resolvedNow = true;
            lastMessage = "Estorno ja havia sido concluido no Asaas.";
          } else if (isInsufficientBalanceError(refundRes.message)) {
            resolvedNow = false;
            lastMessage = "Estorno ainda pendente no Asaas.";
          } else {
            resolvedNow = false;
            lastMessage = refundRes.message || "Falha ao reprocessar estorno no Asaas.";
          }
        }
      }

      if (resolvedNow) {
        resolved += 1;

        await supabaseAdmin
          .from("payment_transactions")
          .update({
            status: "REFUNDED",
            last_event: "REFUND_CONFIRMED_AUTO_RETRY",
            raw_payload: {
              ...rawPayload,
              refund_retry: {
                attempts: attemptNumber,
                last_attempt_at: nowIso,
                last_result: "resolved",
                last_message: lastMessage,
              },
            },
            updated_at: nowIso,
          })
          .eq("id", tx.id);

        await supabaseAdmin
          .from("asaas_checkout_sessions")
          .update({
            status: "CANCELED",
            payment_status: "REFUNDED",
            updated_at: nowIso,
            raw_response: {
              source: "process-pending-refunds",
              payment_id: tx.payment_id,
              last_result: "resolved",
              last_message: lastMessage,
              updated_at: nowIso,
            },
          })
          .eq("payment_id", tx.payment_id);

        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_tier: "free_trial",
            subscription_end_at: nowIso,
            cancel_at_period_end: true,
            updated_at: nowIso,
          })
          .eq("id", tx.user_id);

        try {
          await supabaseAdmin.from("notifications").insert({
            user_id: tx.user_id,
            title: "Estorno concluido",
            content: "O estorno da sua assinatura foi concluido com sucesso.",
            link: "/dashboard/pagamentos",
            type: "success",
          });
        } catch {
          // not critical
        }
      } else {
        stillPending += 1;
        errors.push({ payment_id: tx.payment_id, message: lastMessage || "Estorno ainda pendente." });

        await supabaseAdmin
          .from("payment_transactions")
          .update({
            status: "REFUND_PENDING",
            last_event: "REFUND_RETRY_PENDING",
            raw_payload: {
              ...rawPayload,
              refund_retry: {
                attempts: attemptNumber,
                last_attempt_at: nowIso,
                last_result: "pending",
                last_message: lastMessage || "Estorno ainda pendente.",
              },
            },
            updated_at: nowIso,
          })
          .eq("id", tx.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingTxs.length,
        resolved,
        pending: stillPending,
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
