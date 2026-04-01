// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail } from "../_shared/email-provider.ts";
import { enqueueUserWhatsappNotification } from "../_shared/whatsapp.ts";
import { logNotificationDelivery } from "../_shared/notification-log.ts";
import { timingSafeEqual } from "../_shared/timing-safe.ts";
import { SITE_URL, wrapLayout } from "../_shared/onboarding-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const isUuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const toBooleanFilter = (value: unknown) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
};

const resolveProfilesForJob = async (supabaseAdmin: any, job: any) => {
  const filters = job?.filters || {};
  const mode = String(job?.mode || "segment").toLowerCase();

  let query = supabaseAdmin
    .from("profiles")
    .select("id,full_name,email,phone,role,subscription_tier,email_confirmed,whatsapp_opt_in,is_verified,is_hidden");

  if (mode === "individual") {
    const userIds = Array.isArray(filters?.user_ids)
      ? filters.user_ids.filter(isUuid)
      : isUuid(filters?.user_id)
        ? [filters.user_id]
        : [];

    if (userIds.length === 0) return [];
    query = query.in("id", userIds);
  } else {
    const role = String(filters?.role || "").trim().toLowerCase();
    if (role && role !== "all") query = query.eq("role", role);

    const tier = String(filters?.subscription_tier || "").trim().toLowerCase();
    if (tier && tier !== "all") query = query.eq("subscription_tier", tier);

    const emailConfirmed = toBooleanFilter(filters?.email_confirmed);
    if (emailConfirmed !== null) query = query.eq("email_confirmed", emailConfirmed);

    const whatsappOptIn = toBooleanFilter(filters?.whatsapp_opt_in);
    if (whatsappOptIn !== null) query = query.eq("whatsapp_opt_in", whatsappOptIn);

    const isVerified = toBooleanFilter(filters?.is_verified);
    if (isVerified !== null) query = query.eq("is_verified", isVerified);

    const isHidden = toBooleanFilter(filters?.is_hidden);
    if (isHidden !== null) query = query.eq("is_hidden", isHidden);
  }

  const { data, error } = await query.limit(5000);
  if (error) throw error;
  return data || [];
};

