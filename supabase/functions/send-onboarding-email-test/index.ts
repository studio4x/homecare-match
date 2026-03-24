// supabase/functions/send-onboarding-email-test/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail } from "../_shared/email-provider.ts";
import { SITE_URL, replacePlaceholders, wrapLayout } from "../_shared/onboarding-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { templateId, testEmail } = await req.json();

    if (!templateId || !testEmail) {
      return new Response(JSON.stringify({ error: "templateId e testEmail são obrigatórios." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Fetch Template
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      return new Response(JSON.stringify({ error: "Template não encontrado." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Prepare Placeholder Variables (Dummy data for test)
    const vars = {
      full_name: "Administrador Teste",
      first_name: "Administrador",
      verification_status: "verified",
      profile_completion: "85%",
      dashboard_url: `${SITE_URL}/dashboard`,
      profile_url: `${SITE_URL}/dashboard/perfil`,
      courses_url: `${SITE_URL}/dashboard/cursos`,
      search_url: `${SITE_URL}/buscar`,
      email_confirm_url: `${SITE_URL}/email-confirmed`,
    };

    // Determine CTA URL
    let ctaUrl = vars.dashboard_url;
    const templateSlug = template.slug || "";
    if (templateSlug.includes("complete-profile") || templateSlug.includes("profile-mistakes")) ctaUrl = vars.profile_url;
    if (templateSlug.includes("verify-email")) ctaUrl = vars.email_confirm_url;
    if (templateSlug.includes("validate-profile")) ctaUrl = vars.profile_url;
    if (templateSlug.includes("increase-visibility")) ctaUrl = vars.profile_url;
    if (templateSlug.includes("courses")) ctaUrl = vars.courses_url;
    if (templateSlug.includes("platform-opportunities")) ctaUrl = vars.search_url;
    
    vars.cta_url = ctaUrl;

    const rawHtml = template.html_content || "";
    const rawText = template.text_content || "";
    const rawSubject = template.subject || "Teste de Template";

    const processedContent = replacePlaceholders(rawHtml, vars);
    const finalHtml = wrapLayout(processedContent, SITE_URL).replace("{{cta_url}}", ctaUrl);
    const finalSubject = `[TESTE] ${replacePlaceholders(rawSubject, vars)}`;
    const finalText = replacePlaceholders(rawText, vars);

    // 3. Send Email
    const { success, error } = await sendEmail({
      to: testEmail,
      subject: finalSubject,
      html: finalHtml,
      text: finalText,
    });

    if (!success) {
      return new Response(JSON.stringify({ error: error || "Erro ao enviar e-mail de teste." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, message: `E-mail de teste enviado para ${testEmail}` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[send-onboarding-email-test] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
