import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://rkjvtnadqkbomgzyswr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    
    // Validar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response('Invalid token', { status: 401, headers: corsHeaders });

    const { course_slug } = await req.json();
    if (!course_slug) return new Response('Missing course_slug', { status: 400, headers: corsHeaders });

    console.log("[issue-certificate] Iniciando verificação para " + user.id + " no curso " + course_slug);

    // 1. Buscar todas as aulas do curso
    const { data: modules } = await supabaseAdmin.from('academy_modules').select('id').eq('course_slug', course_slug);
    const moduleIds = (modules || []).map(m => m.id);
    
    if (moduleIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Course has no content' }), { status: 400, headers: corsHeaders });
    }

    const { data: lessons } = await supabaseAdmin.from('academy_lessons').select('id, duration_minutes').in('module_id', moduleIds);
    const totalLessons = lessons?.length || 0;
    const totalWorkload = lessons?.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0) || 0;

    if (totalLessons === 0) {
      return new Response(JSON.stringify({ error: 'Course has no lessons' }), { status: 400, headers: corsHeaders });
    }

    // 2. Buscar progresso do usuário
    const { count: completedCount } = await supabaseAdmin
      .from('academy_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('course_slug', course_slug)
      .eq('status', 'completed');

    if (!completedCount || completedCount < totalLessons) {
      return new Response(JSON.stringify({ 
        error: 'Course not completed yet', 
        current: completedCount || 0, 
        total: totalLessons 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 3. Gerar código de validação único (usando concatenação para segurança)
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    const timePart = Date.now().toString(36).toUpperCase();
    const validationCode = "HCM-" + randomPart + "-" + timePart;

    // 4. Inserir certificado (UPSERT para evitar duplicados)
    const { data: cert, error: certError } = await supabaseAdmin
      .from('certificates')
      .upsert({
        user_id: user.id,
        course_slug: course_slug,
        validation_code: validationCode,
        workload_minutes: totalWorkload,
        issued_at: new Date().toISOString()
      }, { onConflict: 'user_id,course_slug' })
      .select('id')
      .single();

    if (certError) throw certError;

    return new Response(JSON.stringify({ success: true, certificate_id: cert.id }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("[issue-certificate] Erro crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});