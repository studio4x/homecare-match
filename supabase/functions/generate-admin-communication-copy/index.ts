import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const cleanJsonText = (text: string) =>
  String(text || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

const getTokenFromRequest = async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.replace("Bearer ", "").trim() || "";

  let bodyToken = "";
  try {
    const body = await req.clone().json();
    bodyToken = typeof body?.access_token === "string" ? body.access_token.trim() : "";
  } catch {
    bodyToken = "";
  }

  return bearerToken || bodyToken;
};

const callGeminiJson = async ({
  apiKey,
  modelName,
  prompt,
}: {
  apiKey: string;
  modelName: string;
  prompt: string;
}) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.55,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Falha ao chamar a API do Gemini.");
  }

  const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Resposta vazia da IA.");
  }

  return JSON.parse(cleanJsonText(rawText));
};

const formatAudienceContext = (context: Record<string, unknown>) => {
  const mode = String(context?.mode || "segment");
  if (mode === "individual") {
    return "Envio individual para um usuario ja selecionado no painel.";
  }

  const parts = [
    context?.role ? `perfil=${String(context.role)}` : "",
    context?.subscription_tier && context.subscription_tier !== "all"
      ? `plano=${String(context.subscription_tier)}`
      : "",
    context?.email_confirmed && context.email_confirmed !== "all"
      ? `email_confirmado=${String(context.email_confirmed)}`
      : "",
    context?.whatsapp_opt_in && context.whatsapp_opt_in !== "all"
      ? `whatsapp_opt_in=${String(context.whatsapp_opt_in)}`
      : "",
    context?.is_verified && context.is_verified !== "all"
      ? `verificado=${String(context.is_verified)}`
      : "",
    context?.is_hidden && context.is_hidden !== "all"
      ? `oculto=${String(context.is_hidden)}`
      : "",
  ].filter(Boolean);

  return parts.length > 0
    ? `Envio segmentado com filtros: ${parts.join(", ")}.`
    : "Envio segmentado sem filtros adicionais alem do que esta definido no painel.";
};

const formatExistingContentContext = (context: Record<string, unknown>) => {
  const emailSubject = String(context?.email_subject || "").trim();
  const emailText = String(context?.email_text || "").trim();
  const emailHtml = String(context?.email_html || "").trim();
  const whatsappMessage = String(context?.whatsapp_message || "").trim();
  const whatsappCtaPath = String(context?.whatsapp_cta_path || "").trim();

  return [
    emailSubject ? `assunto de email atual: ${emailSubject}` : "",
    emailText ? `texto alternativo atual do email: ${emailText}` : "",
    emailHtml ? `html atual do email informado no painel: ${emailHtml}` : "",
    whatsappMessage ? `mensagem atual de WhatsApp: ${whatsappMessage}` : "",
    whatsappCtaPath ? `cta/path de WhatsApp: ${whatsappCtaPath}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Ambiente Supabase nao configurado.");
    }

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY nao configurada no servidor.");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = await getTokenFromRequest(req);

    if (!token) {
      return new Response(JSON.stringify({ error: "Nao autorizado: token ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Nao autorizado: token invalido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: "Falha ao validar permissao de admin." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = Boolean(profile?.is_admin || profile?.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").trim();
    const context =
      body?.context && typeof body.context === "object" && !Array.isArray(body.context)
        ? (body.context as Record<string, unknown>)
        : {};
    const channel = String(body?.channel || "email").trim().toLowerCase();

    if (!prompt && channel !== "whatsapp") {
      return new Response(JSON.stringify({ error: "Informe o briefing da notificacao." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: config } = await supabaseAdmin
      .from("site_config")
      .select("gemini_model")
      .eq("id", 1)
      .maybeSingle();

    const modelName = String(config?.gemini_model || "gemini-2.0-flash").trim() || "gemini-2.0-flash";
    const audienceContext = formatAudienceContext(context);
    const internalName = String(context?.name || "").trim();
    const internalDescription = String(context?.description || "").trim();
    const existingContentContext = formatExistingContentContext(context);

    if (channel === "whatsapp") {
      const generationPrompt = `
Voce escreve notificacoes de WhatsApp em portugues do Brasil para a plataforma HomeCare Match.

Objetivo:
- gerar apenas a mensagem principal de WhatsApp para uma notificacao em massa no admin
- considerar todos os demais campos ja preenchidos no painel como contexto

Contexto do job:
- nome interno: ${internalName || "(nao informado)"}
- descricao interna: ${internalDescription || "(nao informada)"}
- audiencia: ${audienceContext}

Campos atuais do painel:
${existingContentContext || "(nenhum campo adicional preenchido)"}

Briefing do admin:
${prompt || "Use os campos preenchidos no painel como base principal para montar a mensagem de WhatsApp."}

Regras:
- responder em portugues do Brasil
- gerar somente o texto da mensagem principal, sem saudacao com variaveis dinamicas
- nao incluir o link final, porque o CTA/path ja sera tratado separadamente no fluxo
- nao usar markdown, aspas desnecessarias, emojis ou placeholders como {{nome}}
- manter tom claro, humano e objetivo
- a mensagem deve funcionar bem no template generico aprovado de WhatsApp
- priorizar algo curto a medio, normalmente entre 220 e 500 caracteres
- aproveitar o que ja existir nos outros campos para manter consistencia entre email e WhatsApp

Retorne apenas JSON valido:
{
  "whatsapp_message": "string"
}
`.trim();

      const generated = await callGeminiJson({
        apiKey: GEMINI_API_KEY,
        modelName,
        prompt: generationPrompt,
      });

      const whatsappMessage = String(generated?.whatsapp_message || "").trim();
      if (!whatsappMessage) {
        throw new Error("A IA nao retornou a mensagem de WhatsApp.");
      }

      return new Response(JSON.stringify({ whatsapp_message: whatsappMessage }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const generationPrompt = `
Voce escreve notificacoes em portugues do Brasil para a plataforma HomeCare Match.

Objetivo:
- gerar os campos de e-mail para uma notificacao em massa no admin
- responder com copy pronta para envio

Contexto do job:
- nome interno: ${internalName || "(nao informado)"}
- descricao interna: ${internalDescription || "(nao informada)"}
- audiencia: ${audienceContext}

Campos atuais do painel:
${existingContentContext || "(nenhum campo adicional preenchido)"}

Briefing do admin:
${prompt}

Regras:
- responder em portugues do Brasil
- assunto direto, profissional e claro, com no maximo 90 caracteres
- HTML limpo, pronto para enviar, sem markdown e sem bloco <html>, <head> ou <body>
- usar apenas tags simples e seguras, como <p>, <strong>, <ul>, <li>, <br> e <a>
- nao usar placeholders como {{nome}}, [Nome] ou variaveis dinamicas
- nao inventar cupons, valores, prazos ou promessas que nao estejam no briefing
- texto alternativo deve corresponder ao HTML e ser adequado para clientes sem renderizacao HTML
- evitar excesso de marketing; priorizar clareza

Retorne apenas JSON valido:
{
  "subject": "string",
  "html": "string",
  "text": "string"
}
`.trim();

    const generated = await callGeminiJson({
      apiKey: GEMINI_API_KEY,
      modelName,
      prompt: generationPrompt,
    });

    const subject = String(generated?.subject || "").trim();
    const html = String(generated?.html || "").trim();
    const text = String(generated?.text || "").trim();

    if (!subject || !html || !text) {
      throw new Error("A IA nao retornou todos os campos esperados.");
    }

    return new Response(JSON.stringify({ subject, html, text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-admin-communication-copy] erro:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro ao gerar notificacao com IA.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
