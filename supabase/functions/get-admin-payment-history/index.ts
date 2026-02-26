// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  if (courseSlug) {
    return `Curso: ${coursesBySlug[courseSlug] || description || courseSlug}`;
  }

  if (planId) {
    return `Plano: ${plansById[planId] || description || planId}`;
  }

  if (description) return description;
  return "Pagamento HomeCare Match";
};

const resolvePaymentDate = (tx: any) => {
  return tx?.confirmed_at || tx?.payment_date || tx?.created_at || new Date().toISOString();
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

    const { data: transactions, error: txError } = await supabaseAdmin
      .from("payment_transactions")
      .select(
        "id,payment_id,user_id,transaction_type,plan_id,course_slug,status,amount,currency,description,invoice_url,payment_date,confirmed_at,created_at",
      )
      .order("payment_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1000);

    if (txError) throw txError;

    const uniqueUserIds = Array.from(
      new Set((transactions || []).map((tx: any) => tx?.user_id).filter(Boolean)),
    );
    const uniquePlanIds = Array.from(
      new Set((transactions || []).map((tx: any) => String(tx?.plan_id || "").trim()).filter(Boolean)),
    );
    const uniqueCourseSlugs = Array.from(
      new Set((transactions || []).map((tx: any) => String(tx?.course_slug || "").trim()).filter(Boolean)),
    );

    const [profilesRes, plansRes, coursesRes] = await Promise.all([
      uniqueUserIds.length
        ? supabaseAdmin.from("profiles").select("id,full_name,email").in("id", uniqueUserIds)
        : Promise.resolve({ data: [] as any[] }),
      uniquePlanIds.length
        ? supabaseAdmin.from("plans").select("id,name").in("id", uniquePlanIds)
        : Promise.resolve({ data: [] as any[] }),
      uniqueCourseSlugs.length
        ? supabaseAdmin.from("academy_courses").select("slug,title").in("slug", uniqueCourseSlugs)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const usersById = Object.fromEntries(
      (profilesRes.data || []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }]),
    );
    const plansById = Object.fromEntries((plansRes.data || []).map((p: any) => [p.id, p.name]));
    const coursesBySlug = Object.fromEntries((coursesRes.data || []).map((c: any) => [c.slug, c.title]));

    const payments = (transactions || []).map((tx: any) => {
      const profile = usersById[tx.user_id] || {};
      return {
        id: tx.id || tx.payment_id,
        payment_id: tx.payment_id || null,
        client_name: profile?.full_name || profile?.email || "Cliente nao identificado",
        item_name: resolveItemLabel(tx, plansById, coursesBySlug),
        date: resolvePaymentDate(tx),
        status: statusToDisplay(tx.status),
        raw_status: normalizeStatus(tx.status) || null,
        amount: Number(tx.amount || 0),
        currency: String(tx.currency || "BRL").toLowerCase(),
        invoice_url: tx.invoice_url || null,
      };
    });

    return new Response(JSON.stringify({ payments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Erro ao consultar pagamentos." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
