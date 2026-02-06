// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ensureTables = async (admin: any) => {
  const createReferrals = await admin.rpc("exec_sql", {
    q: `
    CREATE TABLE IF NOT EXISTS public.referrals (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,
  });
  const createTiers = await admin.rpc("exec_sql", {
    q: `
    CREATE TABLE IF NOT EXISTS public.referral_tiers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      threshold INTEGER NOT NULL,
      badge_label TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `,
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[referral-stats] request");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const referrerId = body?.referrerId;
  if (!referrerId) {
    return new Response(JSON.stringify({ error: "referrerId_required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await ensureTables(supabaseAdmin);

  const { data: countData, error: countErr } = await supabaseAdmin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId);

  if (countErr) {
    console.error("[referral-stats] count error", countErr);
    return new Response(JSON.stringify({ error: "count_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: tiers } = await supabaseAdmin
    .from("referral_tiers")
    .select("*")
    .order("threshold", { ascending: true });

  const count = countData?.length !== undefined ? countData.length : (countData || 0);

  let currentTier = null;
  let nextTier = null;
  if (tiers && tiers.length > 0) {
    for (const t of tiers) {
      if (count >= t.threshold) {
        currentTier = t;
      } else if (!nextTier) {
        nextTier = t;
      }
    }
  }

  return new Response(JSON.stringify({ count, currentTier, nextTier }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});