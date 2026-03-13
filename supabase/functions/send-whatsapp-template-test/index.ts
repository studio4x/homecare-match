import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  enqueueAdminWhatsappNotification,
  enqueueUserWhatsappNotification,
  enqueueWhatsappQueueEntry,
  getConfiguredTemplateNameForEvent,
  getTemplateNameForTarget,
  isWhatsappEnabled,
  normalizeBrazilPhoneToE164,
  normalizeTemplateParams,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const parseBody = async (req: Request) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

const parseResponseBody = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    try {
      return { raw: await response.text() };
    } catch {
      return { raw: null };
    }
  }
};

const asTrimmedText = (value: unknown) => String(value ?? "").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: "Config ausente (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const payload = await parseBody(req);

  const authHeaderToken = asTrimmedText(req.headers.get("authorization")).replace(/^Bearer\s+/i, "").trim();
  const bodyToken = asTrimmedText(payload?.access_token);
  const accessToken = authHeaderToken || bodyToken;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Nao autorizado: token ausente." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ error: "Nao autorizado: token invalido." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: actorProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, is_admin, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  const isAdmin = Boolean(actorProfile?.is_admin || actorProfile?.role === "admin");
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Acesso negado: apenas admin." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isWhatsappEnabled()) {
    return new Response(JSON.stringify({ error: "WhatsApp desabilitado no ambiente." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const eventType = asTrimmedText(payload?.event_type).toLowerCase();
    if (!eventType) {
      return new Response(JSON.stringify({ error: "event_type e obrigatorio." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetKind = asTrimmedText(payload?.target_kind).toLowerCase() === "admin" ? "admin" : "user";
    const targetUserId = asTrimmedText(payload?.target_user_id);
    const providedTemplateName = asTrimmedText(payload?.template_name);
    const destinationInput = asTrimmedText(payload?.destination_phone_e164);
    const destinationPhoneE164 = destinationInput ? normalizeBrazilPhoneToE164(destinationInput) : null;

    if (destinationInput && !destinationPhoneE164) {
      return new Response(JSON.stringify({ error: "destination_phone_e164 invalido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const configuredTemplateName = await getConfiguredTemplateNameForEvent(supabaseAdmin, targetKind, eventType);
    const templateName = providedTemplateName || configuredTemplateName || getTemplateNameForTarget(targetKind, eventType);
    const templateParams = normalizeTemplateParams(payload?.template_params);

    let enqueueResult: { queued: boolean; reason?: string } = { queued: false, reason: "unknown" };

    if (destinationPhoneE164) {
      enqueueResult = await enqueueWhatsappQueueEntry({
        supabaseAdmin,
        eventType,
        targetKind,
        recipientUserId: targetKind === "user" ? targetUserId || null : null,
        recipientPhoneE164: destinationPhoneE164,
        templateName,
        templateParams,
        payload: {
          test: true,
          source: "admin_whatsapp_template_tab",
          actor_id: authData.user.id,
          destination_override: true,
        },
        maxAttempts: 2,
      });
    } else if (targetKind === "admin") {
      enqueueResult = await enqueueAdminWhatsappNotification({
        supabaseAdmin,
        eventType,
        templateName,
        templateParams,
        payload: {
          test: true,
          source: "admin_whatsapp_template_tab",
          actor_id: authData.user.id,
        },
        maxAttempts: 2,
      });
    } else {
      if (!targetUserId) {
        return new Response(
          JSON.stringify({
            error:
              "Para evento de usuario informe destination_phone_e164 (recomendado) ou target_user_id.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      enqueueResult = await enqueueUserWhatsappNotification({
        supabaseAdmin,
        userId: targetUserId,
        eventType,
        templateName,
        templateParams,
        payload: {
          test: true,
          source: "admin_whatsapp_template_tab",
          actor_id: authData.user.id,
        },
        maxAttempts: 2,
      });
    }

    if (!enqueueResult.queued) {
      return new Response(
        JSON.stringify({
          error: `Nao foi possivel enfileirar o teste (${enqueueResult.reason || "erro_desconhecido"}).`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-whatsapp-notifications`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const processResult = await parseResponseBody(processResponse);

    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        event_type: eventType,
        target_kind: targetKind,
        template_name: templateName,
        process_http_status: processResponse.status,
        process_result: processResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
