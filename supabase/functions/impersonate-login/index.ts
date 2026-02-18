import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

    const authHeader = req.headers.get("Authorization");
    const token = authHeader.replace("Bearer ", "");
    const { data: adminUser } = await supabaseAdmin.auth.getUser(token);
    
    const { data: profile } = await supabaseAdmin.from("profiles").select("id, is_admin, role").eq("id", adminUser.user.id).single();
    if (!(profile?.is_admin || profile?.role === "admin")) return new Response("Forbidden", { status: 403, headers: corsHeaders });

    const { targetUserId } = await req.json();
    const { data: targetProfile } = await supabaseAdmin.from("profiles").select("email, full_name").eq("id", targetUserId).single();

    // REGISTRO DE AUDITORIA
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminUser.user.id,
      action_type: 'IMPERSONATION_START',
      target_id: targetUserId,
      details: `Iniciou acesso como: \${targetProfile?.full_name} (\${targetProfile?.email})`
    });

    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: targetProfile.email });
    const action_link = (linkData as any).action_link || (linkData as any).properties?.action_link;

    return new Response(JSON.stringify({ action_link }), { status: 200, headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});