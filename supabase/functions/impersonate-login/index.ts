import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://rkjvtnadqkbwomgzyswr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[impersonate-login] Request received");

  // Autenticação manual (token do admin)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("[impersonate-login] Missing Authorization");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: adminUser, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !adminUser?.user) {
    console.error("[impersonate-login] Invalid token", userErr);
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verifica se quem chamou é admin
  const { data: profile, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id,is_admin,role")
    .eq("id", adminUser.user.id)
    .single();

  if (profErr || !profile?.is_admin) {
    console.error("[impersonate-login] Forbidden - not admin", profErr);
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Body com o usuário alvo
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const targetUserId = body?.targetUserId;
  if (!targetUserId) {
    return new Response(JSON.stringify({ error: "Missing targetUserId" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Busca e-mail do usuário alvo
  const { data: targetProfile, error: targetErr } = await supabaseAdmin
    .from("profiles")
    .select("id,email")
    .eq("id", targetUserId)
    .single();

  if (targetErr || !targetProfile?.email) {
    console.error("[impersonate-login] Target user not found or missing email", targetErr);
    return new Response(JSON.stringify({ error: "Target user not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Gera magic link para login do usuário alvo
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: targetProfile.email,
    // redirectTo pode usar a Site URL configurada no Supabase; omitimos para usar padrão do projeto
  });

  if (linkErr || !linkData?.action_link) {
    console.error("[impersonate-login] Failed to generate link", linkErr);
    return new Response(JSON.stringify({ error: "Failed to generate link" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[impersonate-login] Link generated");
  return new Response(JSON.stringify({ action_link: linkData.action_link }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});