const ensureRecipientSnapshot = async (supabaseAdmin: any, job: any) => {
  const { data: existingRecipients, error: existingError } = await supabaseAdmin
    .from("admin_communication_recipients")
    .select("id")
    .eq("job_id", job.id)
    .limit(1);

  if (existingError) throw existingError;
  if ((existingRecipients || []).length > 0) return;

  const profiles = await resolveProfilesForJob(supabaseAdmin, job);
  const channels = Array.isArray(job?.channels) ? job.channels : [];
  const rows: any[] = [];

  for (const profile of profiles) {
    for (const channel of channels) {
      if (!["email", "whatsapp"].includes(String(channel))) continue;

      rows.push({
        job_id: job.id,
        user_id: profile.id,
        channel,
        recipient_name: profile.full_name || null,
        recipient_contact: channel === "email" ? profile.email || null : profile.phone || null,
        status: "pending",
      });
    }
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("admin_communication_recipients")
      .upsert(rows, { onConflict: "job_id,user_id,channel" });

    if (insertError) throw insertError;
  }

  await supabaseAdmin
    .from("admin_communication_jobs")
    .update({
      total_recipients: rows.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
};

const processRecipient = async (supabaseAdmin: any, job: any, recipient: any, options: { preview?: boolean } = {}) => {
  const userId = recipient?.user_id || null;
  const channel = String(recipient?.channel || "");
  const recipientName = String(recipient?.recipient_name || "Usuario");
  const ctaPath = String(job?.whatsapp_cta_path || "/dashboard").trim() || "/dashboard";
  const safeMessage = String(job?.whatsapp_message || "").trim();
  const eventType = "admin_custom_user_message";
  const isPreview = options.preview === true;
  const updateRecipientStatus = async (values: Record<string, unknown>) => {
    if (isPreview || !recipient?.id) return;
    await supabaseAdmin
      .from("admin_communication_recipients")
      .update(values)
      .eq("id", recipient.id);
  };

  if (!userId) {
    await updateRecipientStatus({ status: "skipped", last_error: "missing_user_id", updated_at: new Date().toISOString() });
    return;
  }

  if (channel === "email") {
    const recipientEmail = String(recipient?.recipient_contact || "").trim().toLowerCase();
    if (!recipientEmail) {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        channel: "email",
        status: "skipped",
        recipientKind: "user",
        recipientUserId: userId,
        errorMessage: "missing_user_email",
        metadata: { job_id: job.id, preview: isPreview },
      });

      await updateRecipientStatus({ status: "skipped", last_error: "missing_user_email", updated_at: new Date().toISOString() });
      return;
    }

    const subject = String(job?.email_subject || "").trim();
    const html = String(job?.email_html || "").trim();
    const text = String(job?.email_text || "").trim();
    const wrappedHtml = wrapLayout(
      html || text,
      SITE_URL,
      "Acessar plataforma",
      SITE_URL,
    );

    if (!subject || (!html && !text)) {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        channel: "email",
        status: "skipped",
        recipientKind: "user",
        recipientUserId: userId,
        recipientContact: recipientEmail,
        errorMessage: "missing_email_content",
        metadata: { job_id: job.id, preview: isPreview },
      });

      await updateRecipientStatus({ status: "skipped", last_error: "missing_email_content", updated_at: new Date().toISOString() });
      return;
    }

    const emailResult = await sendEmail({
      to: recipientEmail,
      subject,
      html: wrappedHtml,
      text: text || undefined,
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      channel: "email",
      status: emailResult.success ? "sent" : "failed",
      recipientKind: "user",
      recipientUserId: userId,
      recipientContact: recipientEmail,
      title: subject,
      content: text || html,
      errorMessage: emailResult.error || null,
      metadata: { job_id: job.id, provider_message_id: emailResult.messageId || null, preview: isPreview },
    });

    await updateRecipientStatus({
      status: emailResult.success ? "sent" : "failed",
      provider_message_id: emailResult.messageId || null,
      last_error: emailResult.error || null,
      sent_at: emailResult.success ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });

    return;
  }

  if (channel === "whatsapp") {
    if (!safeMessage) {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        channel: "whatsapp",
        status: "skipped",
        recipientKind: "user",
        recipientUserId: userId,
        errorMessage: "missing_whatsapp_message",
        metadata: { job_id: job.id, preview: isPreview },
      });

      await updateRecipientStatus({ status: "skipped", last_error: "missing_whatsapp_message", updated_at: new Date().toISOString() });
      return;
    }

    const queued = await enqueueUserWhatsappNotification({
      supabaseAdmin,
      userId,
      eventType,
      templateParams: [recipientName, safeMessage, ctaPath],
      payload: {
        job_id: job.id,
        cta_path: ctaPath,
        message: safeMessage,
        preview: isPreview,
      },
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      channel: "whatsapp",
      status: queued.queued ? "queued" : "skipped",
      recipientKind: "user",
      recipientUserId: userId,
      recipientContact: recipient?.recipient_contact || null,
      title: "Mensagem personalizada do admin",
      content: safeMessage,
      errorMessage: queued.queued ? null : queued.reason || "whatsapp_not_queued",
      metadata: { job_id: job.id, cta_path: ctaPath, preview: isPreview },
    });

    await updateRecipientStatus({
      status: queued.queued ? "queued" : "skipped",
      last_error: queued.queued ? null : queued.reason || "whatsapp_not_queued",
      sent_at: queued.queued ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    });
  }
};

