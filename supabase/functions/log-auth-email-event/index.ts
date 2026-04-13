import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logNotificationDelivery } from "../_shared/notification-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_EVENT_TYPES = new Set([
  "auth_signup_confirmation_email_requested",
  "auth_signup_confirmation_email_resent",
]);

const ALLOWED_STATUSES = new Set(["sent", "failed"]);

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

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const eventType = String(payload?.event_type || "").trim();
  const status = String(payload?.status || "").trim().toLowerCase();
  const email = String(payload?.email || "").trim().toLowerCase();
  const userId = String(payload?.user_id || "").trim() || null;
  const title = String(payload?.title || "").trim() || null;
  const errorMessage = String(payload?.error_message || "").trim() || null;

  if (!ALLOWED_EVENT_TYPES.has(eventType) || !ALLOWED_STATUSES.has(status) || !email) {
    return new Response(JSON.stringify({ error: "Payload invalido." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      channel: "email",
      status: status as "sent" | "failed",
      recipientKind: "user",
      recipientUserId: userId,
      recipientContact: email,
      title,
      content: status === "sent" ? "Solicitacao processada pelo Supabase Auth." : "Falha ao solicitar envio pelo Supabase Auth.",
      errorMessage,
      metadata: {
        source: "supabase_auth",
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
