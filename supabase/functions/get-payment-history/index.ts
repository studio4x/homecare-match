// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const statusToDisplay = (status?: string) => {
  const value = String(status || "").toUpperCase();
  if (["RECEIVED", "CONFIRMED"].includes(value)) return "paid";
  if (["PENDING", "AWAITING_RISK_ANALYSIS"].includes(value)) return "open";
  if (["OVERDUE", "REFUNDED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(value)) return "canceled";
  return value.toLowerCase() || "unknown";
};

const parseDateToMs = (value?: string | null) => {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token || "");

    if (userError || !user) throw new Error("Usuario nao autenticado.");

    const { data: transactions, error: txError } = await supabaseAdmin
      .from("payment_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("payment_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (txError && !txError.message?.includes("payment_transactions")) {
      throw txError;
    }

    const mappedDbPayments = (transactions || []).map((t: any) => ({
      id: t.payment_id || t.id,
      date: parseDateToMs(t.payment_date || t.confirmed_at || t.created_at),
      amount: Number(t.amount || 0),
      currency: String(t.currency || "BRL").toLowerCase(),
      status: statusToDisplay(t.status),
      description:
        t.description ||
        (t.transaction_type === "course"
          ? `Curso: ${t.course_slug || "HomeCare Match"}`
          : `Plano: ${t.plan_id || "HomeCare Match"}`),
      pdf_url: t.invoice_url || null,
      type: t.transaction_type === "course" ? "one_time" : "subscription",
    }));

    if (mappedDbPayments.length > 0) {
      return new Response(JSON.stringify({ payments: mappedDbPayments }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: config } = await supabaseAdmin
      .from("site_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("asaas_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.asaas_customer_id) {
      return new Response(JSON.stringify({ payments: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const asaasEnv = asaasEnvFromConfig(config) as "sandbox" | "production";
    const asaasApiKey = getAsaasApiKey(asaasEnv);
    if (!asaasApiKey) {
      return new Response(JSON.stringify({ payments: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const asaasApiBaseUrl = getAsaasApiBaseUrl(asaasEnv);
    const params = new URLSearchParams({
      customer: profile.asaas_customer_id,
      limit: "100",
      offset: "0",
    });

    const res = await fetch(`${asaasApiBaseUrl}/payments?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(JSON.stringify({ payments: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const apiPayments = Array.isArray(json?.data) ? json.data : [];
    const mappedApiPayments = apiPayments.map((p: any) => ({
      id: p.id,
      date: parseDateToMs(p.paymentDate || p.clientPaymentDate || p.dateCreated || p.dueDate),
      amount: Number(p.value || 0),
      currency: String(p.currency || "BRL").toLowerCase(),
      status: statusToDisplay(p.status),
      description: p.description || "Pagamento HomeCare Match",
      pdf_url: p.invoiceUrl || p.bankSlipUrl || null,
      type: p.subscription ? "subscription" : "one_time",
    }));

    return new Response(JSON.stringify({ payments: mappedApiPayments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