const refreshJobSummary = async (supabaseAdmin: any, jobId: string) => {
  const { data: recipients, error } = await supabaseAdmin
    .from("admin_communication_recipients")
    .select("status")
    .eq("job_id", jobId);

  if (error) throw error;

  const counts = {
    total: recipients?.length || 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    pending: 0,
  };

  for (const recipient of recipients || []) {
    const status = String(recipient?.status || "");
    if (status === "sent" || status === "queued") counts.sent += 1;
    else if (status === "failed") counts.failed += 1;
    else if (status === "skipped") counts.skipped += 1;
    else counts.pending += 1;
  }

  await supabaseAdmin
    .from("admin_communication_jobs")
    .update({
      total_recipients: counts.total,
      sent_recipients: counts.sent,
      failed_recipients: counts.failed,
      skipped_recipients: counts.skipped,
      status: counts.pending > 0 ? "processing" : counts.failed > 0 ? "failed" : "completed",
      processed_at: counts.pending > 0 ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  return counts;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: "Configuracao Supabase ausente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const authHeaderToken = req.headers.get("authorization")?.replace("Bearer ", "").trim() || "";
  const bodyToken = typeof payload?.access_token === "string" ? payload.access_token.trim() : "";
  const authToken = authHeaderToken || bodyToken;

  let authMode: "service_role" | "admin" | null = null;

  if (authToken && timingSafeEqual(authToken, serviceRoleKey)) {
    authMode = "service_role";
  } else if (authToken) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(authToken);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Nao autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: actorProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (!actorProfile?.is_admin && actorProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso negado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    authMode = "admin";
  }

  if (!authMode) {
    return new Response(JSON.stringify({ error: "Nao autorizado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (payload?.preview === true) {
      if (authMode !== "admin") {
        return new Response(JSON.stringify({ error: "Preview disponivel apenas para admin autenticado." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(authToken);
      if (authError || !authData?.user?.id) {
        return new Response(JSON.stringify({ error: "Nao foi possivel identificar o admin da previa." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, phone")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (adminProfileError) throw adminProfileError;

      const previewJob = {
        id: `preview-${crypto.randomUUID()}`,
        email_subject: payload?.email_subject || null,
        email_html: payload?.email_html || null,
        email_text: payload?.email_text || null,
        whatsapp_message: payload?.whatsapp_message || null,
        whatsapp_cta_path: payload?.whatsapp_cta_path || "/dashboard",
      };

      const channels = Array.isArray(payload?.channels)
        ? payload.channels.filter((channel: unknown) => ["email", "whatsapp"].includes(String(channel)))
        : [];

      if (channels.length === 0) {
        return new Response(JSON.stringify({ error: "Selecione ao menos um canal para a previa." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const PREVIEW_ADMIN_EMAIL = "contato@homecarematch.com.br";
      const PREVIEW_ADMIN_WHATSAPP = "+5511970800109";

      const previewRecipientBase = {
        user_id: authData.user.id,
        recipient_name: adminProfile?.full_name || authData.user.email || "Admin",
      };

      for (const channel of channels) {
        await processRecipient(
          supabaseAdmin,
          previewJob,
          {
            ...previewRecipientBase,
            channel,
            recipient_contact:
              channel === "email"
                ? PREVIEW_ADMIN_EMAIL
                : PREVIEW_ADMIN_WHATSAPP,
          },
          { preview: true },
        );
      }

      return new Response(JSON.stringify({
        success: true,
        mode: authMode,
        preview: true,
        channels,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();
    const requestedJobId = isUuid(payload?.job_id) ? payload.job_id : null;

    let jobsQuery = supabaseAdmin
      .from("admin_communication_jobs")
      .select("*")
      .in("status", ["scheduled", "processing"]);

    if (requestedJobId) {
      jobsQuery = jobsQuery.eq("id", requestedJobId);
    } else {
      jobsQuery = jobsQuery.lte("scheduled_for", nowIso);
    }

    const { data: jobs, error: jobsError } = await jobsQuery.order("scheduled_for", { ascending: true }).limit(50);
    if (jobsError) throw jobsError;

    let processedJobs = 0;
    let processedRecipients = 0;
    const summaries: any[] = [];

    for (const job of jobs || []) {
      await ensureRecipientSnapshot(supabaseAdmin, job);

      await supabaseAdmin
        .from("admin_communication_jobs")
        .update({ status: "processing", updated_at: nowIso })
        .eq("id", job.id);

      const { data: recipients, error: recipientsError } = await supabaseAdmin
        .from("admin_communication_recipients")
        .select("*")
        .eq("job_id", job.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(5000);

      if (recipientsError) throw recipientsError;

      for (const recipient of recipients || []) {
        await processRecipient(supabaseAdmin, job, recipient);
        processedRecipients += 1;
      }

      const counts = await refreshJobSummary(supabaseAdmin, job.id);
      processedJobs += 1;
      summaries.push({ job_id: job.id, counts });
    }

    return new Response(JSON.stringify({
      success: true,
      mode: authMode,
      processed_jobs: processedJobs,
      processed_recipients: processedRecipients,
      summaries,
    }), {
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
