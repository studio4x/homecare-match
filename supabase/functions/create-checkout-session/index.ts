// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_DURATION_DAYS: Record<string, number> = {
  monthly: 30,
  yearly: 365,
};

const asaasEnvFromConfig = (config: any) => {
  if (config?.asaas_environment === "production") return "production";
  return "sandbox";
};

const getAsaasApiBaseUrl = (env: "sandbox" | "production") => {
  return env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
};

const getAsaasCheckoutBaseUrl = (env: "sandbox" | "production", custom?: string | null) => {
  if (custom && custom.trim().length > 0) {
    return custom.replace(/\/+$/, "");
  }
  return env === "production" ? "https://asaas.com" : "https://sandbox.asaas.com";
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

const normalizePhone = (value?: string | null) => {
  if (!value) return undefined;
  const onlyDigits = String(value).replace(/\D/g, "");
  return onlyDigits.length >= 10 ? onlyDigits : undefined;
};

const parseMonetaryValue = (raw: unknown): number => {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return 0;

  const sanitized = raw.trim();
  if (!sanitized) return 0;

  const hasComma = sanitized.includes(",");
  const normalized = hasComma
    ? sanitized.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")
    : sanitized.replace(/[^\d.-]/g, "");

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseAsaasErrorMessage = (payload: any, fallback: string) => {
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const first = payload.errors[0];
    if (typeof first?.description === "string" && first.description.trim()) return first.description;
  }
  return fallback;
};

const getPlanDurationDays = (plan: any) => {
  if (PLAN_DURATION_DAYS[plan?.id]) return PLAN_DURATION_DAYS[plan.id];

  const period = String(plan?.period || "").toLowerCase();
  if (period.includes("ano")) return 365;
  if (period.includes("mes") || period.includes("mês")) return 30;

  return 30;
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

    const origin = req.headers.get("origin") || Deno.env.get("PUBLIC_APP_URL") || "";
    const body = await req.json();
    const planId = body?.planId as string | undefined;
    const courseSlug = body?.courseSlug as string | undefined;

    if (!planId && !courseSlug) {
      throw new Error("Parametros invalidos: informe planId ou courseSlug.");
    }

    const { data: config } = await supabaseAdmin
      .from("site_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    const asaasEnv = asaasEnvFromConfig(config) as "sandbox" | "production";
    const asaasApiKey = getAsaasApiKey(asaasEnv);
    if (!asaasApiKey) {
      throw new Error(
        asaasEnv === "production"
          ? "Chave da Asaas ausente: configure ASAAS_API_KEY_PRODUCTION."
          : "Chave da Asaas ausente: configure ASAAS_API_KEY_SANDBOX.",
      );
    }

    const asaasApiBaseUrl = getAsaasApiBaseUrl(asaasEnv);
    const asaasCheckoutBaseUrl = getAsaasCheckoutBaseUrl(asaasEnv, config?.asaas_checkout_base_url);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    let itemName = "";
    let itemDescription = "";
    let itemAmount = 0;
    let maxInstallments = Number(config?.asaas_default_installment_max ?? 12);
    let successUrl = `${origin}/dashboard?success=true`;
    let checkoutContext: { planId?: string; courseSlug?: string; durationDays?: number } = {};

    if (courseSlug) {
      const { data: course, error: courseError } = await supabaseAdmin
        .from("academy_courses")
        .select("*")
        .eq("slug", courseSlug)
        .maybeSingle();

      if (courseError || !course) throw new Error("Curso nao encontrado.");
      if (!course.price || Number(course.price) <= 0) throw new Error("Curso sem preco configurado.");

      itemName = course.title || "Curso HomeCare Match";
      itemDescription = `Compra de curso: ${course.title || course.slug}`;
      itemAmount = Number(course.price);
      maxInstallments = Number(course.asaas_installment_max || maxInstallments || 1);
      checkoutContext = { courseSlug };
      successUrl = `${origin}/conversion/course?courseSlug=${courseSlug}&courseTitle=${encodeURIComponent(
        course.title || courseSlug,
      )}`;
    } else if (planId) {
      const { data: plan, error: planError } = await supabaseAdmin
        .from("plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();

      if (planError || !plan) throw new Error("Plano nao encontrado.");

      itemAmount = parseMonetaryValue(plan.price);
      if (!itemAmount || itemAmount <= 0) {
        throw new Error("Preco do plano invalido para pagamento.");
      }

      itemName = plan.name || `Plano ${plan.id}`;
      itemDescription = plan.description || `Assinatura do plano ${plan.name || plan.id}`;
      maxInstallments = Number(plan.asaas_installment_max || maxInstallments || 1);
      checkoutContext = { planId, durationDays: getPlanDurationDays(plan) };
      successUrl = `${origin}/conversion/subscription?planId=${planId}&planName=${encodeURIComponent(
        plan.name || planId,
      )}`;
    }

    if (itemAmount <= 0) throw new Error("Valor de pagamento invalido.");

    const customerPayload: Record<string, any> = {
      name: profile?.full_name || user.email || "Cliente HomeCare Match",
      email: user.email,
    };

    const phone = normalizePhone(profile?.phone);
    if (phone) {
      customerPayload.phone = phone;
      customerPayload.mobilePhone = phone;
    }

    let asaasCustomerId = profile?.asaas_customer_id || null;

    if (!asaasCustomerId) {
      const customerRes = await fetch(`${asaasApiBaseUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: asaasApiKey,
        },
        body: JSON.stringify(customerPayload),
      });

      const customerJson = await customerRes.json().catch(() => ({}));
      if (!customerRes.ok || !customerJson?.id) {
        throw new Error(parseAsaasErrorMessage(customerJson, "Nao foi possivel criar cliente na Asaas."));
      }

      asaasCustomerId = customerJson.id;
      await supabaseAdmin.from("profiles").update({ asaas_customer_id: asaasCustomerId }).eq("id", user.id);
    }

    const billingTypes: string[] = [];
    if (config?.asaas_allow_credit_card !== false) billingTypes.push("CREDIT_CARD");
    if (config?.asaas_allow_pix !== false) billingTypes.push("PIX");
    if (billingTypes.length === 0) billingTypes.push("CREDIT_CARD");

    const chargeTypes: string[] = ["DETACHED"];
    if (maxInstallments > 1 && billingTypes.includes("CREDIT_CARD")) {
      chargeTypes.push("INSTALLMENT");
    }

    const checkoutPayload: Record<string, any> = {
      billingTypes,
      chargeTypes,
      minutesToExpire: Number(config?.asaas_checkout_expiration_minutes ?? 60),
      callback: {
        successUrl,
        cancelUrl: `${origin}/dashboard?canceled=true`,
        expiredUrl: `${origin}/dashboard?canceled=true`,
      },
      items: [
        {
          name: itemName,
          description: itemDescription,
          quantity: 1,
          value: Number(itemAmount.toFixed(2)),
        },
      ],
      customer: asaasCustomerId,
    };

    if (chargeTypes.includes("INSTALLMENT")) {
      checkoutPayload.installment = {
        maxInstallmentCount: Math.max(2, Math.min(Number(maxInstallments), 12)),
      };
    }

    const checkoutRes = await fetch(`${asaasApiBaseUrl}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify(checkoutPayload),
    });

    const checkoutJson = await checkoutRes.json().catch(() => ({}));
    if (!checkoutRes.ok || !checkoutJson?.id) {
      throw new Error(parseAsaasErrorMessage(checkoutJson, "Nao foi possivel iniciar checkout na Asaas."));
    }

    const checkoutId = checkoutJson.id as string;
    const checkoutUrl =
      checkoutJson.url || `${asaasCheckoutBaseUrl}/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`;

    const sessionPayload: Record<string, any> = {
      checkout_id: checkoutId,
      user_id: user.id,
      plan_id: checkoutContext.planId || null,
      course_slug: checkoutContext.courseSlug || null,
      amount: Number(itemAmount.toFixed(2)),
      provider: "asaas",
      status: "CHECKOUT_CREATED",
      checkout_url: checkoutUrl,
      asaas_customer_id: asaasCustomerId,
      raw_response: checkoutJson,
    };

    if (checkoutContext.durationDays) {
      sessionPayload.plan_duration_days = checkoutContext.durationDays;
    }

    const { error: saveSessionError } = await supabaseAdmin.from("asaas_checkout_sessions").insert(sessionPayload);

    if (saveSessionError) {
      throw new Error(
        saveSessionError?.message?.includes("asaas_checkout_sessions")
          ? "Estrutura de pagamentos Asaas nao sincronizada no banco."
          : `Erro ao salvar sessao de checkout: ${saveSessionError.message}`,
      );
    }

    return new Response(
      JSON.stringify({
        url: checkoutUrl,
        checkoutId,
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
