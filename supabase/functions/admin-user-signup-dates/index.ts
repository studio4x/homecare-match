import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const headerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const bodyToken = String(body?.access_token || "").trim();
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

    const callerId = authData.user.id;
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, is_admin, role")
      .eq("id", callerId)
      .single();

    if (callerProfileError || !(callerProfile?.is_admin || callerProfile?.role === "admin")) {
      return new Response(JSON.stringify({ error: "403 acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = Array.isArray(body?.user_ids)
      ? Array.from(new Set(body.user_ids.map((value: unknown) => String(value || "").trim()).filter(Boolean)))
      : [];

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ signup_dates: {} }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedIds = new Set(userIds);
    const signupDates: Record<string, string | null> = {};
    let page = 1;
    const perPage = 200;
    let keepListing = true;

    while (keepListing) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw error;
      }

      const users = Array.isArray(data?.users) ? data.users : [];
      for (const authUser of users) {
        if (requestedIds.has(authUser.id)) {
          signupDates[authUser.id] = authUser.created_at || null;
        }
      }

      const matchedAll = userIds.every((id) => Object.hasOwn(signupDates, id));
      keepListing = users.length === perPage && !matchedAll;
      page += 1;
    }

    for (const userId of userIds) {
      if (!Object.hasOwn(signupDates, userId)) {
        signupDates[userId] = null;
      }
    }

    return new Response(JSON.stringify({ signup_dates: signupDates }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
