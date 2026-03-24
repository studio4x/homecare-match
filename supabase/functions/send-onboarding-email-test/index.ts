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
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Manual Auth Validation (Hardened Pattern from AGENTS.md)
    const authHeader = req.headers.get("Authorization");
    const body = await req.json().catch(() => ({}));
    const token = authHeader?.replace("Bearer ", "") || body.access_token;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token de autenticação ausente." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Check Admin Permissions
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores podem enviar testes." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Identify Recipient (Prefer fixed admin email from env)
    const adminTestEmail = Deno.env.get("ADMIN_TEST_EMAIL");
    const recipientEmail = adminTestEmail || body.testEmail;

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "E-mail de destino não definido (ADMIN_TEST_EMAIL ou testEmail)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { templateId } = body;
    if (!templateId) {
      return new Response(JSON.stringify({ error: "templateId é obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Fetch Template
    const { data: template, error: templateError } = await supabaseAdmin
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

    const rawHtml = template.html_content || "";
    const rawText = template.text_content || "";
    const rawSubject = template.subject || "Teste de Template";
    const rawCtaLabel = template.cta_label || "";
    let rawCtaUrl = template.cta_url || "";

    // Se a URL do CTA for um path relativo, prefixar com SITE_URL
    if (rawCtaUrl && rawCtaUrl.startsWith("/")) {
      rawCtaUrl = `${SITE_URL}${rawCtaUrl}`;
    }

    const processedContent = replacePlaceholders(rawHtml, vars);
    const finalHtml = wrapLayout(processedContent, SITE_URL, rawCtaLabel, rawCtaUrl);
    const finalSubject = `[TESTE] ${replacePlaceholders(rawSubject, vars)}`;
    const finalText = replacePlaceholders(rawText, vars);

    // 3. Send Email
    const { success, error } = await sendEmail({
      to: recipientEmail,
      subject: finalSubject,
      html: finalHtml,
      text: finalText,
    });

    if (!success) {
      return new Response(JSON.stringify({ error: error || "Erro ao enviar e-mail de teste." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, message: `E-mail de teste enviado para ${recipientEmail}` }), {
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
