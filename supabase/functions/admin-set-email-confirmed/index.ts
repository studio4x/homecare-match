import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !callerData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = callerData.user.id;
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, is_admin, role")
      .eq("id", callerId)
      .single();

    if (!(callerProfile?.is_admin || callerProfile?.role === "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const targetUserId = String(body?.targetUserId || "").trim();
    const emailConfirmed = Boolean(body?.emailConfirmed);

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "targetUserId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", targetUserId)
      .single();

    if (targetError || !targetProfile) {
      return new Response(JSON.stringify({ error: "Target user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      email_confirm: emailConfirmed,
    });

    if (authUpdateError) {
      return new Response(JSON.stringify({ error: authUpdateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ email_confirmed: emailConfirmed })
      .eq("id", targetUserId);

    if (profileUpdateError) {
      return new Response(JSON.stringify({ error: profileUpdateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: callerId,
      action_type: "EMAIL_CONFIRMATION_UPDATE",
      target_id: targetUserId,
      details: `${emailConfirmed ? "Confirmou" : "Removeu confirmação"} do e-mail de ${targetProfile.full_name || targetProfile.email}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        emailConfirmed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

