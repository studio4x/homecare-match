// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ensureTables = async (admin: any) => {
  // Cria tabela referral_tiers se não existir
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

  // Ignora resposta; apenas garante a existência
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[referral-config] request");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabasePublic = createClient(SUPABASE_URL, ANON);
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const { data: userData } = await supabasePublic.auth.getUser(token);

  if (!userData?.user) {
    console.error("[referral-config] unauthorized");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verifica se é admin
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  const isAdmin = !!(profile?.is_admin || profile?.role === "admin");
  if (!isAdmin) {
    console.error("[referral-config] forbidden");
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await ensureTables(supabaseAdmin);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // sem body, assume get
  }
  const action = body?.action || "get";

  if (action === "get") {
    const { data: tiers, error } = await supabaseAdmin
      .from("referral_tiers")
      .select("*")
      .order("threshold", { ascending: true });

    if (error) {
      console.error("[referral-config] get error", error);
      return new Response(JSON.stringify({ error: "get_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ tiers: tiers || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "set") {
    const tiers = Array.isArray(body?.tiers) ? body.tiers : [];
    // Estratégia simples: limpa e re-insere
    const { error: delError } = await supabaseAdmin.from("referral_tiers").delete().neq("id", -1);
    if (delError) {
      console.error("[referral-config] delete error", delError);
    }
    if (tiers.length > 0) {
      const { error: insError } = await supabaseAdmin.from("referral_tiers").insert(
        tiers.map((t: any) => ({
          name: t.name,
          threshold: parseInt(t.threshold, 10),
          badge_label: t.badge_label,
        }))
      );
      if (insError) {
        console.error("[referral-config] insert error", insError);
        return new Response(JSON.stringify({ error: "set_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "invalid_action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});