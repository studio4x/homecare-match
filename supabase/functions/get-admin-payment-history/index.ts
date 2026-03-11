// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 1000;
const DEFAULT_MAX_ROWS = 20000;
const MAX_ALLOWED_ROWS = 50000;

const normalizeStatus = (status?: string | null) => String(status || "").trim().toUpperCase();

const statusToDisplay = (status?: string | null) => {
  const value = normalizeStatus(status);
  if (["RECEIVED", "CONFIRMED", "PAID", "SUCCEEDED"].includes(value)) return "paid";
  if (["PENDING", "AWAITING_RISK_ANALYSIS", "OPEN"].includes(value)) return "open";
  if (["REFUND_PENDING"].includes(value)) return "refund_pending";
  if (["REFUNDED"].includes(value)) return "refunded";
  if (["VOID", "CANCELED", "CANCELLED", "DELETED", "OVERDUE"].includes(value)) return "canceled";
  return value.toLowerCase() || "unknown";
};

const resolveItemLabel = (
  tx: any,
  plansById: Record<string, string>,
  coursesBySlug: Record<string, string>,
) => {
  const planId = String(tx?.plan_id || "").trim();
  const courseSlug = String(tx?.course_slug || "").trim();
  const description = String(tx?.description || "").trim();

  if (description) return description;

  if (courseSlug) {
    return `Curso: ${coursesBySlug[courseSlug] || courseSlug}`;
  }

  if (planId) {
    return `Plano: ${plansById[planId] || planId}`;
  }

  return "Pagamento HomeCare Match";
};

const resolvePaymentDate = (tx: any) => {
  return tx?.confirmed_at || tx?.payment_date || tx?.created_at || new Date().toISOString();
};

const normalizePaymentMethod = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.includes("PIX")) return "pix";
  if (normalized.includes("CREDIT") || normalized.includes("CARD")) return "credit_card";
  if (normalized.includes("BOLETO")) return "boleto";
  return "unknown";
};

const extractInstallmentsFromText = (value?: string | null) => {
  const text = String(value || "");
  const match = text.match(/parcela\s+(\d+)\s+de\s*(\d+)/i);
  if (!match) return { current: null, total: null };
  const current = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return { current: null, total: null };
  }
  return { current, total };
};

const extractPaymentPayload = (rawPayload: any) => {
  if (!rawPayload || typeof rawPayload !== "object") return {};
  return rawPayload?.payment || rawPayload?.data?.payment || rawPayload?.data || rawPayload;
};

const resolveInstallments = (tx: any) => {
  const paymentPayload = extractPaymentPayload(tx?.raw_payload);

  const currentRaw =
    paymentPayload?.installmentNumber ||
    paymentPayload?.installment?.installmentNumber ||
    paymentPayload?.installment_index ||
    null;

  const totalRaw =
    paymentPayload?.installmentCount ||
    paymentPayload?.installment?.installmentCount ||
    paymentPayload?.installment_count ||
    null;

  const current = Number(currentRaw);
  const total = Number(totalRaw);

  if (Number.isFinite(current) && Number.isFinite(total) && total > 0) {
    return { current, total };
  }

  const fallback = extractInstallmentsFromText(tx?.description);
  if (fallback.total) return fallback;
  return { current: null, total: null };
};

const resolvePaymentMethod = (tx: any) => {
  const paymentPayload = extractPaymentPayload(tx?.raw_payload);
  return normalizePaymentMethod(
    paymentPayload?.billingType ||
      paymentPayload?.billing_type ||
      paymentPayload?.chargeType ||
      paymentPayload?.paymentMethod ||
      null,
  );
};

const resolveCheckoutMethod = (checkout: any) => {
  const raw = checkout?.raw_response || {};
  const context = raw?.checkout_context || {};
  const billingTypes = Array.isArray(raw?.billingTypes) ? raw.billingTypes : [];

  return normalizePaymentMethod(
    context?.billing_type ||
      raw?.billingType ||
      billingTypes[0] ||
      raw?.paymentMethod ||
      null,
  );
};

const parseDateBound = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const parseMaxRows = (value: unknown) => {
  const fallback = DEFAULT_MAX_ROWS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(Math.floor(parsed), PAGE_SIZE), MAX_ALLOWED_ROWS);
};

