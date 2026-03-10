// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DASHBOARD_ALLOWED_MODES = new Set(["dashboard_only", "signup_and_dashboard"]);

const normalizeApplyMode = (coupon: any) => {
  const rawMode = String(coupon?.apply_mode || "").trim().toLowerCase();
  if (["signup_only", "dashboard_only", "signup_and_dashboard"].includes(rawMode)) return rawMode;
  return coupon?.only_new_users ? "signup_only" : "dashboard_only";
};

const normalizeTargetTier = (coupon: any) => {
  const rawTier = String(coupon?.target_tier || "").trim().toLowerCase();
  if (rawTier === "yearly") return "yearly";
  return "monthly";
};

const tierLabel = (tier: string) => (tier === "yearly" ? "Plano Anual" : "Plano Mensal");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Nao autorizado");

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) throw new Error("Nao autorizado");

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || "").trim().toUpperCase();
    if (!code) throw new Error("Informe o codigo do cupom.");

    const { data: coupon, error: couponError } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (couponError || !coupon) throw new Error("Cupom invalido ou expirado.");

    const applyMode = normalizeApplyMode(coupon);
    if (!DASHBOARD_ALLOWED_MODES.has(applyMode)) {
      throw new Error("Este cupom e valido apenas para cadastro.");
    }

    if (Number(coupon.current_uses || 0) >= Number(coupon.max_uses || 0)) {
      throw new Error("Este cupom ja atingiu o limite maximo de utilizacoes.");
    }

    const { data: existingUsage } = await supabaseAdmin
      .from("coupon_usages")
      .select("id")
      .eq("coupon_id", coupon.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingUsage) throw new Error("Voce ja utilizou este cupom.");

    const freeDays = Math.max(1, Number(coupon.free_days || 0));
    const targetTier = normalizeTargetTier(coupon);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_end_at")
      .eq("id", user.id)
      .maybeSingle();

    const now = new Date();
    const currentEndAt = profile?.subscription_end_at ? new Date(profile.subscription_end_at) : null;
    const baseDate = currentEndAt && currentEndAt > now ? currentEndAt : now;
    const newEndDate = new Date(baseDate);
    newEndDate.setDate(newEndDate.getDate() + freeDays);

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_tier: targetTier,
        subscription_end_at: newEndDate.toISOString(),
        cancel_at_period_end: true,
        coupon_days: freeDays,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) throw updateError;

    const { error: usageInsertError } = await supabaseAdmin.from("coupon_usages").insert({
      coupon_id: coupon.id,
      user_id: user.id,
    });
    if (usageInsertError) throw usageInsertError;

    const { error: incrementError } = await supabaseAdmin.rpc("increment_coupon_uses", { coupon_id: coupon.id });
    if (incrementError) throw incrementError;

    await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      title: "Cupom aplicado",
      content: `Seu cupom ativou ${freeDays} dias no ${tierLabel(targetTier)}.`,
      type: "success",
      link: "/dashboard/pagamentos",
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cupom aplicado! Voce ganhou ${freeDays} dias no ${tierLabel(targetTier)}.`,
        freeDays,
        targetTier,
        applyMode,
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
