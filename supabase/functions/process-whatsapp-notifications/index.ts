import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getDestinationDigits,
  getTemplateNameForTarget,
  isWhatsappEnabled,
  normalizeTemplateParams,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const parseMetaErrorMessage = async (response: Response) => {
  try {
    const json = await response.json();
    if (typeof json?.error?.message === "string" && json.error.message.trim()) {
      return json.error.message;
    }
    if (typeof json?.message === "string" && json.message.trim()) {
      return json.message;
    }
    return JSON.stringify(json);
  } catch {
    try {
      return await response.text();
    } catch {
      return "Erro desconhecido no envio WhatsApp.";
    }
  }
};

const buildTemplateComponents = (params: unknown) => {
  const safeParams = normalizeTemplateParams(params);
  if (safeParams.length === 0) return undefined;

  return [
    {
      type: "body",
      parameters: safeParams.map((value) => ({ type: "text", text: value })),
    },
  ];
};

const getBackoffMinutes = (attemptCount: number) => {
  const exponent = Math.max(0, Number(attemptCount || 0) - 1);
  return Math.min(60, 2 ** exponent);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authToken = req.headers.get("authorization")?.replace("Bearer ", "").trim() || "";

  if (!serviceRoleKey || authToken !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Nao autorizado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!isWhatsappEnabled()) {
      return new Response(JSON.stringify({ success: true, processed: 0, skipped: "whatsapp_disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
    );

    const apiVersion = String(Deno.env.get("WHATSAPP_API_VERSION") || "v22.0").trim();
    const phoneNumberId = String(Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "").trim();
    const accessToken = String(Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "").trim();

    if (!phoneNumberId || !accessToken) {
      return new Response(JSON.stringify({ error: "Config WhatsApp incompleta (PHONE_NUMBER_ID / ACCESS_TOKEN)." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: queueItems, error: queueError } = await supabaseAdmin
      .from("whatsapp_notification_queue")
      .select("*")
      .in("status", ["pending", "retry"])
      .lte("next_retry_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(50);

    if (queueError) throw queueError;

    const items = queueItems || [];
    let sent = 0;
    let failed = 0;
    let retried = 0;

    for (const item of items) {
      const attemptCount = Number(item.attempt_count || 0) + 1;
      const maxAttempts = Math.max(1, Number(item.max_attempts || 5));
      const templateName = String(item.template_name || getTemplateNameForTarget(item.target_kind === "admin" ? "admin" : "user"));
      const destination = getDestinationDigits(String(item.recipient_phone_e164 || ""));

      if (!destination) {
        await supabaseAdmin
          .from("whatsapp_notification_queue")
          .update({
            status: "failed",
            attempt_count: attemptCount,
            updated_at: new Date().toISOString(),
            last_error: "Destino WhatsApp invalido.",
          })
          .eq("id", item.id);
        failed += 1;
        continue;
      }

      const requestBody: Record<string, unknown> = {
        messaging_product: "whatsapp",
        to: destination,
        type: "template",
        template: {
          name: templateName,
          language: { code: "pt_BR" },
        },
      };

      const components = buildTemplateComponents(item.template_params);
      if (components) {
        (requestBody.template as Record<string, unknown>).components = components;
      }

      try {
        const response = await fetch(
          `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
        );

        if (!response.ok) {
          const apiErrorMessage = await parseMetaErrorMessage(response);
          throw new Error(apiErrorMessage || `Erro HTTP ${response.status} ao enviar WhatsApp.`);
        }

        await supabaseAdmin
          .from("whatsapp_notification_queue")
          .update({
            status: "sent",
            attempt_count: attemptCount,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", item.id);

        sent += 1;
      } catch (sendError) {
        const errorMessage =
          sendError instanceof Error ? sendError.message : "Falha desconhecida ao enviar WhatsApp.";

        if (attemptCount >= maxAttempts) {
          await supabaseAdmin
            .from("whatsapp_notification_queue")
            .update({
              status: "failed",
              attempt_count: attemptCount,
              updated_at: new Date().toISOString(),
              last_error: errorMessage,
            })
            .eq("id", item.id);
          failed += 1;
          continue;
        }

        const backoffMinutes = getBackoffMinutes(attemptCount);
        const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

        await supabaseAdmin
          .from("whatsapp_notification_queue")
          .update({
            status: "retry",
            attempt_count: attemptCount,
            next_retry_at: nextRetryAt,
            updated_at: new Date().toISOString(),
            last_error: errorMessage,
          })
          .eq("id", item.id);

        retried += 1;
      }
    }

    return new Response(JSON.stringify({ success: true, processed: items.length, sent, retried, failed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
