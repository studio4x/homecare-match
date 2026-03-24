import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail } from "../_shared/email-provider.ts";
import { evaluateOnboardingCondition, getProfessionalProfileCompletion } from "../_shared/onboarding-conditions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { SITE_URL, replacePlaceholders, wrapLayout } from "../_shared/onboarding-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("authorization")?.replace("Bearer ", "").trim() || "";

  // Require service role internally
  if (!serviceRoleKey || authHeader !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Nao autorizado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[process-onboarding-emails] Iniciando processamento...");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 0. Check Global System Status
    const { data: globalSettings, error: settingsError } = await supabase
      .from("onboarding_system_settings")
      .select("setting_value")
      .eq("setting_key", "is_system_active")
      .maybeSingle();

    if (settingsError) {
       console.warn("[process-onboarding-emails] Alerta: Erro ao buscar configuração global.", settingsError);
    }

    const isEnabled = (globalSettings?.setting_value as any)?.enabled === true;
    if (!isEnabled) {
      console.log("[process-onboarding-emails] Sistema de onboarding DESATIVADO globalmente.");
      return new Response(JSON.stringify({ message: "O motor de onboarding está desativado globalmente por configuração." }), { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 1. Fetch active instances where next_run_at <= now
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
      return new Response(JSON.stringify({ message: "Nenhum fluxo pendente para processar." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let processedCount = 0;

    // Process each flow instance
    for (const instance of flows) {
      if (!instance.onboarding_email_flows?.is_active) continue;

      // 2. Locate the current step
      const { data: step } = await supabase
        .from("onboarding_email_steps")
        .select(`
          id, flow_id, step_order, template_id, wait_after_previous_hours,
          send_type, condition_type, condition_config, is_active,
          email_templates (id, name, slug, subject, html_content, text_content)
        `)
        .eq("flow_id", instance.flow_id)
        .eq("step_order", instance.current_step_order)
        .eq("is_active", true)
        .single();

      if (!step) {
        // Se nao achar o passo atual, talvez o fluxo acabou ou configuracao está errada
        // Para manter o engine avancando, tentamos achar se existe o proximo
        const { data: nextStepExists } = await supabase
          .from("onboarding_email_steps")
          .select("id")
          .eq("flow_id", instance.flow_id)
          .gt("step_order", instance.current_step_order)
          .order("step_order", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextStepExists) {
          // just skip the current missing step
          await advanceFlow(supabase, instance.id, instance.current_step_order, 0);
        } else {
          // mark completed
          await supabase
            .from("user_onboarding_flows")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", instance.id);
        }
        continue;
      }

      // Check condition
      let shouldSend = true;
      if (step.send_type === "conditional" && step.condition_type) {
        shouldSend = await evaluateOnboardingCondition(supabase, instance.user_id, step.condition_type, step.condition_config);
      }

      const runProcessedAt = new Date().toISOString();
      let sentStatus = "skipped";
      let errorMsg = null;
      let providerId = null;

      if (shouldSend) {
        // Fetch user data for placeholders
        const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(instance.user_id);
        const userEmail = user?.email;

        if (userEmail) {
          // 3. Prepare Placeholders
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

          // Determine CTA URL based on template or step (simplified logic for Phase 2)
          let ctaUrl = vars.dashboard_url;
          const templateSlug = step.email_templates.slug;
          if (templateSlug.includes("complete-profile") || templateSlug.includes("profile-mistakes")) ctaUrl = vars.profile_url;
          if (templateSlug.includes("verify-email")) ctaUrl = vars.email_confirm_url;
          if (templateSlug.includes("validate-profile")) ctaUrl = vars.profile_url;
          if (templateSlug.includes("increase-visibility")) ctaUrl = vars.profile_url;
          if (templateSlug.includes("courses")) ctaUrl = vars.courses_url;
          if (templateSlug.includes("platform-opportunities")) ctaUrl = vars.search_url;
          
          vars.cta_url = ctaUrl;

          const rawHtml = step.email_templates.html_content || "";
          const rawText = step.email_templates.text_content || "";
          const rawSubject = step.email_templates.subject || "HomeCare Match";

          const processedContent = replacePlaceholders(rawHtml, vars);
          const finalHtml = wrapLayout(processedContent, SITE_URL).replace("{{cta_url}}", ctaUrl);
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

      // 4. Log the step run
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

      // Se falhou e quisermos retentar, precisariamos alterar a logica. 
      // Para Fase 1, o fluxo escorre sequencial.
      // 5. Advance to next step
      await advanceFlow(supabase, instance.id, instance.current_step_order, step.wait_after_previous_hours);
      processedCount++;
    }

    return new Response(JSON.stringify({ ok: true, processedCount }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[process-onboarding-emails] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function advanceFlow(supabase: createClient, instanceId: string, currentStepOrder: number, waitAfterCurrentStepHours: number) {
  // Find next step
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
    // calculate next_run_at: now + nextStep.wait_after_previous_hours
    // Observe: the prompt specifically asked: "mais wait_after_previous_hours do próximo passo"
    // Wait rule: "proximo passo deve ser agendado com base em processed_at do passo atual + wait_after_previous_hours do proximo passo."
    const nextRunTime = new Date(Date.now() + (nextStep.wait_after_previous_hours * 60 * 60 * 1000));
    
    await supabase.from("user_onboarding_flows").update({
      current_step_order: nextStep.step_order,
      last_processed_at: new Date().toISOString(),
      next_run_at: nextRunTime.toISOString()
    }).eq("id", instanceId);

  } else {
    // Flow completed
    await supabase.from("user_onboarding_flows").update({
      status: "completed",
      last_processed_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).eq("id", instanceId);
  }
}
