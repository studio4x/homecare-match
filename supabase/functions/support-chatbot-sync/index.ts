// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-chatbot-visitor-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

const sha256Hex = async (value: string) => {
  const input = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", input);
  return toHex(new Uint8Array(digest));
};

const parseAfter = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "").trim();
    const after = parseAfter(body?.after);

    if (!sessionId || !isUuidLike(sessionId)) {
      return new Response(JSON.stringify({ error: "session_id invalido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim() || "";

    let userId: string | null = null;
    if (token) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) userId = data.user.id;
    }

    const visitorId = String(req.headers.get("x-chatbot-visitor-id") || "").trim();
    const forwardedFor = String(req.headers.get("x-forwarded-for") || "").trim();
    const userAgent = String(req.headers.get("user-agent") || "").trim();
    const visitorHash = await sha256Hex([visitorId, forwardedFor, userAgent].join("|"));

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("chatbot_sessions")
      .select("id,user_id,visitor_hash,human_handoff_active,human_handoff_admin_name,updated_at")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Sessao nao encontrada." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isOwner =
      (userId && session.user_id === userId) ||
      (!userId && !session.user_id && String(session.visitor_hash || "") === String(visitorHash || ""));

    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Sem permissao para acessar esta sessao." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabaseAdmin
      .from("chatbot_messages")
      .select("id,session_id,role,content,mode,sources,created_at")
      .eq("session_id", sessionId)
      .eq("role", "assistant")
      .order("created_at", { ascending: true })
      .limit(80);

    if (after) query = query.gt("created_at", after);

    const { data: rows, error: messagesError } = await query;
    if (messagesError) throw messagesError;

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        handoff_active: !!session.human_handoff_active,
        handoff_admin_name: session.human_handoff_admin_name || null,
        updated_at: session.updated_at || null,
        messages: Array.isArray(rows) ? rows : [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[support-chatbot-sync] erro:", error?.message || error);
    return new Response(
      JSON.stringify({
        error: error?.message || "Erro ao sincronizar conversa.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
