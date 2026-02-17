import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Resposta imediata para o preflight do navegador
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[impersonate-login] Requisição recebida");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Configurações do servidor ausentes.");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Autenticação do chamador (Admin)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: adminUser, error: userErr } = await supabaseAdmin.auth.getUser(token);
    
    if (userErr || !adminUser?.user) {
      console.error("[impersonate-login] Token inválido", userErr);
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se o chamador é realmente um administrador no banco
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, is_admin, role")
      .eq("id", adminUser.user.id)
      .single();

    if (profErr || !(profile?.is_admin || profile?.role === "admin")) {
      console.error("[impersonate-login] Acesso negado - não é admin", profErr);
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Processa o corpo da requisição
    const body = await req.json().catch(() => ({}));
    const targetUserId = body?.targetUserId;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "ID do usuário alvo é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca o e-mail do usuário alvo
    const { data: targetProfile, error: targetErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("id", targetUserId)
      .single();

    if (targetErr || !targetProfile?.email) {
      console.error("[impersonate-login] Usuário alvo não encontrado", targetErr);
      return new Response(JSON.stringify({ error: "Usuário alvo não encontrado ou sem e-mail" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[impersonate-login] Gerando link para: \${targetProfile.email}`);

    // Gera o link de login (recovery) para o usuário alvo
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: targetProfile.email
    });

    if (linkErr || !linkData) {
      console.error("[impersonate-login] Falha ao gerar link", linkErr);
      throw new Error("Falha ao gerar link de acesso.");
    }

    const action_link = (linkData as any).action_link || (linkData as any).properties?.action_link;

    return new Response(JSON.stringify({ action_link }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[impersonate-login] Erro crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});