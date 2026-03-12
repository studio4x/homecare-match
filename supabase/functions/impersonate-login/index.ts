import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const siteUrl = Deno.env.get("SITE_URL") || "https://www.homecarematch.com.br";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuração do Supabase incompleta na função." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Token de autenticação ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token de autenticação inválido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminUser } = await supabaseAdmin.auth.getUser(token);
    if (!adminUser?.user?.id) {
      return new Response(JSON.stringify({ error: "Sessão do administrador inválida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin.from("profiles").select("id, is_admin, role").eq("id", adminUser.user.id).single();
    if (!(profile?.is_admin || profile?.role === "admin")) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId || typeof targetUserId !== "string") {
      return new Response(JSON.stringify({ error: "targetUserId inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetProfileError) {
      return new Response(JSON.stringify({ error: `Falha ao buscar perfil de destino: ${targetProfileError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetEmail = String(targetProfile?.email || "").trim();
    if (!targetEmail) {
      const { data: targetAuthUser, error: targetAuthUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (targetAuthUserError) {
        return new Response(JSON.stringify({ error: `Falha ao buscar usuário de autenticação: ${targetAuthUserError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetEmail = String(targetAuthUser?.user?.email || "").trim();
    }

    if (!targetEmail) {
      return new Response(JSON.stringify({ error: "Usuário de destino sem e-mail válido para impersonação." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Registro de auditoria não deve bloquear a impersonação.
    try {
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: adminUser.user.id,
        action_type: "IMPERSONATION_START",
        target_id: targetUserId,
        details: `Iniciou acesso como: ${targetProfile?.full_name || "Usuário"} (${targetEmail})`,
      });
    } catch (auditError) {
      console.warn("[impersonate-login] Falha ao registrar auditoria:", auditError);
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: {
        redirectTo: `${siteUrl}/dashboard`,
      },
    });

    if (linkError) {
      return new Response(JSON.stringify({ error: `Falha ao gerar link de acesso: ${linkError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const action_link = (linkData as any).action_link || (linkData as any).properties?.action_link;
    if (!action_link) {
      return new Response(JSON.stringify({ error: "Link de acesso não retornado pelo Supabase Auth." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ action_link }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Erro inesperado na impersonação." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
