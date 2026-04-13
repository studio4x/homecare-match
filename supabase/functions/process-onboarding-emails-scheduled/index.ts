import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail } from "../_shared/email-provider.ts";
import { evaluateOnboardingCondition, getProfessionalProfileCompletion } from "../_shared/onboarding-conditions.ts";
import { SITE_URL, replacePlaceholders, wrapLayout } from "../_shared/onboarding-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[process-onboarding-emails-scheduled] Iniciando processamento...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: globalSettings, error: settingsError } = await supabase
      .from("onboarding_system_settings")
      .select("setting_value")
      .eq("setting_key", "is_system_active")
      .maybeSingle();

    if (settingsError) {
      console.warn("[process-onboarding-emails-scheduled] Alerta ao buscar configuracao global.", settingsError);
    }

    const isEnabled = (globalSettings?.setting_value as any)?.enabled === true;
    if (!isEnabled) {
      return new Response(
        JSON.stringify({ message: "O motor de onboarding esta desativado globalmente por configuracao." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();
    const { data: flows, error: flowsError } = await supabase
      .from("user_onboarding_flows")
      .select(`
        id, user_id, flow_id, current_step_order,
        onboarding_email_flows (id, name, is_active)
      `)
      .eq("status", "active")
      .lte("next_run_at", now);

    if (flowsError) throw flowsError;
    if (!flows || flows.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum fluxo pendente para processar." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processedCount = 0;

    for (const instance of flows) {
      if (!instance.onboarding_email_flows?.is_active) continue;

      const { data: step } = await supabase
        .from("onboarding_email_steps")
        .select(`
          id, flow_id, step_order, template_id, wait_after_previous_hours,
          send_type, condition_type, condition_config, is_active,
          email_templates (id, name, slug, subject, html_content, text_content, cta_label, cta_url)
        `)
        .eq("flow_id", instance.flow_id)
        .eq("step_order", instance.current_step_order)
        .eq("is_active", true)
        .single();

      if (!step) {
        const { data: nextStepExists } = await supabase
          .from("onboarding_email_steps")
          .select("id")
          .eq("flow_id", instance.flow_id)
          .gt("step_order", instance.current_step_order)
          .order("step_order", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextStepExists) {
          await advanceFlow(supabase, instance.id, instance.current_step_order);
        } else {
          await supabase
            .from("user_onboarding_flows")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", instance.id);
        }
        continue;
      }

      let shouldSend = true;
      if (step.send_type === "conditional" && step.condition_type) {
        shouldSend = await evaluateOnboardingCondition(supabase, instance.user_id, step.condition_type, step.condition_config);
      }

      const runProcessedAt = new Date().toISOString();
      let sentStatus = "skipped";
      let errorMsg = null;
      let providerId = null;

      if (shouldSend) {
        const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(instance.user_id);
        const userEmail = user?.email;

        if (userEmail) {
          const completion = await getProfessionalProfileCompletion(supabase, instance.user_id);
          const profile = completion.profile || {};

          const vars = {
            full_name: profile.full_name || "Profissional",
            first_name: profile.full_name?.split(" ")[0] || "Profissional",
            verification_status: profile.verification_status || "pending",
            profile_completion: `${completion.percentage}%`,
            dashboard_url: `${SITE_URL}/dashboard`,
            profile_url: `${SITE_URL}/dashboard/perfil`,
            courses_url: `${SITE_URL}/dashboard/cursos`,
            search_url: `${SITE_URL}/buscar`,
            email_confirm_url: `${SITE_URL}/email-confirmed`,
          };

          const rawHtml = step.email_templates.html_content || "";
          const rawText = step.email_templates.text_content || "";
          const rawSubject = step.email_templates.subject || "HomeCare Match";
          const rawCtaLabel = step.email_templates.cta_label || "";
          let rawCtaUrl = step.email_templates.cta_url || "";

          if (rawCtaUrl && rawCtaUrl.startsWith("/")) {
            rawCtaUrl = `${SITE_URL}${rawCtaUrl}`;
          }

          const processedContent = replacePlaceholders(rawHtml, vars);
          const finalHtml = wrapLayout(processedContent, SITE_URL, rawCtaLabel, rawCtaUrl);
          const finalSubject = replacePlaceholders(rawSubject, vars);
          const finalText = replacePlaceholders(rawText, vars);

          const { success, messageId, error } = await sendEmail({
            to: userEmail,
            subject: finalSubject,
            html: finalHtml,
            text: finalText,
          });

          if (success) {
            sentStatus = "sent";
            providerId = messageId;
          } else {
            sentStatus = "failed";
            errorMsg = error;
          }
        } else {
          sentStatus = "failed";
          errorMsg = "User email not found or auth error: " + (authError?.message || "");
        }
      }

      await supabase.from("user_onboarding_step_runs").insert({
        user_onboarding_flow_id: instance.id,
        user_id: instance.user_id,
        flow_id: instance.flow_id,
        step_id: step.id,
        template_id: step.template_id,
        step_order: step.step_order,
        status: sentStatus,
        processed_at: runProcessedAt,
        error_message: errorMsg,
        provider_message_id: providerId,
      });

      await advanceFlow(supabase, instance.id, instance.current_step_order);
      processedCount++;
    }

    return new Response(JSON.stringify({ ok: true, processedCount }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[process-onboarding-emails-scheduled] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function advanceFlow(supabase: any, instanceId: string, currentStepOrder: number) {
  const { data: instanceRow } = await supabase.from("user_onboarding_flows").select("flow_id").eq("id", instanceId).single();
  if (!instanceRow) return;

  const { data: nextStep } = await supabase
    .from("onboarding_email_steps")
    .select("step_order, wait_after_previous_hours")
    .eq("flow_id", instanceRow.flow_id)
    .gt("step_order", currentStepOrder)
    .eq("is_active", true)
    .order("step_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextStep) {
    const waitHours = Number(nextStep.wait_after_previous_hours || 0);
    const nextRunTime = new Date(Date.now() + waitHours * 60 * 60 * 1000);

    await supabase.from("user_onboarding_flows").update({
      current_step_order: nextStep.step_order,
      last_processed_at: new Date().toISOString(),
      next_run_at: nextRunTime.toISOString(),
    }).eq("id", instanceId);
  } else {
    await supabase.from("user_onboarding_flows").update({
      status: "completed",
      last_processed_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", instanceId);
  }
}
