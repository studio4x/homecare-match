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

const buildVisitorHashCandidates = async ({
  visitorId,
  forwardedFor,
  userAgent,
}: {
  visitorId: string;
  forwardedFor: string;
  userAgent: string;
}) => {
  const normalizedVisitorId = String(visitorId || "").trim();
  const normalizedForwardedFor = String(forwardedFor || "").trim();
  const normalizedUserAgent = String(userAgent || "").trim();

  const rawCandidates = [
    normalizedVisitorId,
    [normalizedVisitorId, normalizedUserAgent].filter(Boolean).join("|"),
    [normalizedVisitorId, normalizedForwardedFor, normalizedUserAgent].filter(Boolean).join("|"),
    [normalizedForwardedFor, normalizedUserAgent].filter(Boolean).join("|"),
  ].filter((value) => value.length > 0);

  const uniqueRaw = Array.from(new Set(rawCandidates));
  const hashed = await Promise.all(uniqueRaw.map((value) => sha256Hex(value)));
  return Array.from(new Set(hashed.filter((value) => value.length > 0)));
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
    const visitorHashCandidates = await buildVisitorHashCandidates({ visitorId, forwardedFor, userAgent });

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("chatbot_sessions")
      .select("id,user_id,visitor_hash")
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
      (!userId &&
        !session.user_id &&
        visitorHashCandidates.includes(String(session.visitor_hash || "")));

    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Sem permissao para encerrar esta sessao." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("chatbot_sessions")
      .update({
        user_closed_session: true,
        user_closed_at: now,
        human_handoff_active: false,
        human_handoff_ended_at: now,
        last_mode: "system",
        updated_at: now,
      } as any)
      .eq("id", sessionId);

    if (updateError) throw updateError;

    await supabaseAdmin.from("chatbot_messages").insert({
      session_id: sessionId,
      role: "system",
      content: "Conversa encerrada pelo usuario.",
      mode: "system",
      sources: [],
    } as any);

    return new Response(JSON.stringify({ ok: true, session_id: sessionId, closed_at: now }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[support-chatbot-close-session] erro:", error?.message || error);
    return new Response(
      JSON.stringify({
        error: error?.message || "Erro ao encerrar sessao do chatbot.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
