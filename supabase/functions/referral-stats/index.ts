// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  // Lista arquivos de referrals/referrerId para contar indicações
  const { data: files, error: listError } = await supabaseAdmin.storage.from("uploads").list(`referrals/${referrerId}`, { limit: 1000 });
  if (listError) {
    console.error("[referral-stats] list error", listError);
    return new Response(JSON.stringify({ error: "list_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const count = (files || []).length;

  // Carrega tiers
  let tiers: any[] = [];
  const { data: tiersFile } = await supabaseAdmin.storage.from("uploads").download("referrals/tiers.json");
  if (tiersFile) {
    try {
      const text = await tiersFile.text();
      tiers = JSON.parse(text);
    } catch (e) {
      console.warn("[referral-stats] tiers.json invalid", e);
    }
  }

  // Checa override manual
  let currentTier = null;
  let nextTier = null;
  const { data: overrideFile } = await supabaseAdmin.storage.from("uploads").download(`referrals/overrides/${referrerId}.json`);
  if (overrideFile) {
    try {
      const overrideText = await overrideFile.text();
      const overrideTier = JSON.parse(overrideText);
      if (overrideTier && overrideTier.badge_label) {
        currentTier = overrideTier;
      }
    } catch {
      // ignore
    }
  }

  if (!currentTier && tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
    for (const t of sorted) {
      if (count >= t.threshold) {
        currentTier = t;
      } else if (!nextTier) {
        nextTier = t;
      }
    }
  }

  // Se houver currentTier e ainda existir um próximo baseado na contagem, calcula
  if (!nextTier && tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
    for (const t of sorted) {
      if (count < t.threshold) {
        nextTier = t;
        break;
      }
    }
  }

  return new Response(JSON.stringify({ count, currentTier, nextTier }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});