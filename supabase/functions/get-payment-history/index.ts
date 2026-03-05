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
  if (["REFUND_PENDING"].includes(value)) return "refund_pending";
  if (["REFUNDED"].includes(value)) return "refunded";
  if (["OVERDUE", "VOID", "CANCELED", "CANCELLED", "DELETED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(value)) return "canceled";
  return value.toLowerCase() || "unknown";
};

const normalizeStatus = (status?: string | null) => String(status || "").trim().toUpperCase();

const isDateOnly = (value?: string | null) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());

const parseDateToMs = (value?: string | null) => {
  if (!value) return Date.now();
  const trimmed = String(value).trim();
  if (isDateOnly(trimmed)) {
    // Keep calendar day stable across timezones when provider sends only YYYY-MM-DD.
    const parsedDateOnly = Date.parse(`${trimmed}T12:00:00Z`);
    return Number.isFinite(parsedDateOnly) ? parsedDateOnly : Date.now();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const PLAN_LABEL_BY_ID: Record<string, string> = {
  monthly: "Plano Mensal",
  yearly: "Plano Anual",
  annual: "Plano Anual",
};

const normalizePlanId = (value?: string | null) => String(value || "").trim().toLowerCase();

const getPlanDisplayName = (planId?: string | null, plansById: Record<string, string> = {}) => {
  const normalized = normalizePlanId(planId);
  if (!normalized) return "HomeCare Match";

  const dynamicName = plansById[normalized];
  if (dynamicName) return dynamicName;

  return PLAN_LABEL_BY_ID[normalized] || normalized;
};

const normalizeSubscriptionDescription = (
  rawDescription: unknown,
  rawPlanId: unknown,
  plansById: Record<string, string>,
) => {
  const description = typeof rawDescription === "string" ? rawDescription.trim() : "";
  const explicitPlanId = typeof rawPlanId === "string" ? rawPlanId : "";
  const fallbackPlan = getPlanDisplayName(explicitPlanId, plansById);

  if (!description) return `Plano: ${fallbackPlan}`;

  const match = description.match(/^plano:\s*(.+)$/i);
  if (!match) return description;

  const describedPlan = match[1]?.trim();
  if (!describedPlan) return `Plano: ${fallbackPlan}`;

  const normalizedPlan = getPlanDisplayName(describedPlan, plansById);
  return `Plano: ${normalizedPlan}`;
};

const normalizeAsaasDescription = (rawDescription: unknown) => {
  const description = typeof rawDescription === "string" ? rawDescription.trim() : "";
  if (!description) return "Pagamento HomeCare Match";

  const match = description.match(/^plano:\s*(.+)$/i);
  if (!match) return description;

  const planId = match[1]?.trim();
  return `Plano: ${getPlanDisplayName(planId)}`;
};

const extractInstallmentsFromText = (value?: string | null) => {
  const text = String(value || "");
  const match = text.match(/parcela\s+(\d+)\s+de\s*(\d+)/i);
  if (!match) return { current: null, total: null };

  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || current <= 0 || total <= 1) {
    return { current: null, total: null };
  }
  return { current, total };
};

const stripInstallmentInfo = (text: string) => {
  const stripped = String(text || "")
    .replace(/parcela\s+\d+\s+de\s*\d+\.?/gi, "")
    .replace(/parcelamento\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*[-:]*\s*/gi, "")
    .replace(/\s*[-:]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || "Plano Anual";
};

const extractPaymentPayload = (rawPayload: any) => {
  if (!rawPayload || typeof rawPayload !== "object") return {};
  return rawPayload?.payment || rawPayload?.data?.payment || rawPayload?.data || rawPayload;
};

const resolveInstallmentsFromTx = (tx: any) => {
  const payload = extractPaymentPayload(tx?.raw_payload);

  const currentRaw =
    payload?.installmentNumber ||
    payload?.installment?.installmentNumber ||
    payload?.installment_index ||
    null;

  const totalRaw =
    payload?.installmentCount ||
    payload?.installment?.installmentCount ||
    payload?.installment_count ||
    null;

  const current = Number(currentRaw);
  const total = Number(totalRaw);
  if (Number.isFinite(current) && Number.isFinite(total) && current > 0 && total > 1) {
    return { current, total };
  }

  return extractInstallmentsFromText(tx?.description);
};

const resolveInstallmentGroupKeyFromTx = (tx: any, installments: { current: number | null; total: number | null }) => {
  if (!installments.total || installments.total <= 1) return null;

  const payload = extractPaymentPayload(tx?.raw_payload);
  const checkoutId =
    tx?.asaas_checkout_id ||
    payload?.checkout ||
    payload?.checkoutSession ||
    payload?.paymentLink ||
    null;
  if (checkoutId) return `checkout:${String(checkoutId)}`;

  const subscriptionId =
    payload?.subscription ||
    tx?.raw_payload?.data?.subscription ||
    tx?.raw_payload?.subscription?.id ||
    null;
  if (subscriptionId) return `subscription:${String(subscriptionId)}`;

  const installmentId = payload?.installment || payload?.installmentId || null;
  if (installmentId) return `installment:${String(installmentId)}`;

  const externalReference = payload?.externalReference || payload?.reference || null;
  if (externalReference) return `reference:${String(externalReference)}|${installments.total}`;

  const fallbackLabel = stripInstallmentInfo(String(tx?.description || "")).toLowerCase();
  const amount = Number(tx?.amount || 0).toFixed(2);
  const currency = String(tx?.currency || "BRL").toLowerCase();
  const planId = normalizePlanId(tx?.plan_id);
  return `fallback:${tx?.user_id || ""}|${planId}|${installments.total}|${currency}|${amount}|${fallbackLabel}`;
};

const resolveInstallmentsFromApiPayment = (payment: any) => {
  const currentRaw =
    payment?.installmentNumber ||
    payment?.installment?.installmentNumber ||
    payment?.installment_index ||
    null;
  const totalRaw =
    payment?.installmentCount ||
    payment?.installment?.installmentCount ||
    payment?.installment_count ||
    null;

  const current = Number(currentRaw);
  const total = Number(totalRaw);
  if (Number.isFinite(current) && Number.isFinite(total) && current > 0 && total > 1) {
    return { current, total };
  }

  return extractInstallmentsFromText(payment?.description);
};

const resolveInstallmentGroupKeyFromApiPayment = (
  payment: any,
  installments: { current: number | null; total: number | null },
) => {
  if (!installments.total || installments.total <= 1) return null;

  const checkoutId = payment?.checkout || payment?.checkoutSession || payment?.paymentLink || null;
  if (checkoutId) return `checkout:${String(checkoutId)}`;

  if (payment?.subscription) return `subscription:${String(payment.subscription)}`;
  if (payment?.installment) return `installment:${String(payment.installment)}`;
  if (payment?.externalReference) return `reference:${String(payment.externalReference)}|${installments.total}`;

  const fallbackLabel = stripInstallmentInfo(String(payment?.description || "")).toLowerCase();
  const amount = Number(payment?.value || 0).toFixed(2);
  const currency = String(payment?.currency || "BRL").toLowerCase();
  return `fallback:${installments.total}|${currency}|${amount}|${fallbackLabel}`;
};

const resolveProviderDateField = (payment: any) => {
  const withTimeCandidates = [
    payment?.clientPaymentDate,
    payment?.confirmedDate,
    payment?.dateCreated,
    payment?.creditDate,
  ];
  for (const candidate of withTimeCandidates) {
    const raw = String(candidate || "").trim();
    if (!raw) continue;
    return { raw, hasTime: !isDateOnly(raw) };
  }

  const dateOnlyCandidates = [payment?.paymentDate, payment?.dueDate];
  for (const candidate of dateOnlyCandidates) {
    const raw = String(candidate || "").trim();
    if (!raw) continue;
    return { raw, hasTime: !isDateOnly(raw) };
  }

  return { raw: null as string | null, hasTime: false };
};

const fetchAsaasPaymentsForCustomer = async (supabaseAdmin: any, userId: string) => {
  const { data: config } = await supabaseAdmin
    .from("site_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("asaas_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.asaas_customer_id) return [];

  const asaasEnv = asaasEnvFromConfig(config) as "sandbox" | "production";
  const asaasApiKey = getAsaasApiKey(asaasEnv);
  if (!asaasApiKey) return [];

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
  if (!res.ok) return [];
  return Array.isArray(json?.data) ? json.data : [];
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

    const planIds = Array.from(
      new Set(
        (transactions || [])
          .map((t: any) => (typeof t?.plan_id === "string" ? normalizePlanId(t.plan_id) : ""))
          .filter(Boolean),
      ),
    );

    let plansById: Record<string, string> = {};
    if (planIds.length > 0) {
      const { data: plans } = await supabaseAdmin
        .from("plans")
        .select("id,name")
        .in("id", planIds);

      plansById = Object.fromEntries(
        (plans || [])
          .map((plan: any) => [normalizePlanId(plan?.id), String(plan?.name || "").trim()])
          .filter(([id, name]) => Boolean(id) && Boolean(name)),
      );
    }

    const mappedDbPayments = (transactions || []).map((t: any) => {
      const installments = resolveInstallmentsFromTx(t);
      return {
        id: t.payment_id || t.id,
        date: parseDateToMs(t.confirmed_at || t.payment_date || t.created_at),
        amount: Number(t.amount || 0),
        currency: String(t.currency || "BRL").toLowerCase(),
        status: statusToDisplay(t.status),
        raw_status: normalizeStatus(t.status) || null,
        description:
          t.transaction_type === "course"
            ? t.description || `Curso: ${t.course_slug || "HomeCare Match"}`
            : normalizeSubscriptionDescription(t.description, t.plan_id, plansById),
        pdf_url: t.invoice_url || null,
        type: t.transaction_type === "course" ? "one_time" : "subscription",
        asaas_checkout_id: t.asaas_checkout_id || null,
        installment_current: installments.current,
        installment_total: installments.total,
        installment_group_key: resolveInstallmentGroupKeyFromTx(t, installments),
      };
    });

    const asaasPayments = await fetchAsaasPaymentsForCustomer(supabaseAdmin, user.id);
    const asaasPaymentsById = new Map<string, any>();
    asaasPayments.forEach((payment: any) => {
      const id = String(payment?.id || "").trim();
      if (id) asaasPaymentsById.set(id, payment);
    });

    if (mappedDbPayments.length > 0) {
      const mergedPayments = mappedDbPayments.map((payment: any) => {
        const providerPayment = asaasPaymentsById.get(String(payment.id || "").trim());
        if (!providerPayment) return payment;

        const providerInstallments = resolveInstallmentsFromApiPayment(providerPayment);
        const providerDate = resolveProviderDateField(providerPayment);
        const mergedDate =
          providerDate.raw && providerDate.hasTime
            ? parseDateToMs(providerDate.raw)
            : payment.date;

        return {
          ...payment,
          date: mergedDate,
          status: statusToDisplay(providerPayment?.status || payment?.raw_status || payment?.status),
          raw_status: normalizeStatus(providerPayment?.status) || payment?.raw_status || null,
          pdf_url: providerPayment?.invoiceUrl || providerPayment?.bankSlipUrl || payment?.pdf_url || null,
          asaas_checkout_id:
            providerPayment?.checkout || providerPayment?.checkoutSession || payment?.asaas_checkout_id || null,
          installment_current: providerInstallments.current ?? payment?.installment_current ?? null,
          installment_total: providerInstallments.total ?? payment?.installment_total ?? null,
          installment_group_key:
            resolveInstallmentGroupKeyFromApiPayment(providerPayment, providerInstallments) ||
            payment?.installment_group_key ||
            null,
        };
      });

      return new Response(JSON.stringify({ payments: mergedPayments }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (asaasPayments.length === 0) {
      return new Response(JSON.stringify({ payments: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const mappedApiPayments = asaasPayments.map((p: any) => {
      const installments = resolveInstallmentsFromApiPayment(p);
      const providerDate = resolveProviderDateField(p);
      return {
        id: p.id,
        date: parseDateToMs(providerDate.raw || null),
        amount: Number(p.value || 0),
        currency: String(p.currency || "BRL").toLowerCase(),
        status: statusToDisplay(p.status),
        raw_status: normalizeStatus(p.status) || null,
        description: normalizeAsaasDescription(p.description),
        pdf_url: p.invoiceUrl || p.bankSlipUrl || null,
        type: p.subscription ? "subscription" : "one_time",
        asaas_checkout_id: p.checkout || p.checkoutSession || null,
        installment_current: installments.current,
        installment_total: installments.total,
        installment_group_key: resolveInstallmentGroupKeyFromApiPayment(p, installments),
      };
    });

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
