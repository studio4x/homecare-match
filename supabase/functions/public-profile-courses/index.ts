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

  try {
    const body = await req.json();
    const userId = body?.userId as string;
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[public-profile-courses] Buscando conquistas para o usuário: \${userId}`);

    // Buscamos diretamente na tabela de certificados, que é a prova real de conclusão
    const { data: certs, error: certErr } = await supabaseAdmin
      .from("certificates")
      .select(`
        course_slug,
        workload_minutes,
        course:academy_courses (
          slug,
          title,
          hero_asset_url,
          duration_minutes
        )
      `)
      .eq("user_id", userId);

    if (certErr) {
      console.error("[public-profile-courses] Erro ao buscar certificados:", certErr);
      throw certErr;
    }

    // Formatamos o retorno para o componente de Perfil
    const results = (certs || []).map((c: any) => ({
      slug: c.course?.slug || c.course_slug,
      title: c.course?.title || "Curso não identificado",
      hero_asset_url: c.course?.hero_asset_url || null,
      workload_minutes: c.workload_minutes || c.course?.duration_minutes || 0,
    }));

    return new Response(JSON.stringify({ courses: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[public-profile-courses] Erro crítico:", e.message);
    return new Response(JSON.stringify({ error: "Unexpected error", details: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});