// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const asNonEmptyString = (value: unknown) => {
  const safe = String(value || "").trim();
  return safe.length > 0 ? safe : null;
};

const normalizeEmail = (value: unknown) => {
  const safe = asNonEmptyString(value);
  return safe ? safe.toLowerCase() : null;
};

const normalizeExternalId = (value: unknown) => {
  const safe = asNonEmptyString(value);
  return safe ? safe.toLowerCase() : null;
};

const getClientIp = (req: Request) => {
  const header =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip");
  if (!header) return null;
  return header.split(",")[0]?.trim() || null;
};

const sha256Hex = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo nao permitido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const eventName = asNonEmptyString(body?.eventName);
    const eventId = asNonEmptyString(body?.eventId);
    const eventTime = Number(body?.eventTime || Math.floor(Date.now() / 1000));
    const actionSource = asNonEmptyString(body?.actionSource) || "website";
    const eventSourceUrl = asNonEmptyString(body?.eventSourceUrl) || req.headers.get("origin") || undefined;
    const customData = isObject(body?.customData) ? body.customData : {};
    const userDataInput = isObject(body?.userData) ? body.userData : {};

    if (!eventName || !eventId || !Number.isFinite(eventTime)) {
      return new Response(JSON.stringify({ error: "Payload invalido para evento da Meta CAPI." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedEvents = new Set(["Purchase", "CompleteRegistration"]);
    if (!allowedEvents.has(eventName)) {
      return new Response(JSON.stringify({ error: "Evento nao permitido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken =
      Deno.env.get("META_CAPI_ACCESS_TOKEN") ||
      Deno.env.get("FB_CAPI_ACCESS_TOKEN") ||
      Deno.env.get("META_ACCESS_TOKEN");

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Secret META_CAPI_ACCESS_TOKEN nao configurada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: siteConfig } = await supabaseAdmin
      .from("site_config")
      .select("fb_pixel_id,fb_pixel_enabled")
      .eq("id", 1)
      .maybeSingle();

    const pixelId =
      asNonEmptyString(body?.pixelId) ||
      asNonEmptyString(siteConfig?.fb_pixel_id) ||
      asNonEmptyString(Deno.env.get("META_PIXEL_ID"));

    if (!pixelId) {
      return new Response(JSON.stringify({ error: "Pixel da Meta nao configurado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (siteConfig && siteConfig.fb_pixel_enabled === false) {
      return new Response(JSON.stringify({ success: true, skipped: "fb_pixel_disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userData: Record<string, unknown> = {};

    const normalizedEmail = normalizeEmail(userDataInput?.email);
    if (normalizedEmail) {
      userData.em = [await sha256Hex(normalizedEmail)];
    }

    const normalizedExternalId = normalizeExternalId(userDataInput?.externalId);
    if (normalizedExternalId) {
      userData.external_id = [await sha256Hex(normalizedExternalId)];
    }

    const fbp = asNonEmptyString(userDataInput?.fbp);
    const fbc = asNonEmptyString(userDataInput?.fbc);
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    const clientUserAgent = asNonEmptyString(userDataInput?.clientUserAgent) || req.headers.get("user-agent");
    const clientIpAddress = asNonEmptyString(userDataInput?.clientIpAddress) || getClientIp(req);
    if (clientUserAgent) userData.client_user_agent = clientUserAgent;
    if (clientIpAddress) userData.client_ip_address = clientIpAddress;

    const apiVersion = asNonEmptyString(Deno.env.get("META_GRAPH_API_VERSION")) || "v20.0";
    const endpoint = `https://graph.facebook.com/${apiVersion}/${pixelId}/events`;

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(eventTime),
          event_id: eventId,
          action_source: actionSource,
          event_source_url: eventSourceUrl,
          user_data: userData,
          custom_data: customData,
        },
      ],
      access_token: accessToken,
    };

    const testEventCode =
      asNonEmptyString(body?.testEventCode) || asNonEmptyString(Deno.env.get("META_CAPI_TEST_EVENT_CODE"));
    if (testEventCode) payload.test_event_code = testEventCode;

    const metaResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const metaJson = await metaResponse.json().catch(() => ({}));

    if (!metaResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Falha ao enviar evento para Meta CAPI.",
          status: metaResponse.status,
          details: metaJson,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        events_received: metaJson?.events_received ?? null,
        fbtrace_id: metaJson?.fbtrace_id ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error?.message || "Erro inesperado ao enviar evento para Meta CAPI.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