const fetchPaginated = async ({
  supabaseAdmin,
  table,
  select,
  orderBy = "created_at",
  dateFrom = null,
  dateTo = null,
  maxRows = DEFAULT_MAX_ROWS,
}: {
  supabaseAdmin: any;
  table: string;
  select: string;
  orderBy?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  maxRows?: number;
}) => {
  const safeMaxRows = parseMaxRows(maxRows);
  const rows: any[] = [];
  let from = 0;
  let truncated = false;

  while (rows.length < safeMaxRows) {
    const to = Math.min(from + PAGE_SIZE - 1, safeMaxRows - 1);
    let query = supabaseAdmin.from(table).select(select).order(orderBy, { ascending: false }).range(from, to);

    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lt("created_at", dateTo);

    const { data, error } = await query;
    if (error) throw error;

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);

    if (batch.length < to - from + 1) break;
    from += PAGE_SIZE;
  }

  if (rows.length >= safeMaxRows) {
    truncated = true;
  }

  return { rows, truncated, maxRows: safeMaxRows };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const dateFrom = parseDateBound(body?.date_from ?? body?.dateFrom);
    const dateTo = parseDateBound(body?.date_to ?? body?.dateTo);
    const requestedMaxRows = parseMaxRows(body?.max_rows ?? body?.maxRows);

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

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuario nao autenticado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin,role")
      .eq("id", user.id)
      .maybeSingle();

    if (!callerProfile?.is_admin && callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const [transactionsRes, checkoutsRes] = await Promise.all([
      fetchPaginated({
        supabaseAdmin,
        table: "payment_transactions",
        select:
          "id,payment_id,user_id,transaction_type,plan_id,course_slug,status,amount,currency,description,invoice_url,payment_date,confirmed_at,created_at,asaas_checkout_id,raw_payload,last_event",
        orderBy: "created_at",
        dateFrom,
        dateTo,
        maxRows: requestedMaxRows,
      }),
      fetchPaginated({
        supabaseAdmin,
        table: "asaas_checkout_sessions",
        select:
          "id,checkout_id,payment_id,user_id,plan_id,course_slug,status,payment_status,amount,checkout_url,created_at,updated_at,paid_at,raw_response",
        orderBy: "created_at",
        dateFrom,
        dateTo,
        maxRows: requestedMaxRows,
      }),
    ]);

    const transactions = transactionsRes.rows;
    const checkouts = checkoutsRes.rows;

    const uniqueUserIds = Array.from(
      new Set(
        [...(transactions || []), ...(checkouts || [])]
          .map((entry: any) => entry?.user_id)
          .filter(Boolean),
      ),
    );
    const uniquePlanIds = Array.from(
      new Set((transactions || []).map((tx: any) => String(tx?.plan_id || "").trim()).filter(Boolean)),
    );
    const uniqueCourseSlugs = Array.from(
      new Set((transactions || []).map((tx: any) => String(tx?.course_slug || "").trim()).filter(Boolean)),
    );

    const [profilesRes, plansRes, coursesRes] = await Promise.all([
      uniqueUserIds.length
        ? supabaseAdmin
            .from("profiles")
            .select("id,full_name,email,role,is_admin,city,state,subscription_tier")
            .in("id", uniqueUserIds)
        : Promise.resolve({ data: [] as any[] }),
      uniquePlanIds.length
        ? supabaseAdmin.from("plans").select("id,name").in("id", uniquePlanIds)
        : Promise.resolve({ data: [] as any[] }),
      uniqueCourseSlugs.length
        ? supabaseAdmin.from("academy_courses").select("slug,title").in("slug", uniqueCourseSlugs)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const usersById = Object.fromEntries(
      (profilesRes.data || []).map((profile: any) => [
        profile.id,
        {
          full_name: profile.full_name,
          email: profile.email,
          role: profile.role,
          is_admin: Boolean(profile.is_admin),
          city: profile.city,
          state: profile.state,
          subscription_tier: profile.subscription_tier,
        },
      ]),
    );
    const plansById = Object.fromEntries((plansRes.data || []).map((plan: any) => [plan.id, plan.name]));
    const coursesBySlug = Object.fromEntries(
      (coursesRes.data || []).map((course: any) => [course.slug, course.title]),
    );

    const payments = (transactions || []).map((tx: any) => {
      const profile = usersById[tx.user_id] || {};
      const installments = resolveInstallments(tx);

      return {
        id: tx.id || tx.payment_id,
        payment_id: tx.payment_id || null,
        user_id: tx.user_id || null,
        transaction_type: tx.transaction_type || "unknown",
        plan_id: tx.plan_id || null,
        course_slug: tx.course_slug || null,
        asaas_checkout_id: tx.asaas_checkout_id || null,
        client_name: profile?.full_name || profile?.email || "Cliente nao identificado",
        user_email: profile?.email || null,
        user_role: profile?.is_admin ? "admin" : profile?.role || null,
        user_city: profile?.city || null,
        user_state: profile?.state || null,
        user_subscription_tier: profile?.subscription_tier || null,
        item_name: resolveItemLabel(tx, plansById, coursesBySlug),
        description: String(tx?.description || "").trim() || null,
        date: resolvePaymentDate(tx),
        created_at: tx.created_at || null,
        confirmed_at: tx.confirmed_at || null,
        status: statusToDisplay(tx.status),
        raw_status: normalizeStatus(tx.status) || null,
        amount: Number(tx.amount || 0),
        currency: String(tx.currency || "BRL").toLowerCase(),
        invoice_url: tx.invoice_url || null,
        payment_method: resolvePaymentMethod(tx),
        installment_current: installments.current,
        installment_total: installments.total,
        last_event: tx.last_event || null,
      };
    });

    const checkoutItems = (checkouts || []).map((checkout: any) => {
      const profile = usersById[checkout.user_id] || {};
      const type = checkout.course_slug ? "course" : checkout.plan_id ? "plan" : "unknown";
      return {
        id: checkout.id,
        checkout_id: checkout.checkout_id || null,
        payment_id: checkout.payment_id || null,
        user_id: checkout.user_id || null,
        transaction_type: type,
        plan_id: checkout.plan_id || null,
        course_slug: checkout.course_slug || null,
        amount: Number(checkout.amount || 0),
        status: normalizeStatus(checkout.status) || null,
        payment_status: normalizeStatus(checkout.payment_status) || null,
        payment_method: resolveCheckoutMethod(checkout),
        checkout_url: checkout.checkout_url || null,
        paid_at: checkout.paid_at || null,
        created_at: checkout.created_at || null,
        updated_at: checkout.updated_at || null,
        user_role: profile?.is_admin ? "admin" : profile?.role || null,
        user_city: profile?.city || null,
        user_state: profile?.state || null,
        user_subscription_tier: profile?.subscription_tier || null,
      };
    });

    return new Response(
      JSON.stringify({
        payments,
        checkouts: checkoutItems,
        meta: {
          date_from: dateFrom,
          date_to: dateTo,
          max_rows: requestedMaxRows,
          payments_count: payments.length,
          checkouts_count: checkoutItems.length,
          payments_truncated: transactionsRes.truncated,
          checkouts_truncated: checkoutsRes.truncated,
        },
      }),
      {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Erro ao consultar pagamentos." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
