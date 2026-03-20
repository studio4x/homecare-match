// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sanitizeStoragePath } from "../_shared/storage-path.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // sem body, assume get
  }
  const action = body?.action || "get";
  const path = sanitizeStoragePath("referrals/tiers.json", { bucket: "uploads" });

  // Leitura publica de niveis de indicacao (apenas configuracao).
  if (action === "get") {
    const { data: file, error } = await supabaseAdmin.storage.from("uploads").download(path);
    if (error || !file) {
      console.warn("[referral-config] no tiers file, returning empty list");
      return new Response(JSON.stringify({ tiers: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = await file.text();
    let tiers = [];
    try {
      tiers = JSON.parse(text);
    } catch (e) {
      console.error("[referral-config] invalid JSON in tiers file", e);
    }
    return new Response(JSON.stringify({ tiers }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

  // Ação de escrita segue restrita a administrador.
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

  if (action === "set") {
    const tiers = Array.isArray(body?.tiers) ? body.tiers : [];
    const blob = new Blob([JSON.stringify(tiers)], { type: "application/json" });
    const { error: uploadError } = await supabaseAdmin.storage.from("uploads").upload(path, blob, { upsert: true });
    if (uploadError) {
      console.error("[referral-config] upload error", uploadError);
      return new Response(JSON.stringify({ error: "set_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
