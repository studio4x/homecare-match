// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-chatbot-visitor-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INACTIVITY_WARNING_MS = 5 * 60 * 1000;
const INACTIVITY_CLOSE_MS = 10 * 60 * 1000;
const INACTIVITY_WARNING_TEXT =
  "Estou sem novas mensagens suas ha 5 minutos. Se nao houver interacao, esta conversa sera encerrada automaticamente em 5 minutos.";
const INACTIVITY_CLOSE_TEXT = "Conversa encerrada automaticamente por inatividade de 10 minutos.";

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

const parseAfter = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const parseIsoDate = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getLastInteractionDate = (session: any) => {
  return (
    parseIsoDate(session?.last_user_interaction_at) ||
    parseIsoDate(session?.updated_at) ||
    parseIsoDate(session?.created_at)
  );
};

const isWarningAlreadySentForCurrentCycle = (session: any, lastInteractionAt: Date | null) => {
  const warningSentAt = parseIsoDate(session?.inactivity_warning_sent_at);
  if (!warningSentAt) return false;
  if (!lastInteractionAt) return true;
  return warningSentAt.getTime() >= lastInteractionAt.getTime();
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
    const visitorHashCandidates = await buildVisitorHashCandidates({ visitorId, forwardedFor, userAgent });

    let { data: session, error: sessionError } = await supabaseAdmin
      .from("chatbot_sessions")
      .select(
        [
          "id",
          "user_id",
          "visitor_hash",
          "created_at",
          "updated_at",
          "human_handoff_active",
          "human_handoff_admin_name",
          "last_user_interaction_at",
          "inactivity_warning_sent_at",
          "user_closed_session",
          "user_closed_at",
          "auto_closed_session",
          "auto_closed_at",
        ].join(","),
      )
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
      return new Response(JSON.stringify({ error: "Sem permissao para acessar esta sessao." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.user_closed_session || session.auto_closed_session) {
      return new Response(
        JSON.stringify({
          session_id: sessionId,
          handoff_active: false,
          handoff_admin_name: null,
          updated_at: session.updated_at || null,
          session_closed: true,
          closed_reason: session.user_closed_session ? "user" : "inactivity",
          closed_at: session.user_closed_at || session.auto_closed_at || session.updated_at || null,
          messages: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const lastInteractionDate = getLastInteractionDate(session);
    const idleMs = lastInteractionDate ? Math.max(0, now - lastInteractionDate.getTime()) : 0;
    const warningAlreadySent = isWarningAlreadySentForCurrentCycle(session, lastInteractionDate);

    if (idleMs >= INACTIVITY_CLOSE_MS) {
      const { error: closeUpdateError } = await supabaseAdmin
        .from("chatbot_sessions")
        .update({
          auto_closed_session: true,
          auto_closed_at: nowIso,
          human_handoff_active: false,
          human_handoff_ended_at: nowIso,
          last_mode: "system",
          updated_at: nowIso,
        } as any)
        .eq("id", sessionId);

      if (closeUpdateError) throw closeUpdateError;

      await supabaseAdmin.from("chatbot_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: INACTIVITY_CLOSE_TEXT,
        mode: "system",
        sources: [],
      } as any);

      return new Response(
        JSON.stringify({
          session_id: sessionId,
          handoff_active: false,
          handoff_admin_name: null,
          updated_at: nowIso,
          session_closed: true,
          closed_reason: "inactivity",
          closed_at: nowIso,
          messages: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (idleMs >= INACTIVITY_WARNING_MS && !warningAlreadySent) {
      const warningCreatedAt = new Date().toISOString();
      await supabaseAdmin.from("chatbot_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: INACTIVITY_WARNING_TEXT,
        mode: "system",
        sources: [],
      } as any);

      await supabaseAdmin
        .from("chatbot_sessions")
        .update({
          inactivity_warning_sent_at: warningCreatedAt,
          last_mode: "system",
          updated_at: warningCreatedAt,
        } as any)
        .eq("id", sessionId);

      session = {
        ...session,
        inactivity_warning_sent_at: warningCreatedAt,
        last_mode: "system",
        updated_at: warningCreatedAt,
      };
    }

    let query = supabaseAdmin
      .from("chatbot_messages")
      .select("id,session_id,role,content,mode,sources,created_at")
      .eq("session_id", sessionId)
      .in("role", ["assistant", "system"])
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
        session_closed: false,
        closed_reason: null,
        closed_at: null,
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
