// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const getSupabaseAdmin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

export const parseBody = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

const extractBearerToken = (headerValue: string | null) => {
  if (!headerValue) return "";
  const trimmed = headerValue.trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  return (match?.[1] || "").trim();
};

export const resolveToken = (req: Request, body: any) => {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  const tokenFromHeader = extractBearerToken(authHeader);
  const tokenFromBody = typeof body?.access_token === "string" ? body.access_token.trim() : "";
  return tokenFromHeader || tokenFromBody;
};

export const requireUser = async (supabaseAdmin: any, token: string) => {
  if (!token) {
    return { error: jsonResponse({ error: "Sessão inválida (token ausente)" }, 401) };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return { error: jsonResponse({ error: "Sessão inválida" }, 401) };
  }

  return { user };
};

export const requireAdmin = async (supabaseAdmin: any, userId: string) => {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, role")
    .eq("id", userId)
    .maybeSingle();

  const isAdmin = !!(profile?.is_admin || profile?.role === "admin");
  if (!isAdmin) {
    return { error: jsonResponse({ error: "Acesso negado" }, 403) };
  }

  return { ok: true };
};

export const getBaseUrl = (req: Request) =>
  req.headers.get("origin") || Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("SITE_URL") || "https://www.homecarematch.com.br";

export const toMoney = (value: unknown) => Number(Number(value || 0).toFixed(2));

export const sanitizeSlug = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
