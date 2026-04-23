// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getOutboundSigningSecret,
  hmacSha256Hex,
  logLmsIntegration,
  sanitizePayload,
} from "../_shared/lms-integration.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";

const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

const jsonHeaders = { "Content-Type": "application/json" };

const randomCodePart = () => Math.random().toString(36).substring(2, 6).toUpperCase();

const reject = async (supabaseAdmin: any, requestId: string, message: string, status = 400, payload: unknown = {}) => {
  await logLmsIntegration(supabaseAdmin, {
    request_id: requestId || crypto.randomUUID(),
    direction: "inbound",
    event_type: "lms.event",
    http_status: status,
    status: "failed",
    payload,
    response_payload: { error: message },
    error_message: message,
  });

  return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
};

serve(async (req) => {
  const requestId = req.headers.get("X-Request-Id") || crypto.randomUUID();
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  const timestamp = req.headers.get("X-HCM-Timestamp") || "";
  const providedSignature = req.headers.get("X-HCM-Signature") || "";
  const rawBody = await req.text();

  try {
    const secret = getOutboundSigningSecret();
    if (!secret) return await reject(supabaseAdmin, requestId, "Segredo HCM_OUTBOUND_SIGNING_SECRET ausente.", 500);

    const timestampDate = new Date(timestamp);
    if (!timestamp || Number.isNaN(timestampDate.getTime())) {
      return await reject(supabaseAdmin, requestId, "Timestamp invalido.", 401);
    }

    if (Math.abs(Date.now() - timestampDate.getTime()) > MAX_TIMESTAMP_SKEW_MS) {
      return await reject(supabaseAdmin, requestId, "Timestamp fora da janela permitida.", 401);
    }

    const expectedSignature = await hmacSha256Hex(`${timestamp}.${rawBody}`, secret);
    if (!providedSignature || !timingSafeEqual(providedSignature, expectedSignature)) {
      return await reject(supabaseAdmin, requestId, "Assinatura invalida.", 401);
    }

    const payload = JSON.parse(rawBody);
    const eventId = String(payload?.event_id || requestId).trim();
    const eventType = String(payload?.event_type || "").trim();
    const externalUserId = String(payload?.user?.external_user_id || "").trim();
    const externalCourseId = String(payload?.course?.external_course_id || "").trim();

    if (!eventId || !eventType || !externalUserId || !externalCourseId) {
      return await reject(supabaseAdmin, requestId, "Payload LMS incompleto.", 400, sanitizePayload(payload));
    }

    const { data: existingLog } = await supabaseAdmin
      .from("lms_integration_logs")
      .select("id,status")
      .eq("direction", "inbound")
      .eq("request_id", eventId)
      .maybeSingle();

    if (existingLog?.status === "processed") {
      await logLmsIntegration(supabaseAdmin, {
        request_id: requestId !== eventId ? requestId : `${eventId}:duplicate`,
        direction: "inbound",
        event_type: eventType,
        external_user_id: externalUserId,
        external_course_id: externalCourseId,
        http_status: 200,
        status: "ignored",
        payload,
        response_payload: { duplicate: true },
      });

      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200, headers: jsonHeaders });
    }

    await logLmsIntegration(supabaseAdmin, {
      request_id: eventId,
      direction: "inbound",
      event_type: eventType,
      external_user_id: externalUserId,
      external_course_id: externalCourseId,
      http_status: 200,
      status: "received",
      payload,
    });

    const [{ data: course }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("academy_courses")
        .select("slug,duration_minutes")
        .eq("external_course_id", externalCourseId)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("id").eq("id", externalUserId).maybeSingle(),
    ]);

    if (!course || !profile) {
      await logLmsIntegration(supabaseAdmin, {
        request_id: eventId,
        direction: "inbound",
        event_type: eventType,
        external_user_id: externalUserId,
        external_course_id: externalCourseId,
        http_status: 200,
        status: "failed",
        payload,
        error_message: "Usuario ou curso externo nao encontrado.",
      });
      return new Response(JSON.stringify({ error: "Usuario ou curso nao encontrado." }), { status: 404, headers: jsonHeaders });
    }

    const data = payload?.data || {};
    const isCompleted = eventType === "course.completed" || data?.is_completed === true;
    const progressPercent = Math.max(0, Math.min(Number(data?.progress_percent ?? (isCompleted ? 100 : 0)), 100));
    const completedAt = data?.completed_at || (isCompleted ? payload?.occurred_at || new Date().toISOString() : null);

    await supabaseAdmin
      .from("academy_enrollments")
      .upsert(
        {
          user_id: profile.id,
          course_slug: course.slug,
          access_status: "active",
          lms_progress_percent: progressPercent,
          lms_is_completed: isCompleted,
          lms_approval_status: data?.approval_status || "not_applicable",
          lms_completed_at: completedAt,
          lms_last_activity_at: data?.last_activity_at || payload?.occurred_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,course_slug" },
      );

    if (isCompleted) {
      const { data: existingCertificate } = await supabaseAdmin
        .from("certificates")
        .select("id")
        .eq("user_id", profile.id)
        .eq("course_slug", course.slug)
        .maybeSingle();

      if (!existingCertificate) {
        await supabaseAdmin.from("certificates").insert({
          user_id: profile.id,
          course_slug: course.slug,
          validation_code: `HCM-${randomCodePart()}-${randomCodePart()}`,
          workload_minutes: course.duration_minutes || 0,
          issued_at: completedAt,
        });
      }
    }

    await logLmsIntegration(supabaseAdmin, {
      request_id: eventId,
      direction: "inbound",
      event_type: eventType,
      external_user_id: externalUserId,
      external_course_id: externalCourseId,
      http_status: 200,
      status: "processed",
      payload,
      response_payload: { course_slug: course.slug, user_id: profile.id },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    return await reject(supabaseAdmin, requestId, error.message || "Falha ao processar evento LMS.", 400);
  }
});
