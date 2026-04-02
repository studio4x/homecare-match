import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: "Configuracao Supabase ausente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const headerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const bodyToken = String(payload?.access_token || "").trim();
    const token = headerToken || bodyToken;

    if (!token) {
      return new Response(JSON.stringify({ error: "401 token ausente/invalido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "401 token ausente/invalido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!(actorProfile?.is_admin || actorProfile?.role === "admin")) {
      return new Response(JSON.stringify({ error: "403 acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const configuredProvider = String(Deno.env.get("EMAIL_PROVIDER") || "mock").trim().toLowerCase() || "mock";
    const hasApiKey = !!String(Deno.env.get("EMAIL_PROVIDER_API_KEY") || "").trim();
    const hasFromEmail = !!String(Deno.env.get("EMAIL_FROM") || "").trim();
    const hasReplyTo = !!String(Deno.env.get("EMAIL_REPLY_TO") || "").trim();

    return new Response(
      JSON.stringify({
        provider: configuredProvider,
        configured: configuredProvider === "mock" ? true : hasApiKey,
        has_api_key: hasApiKey,
        has_from_email: hasFromEmail,
        has_reply_to: hasReplyTo,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
