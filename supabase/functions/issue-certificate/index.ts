import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://rkjvtnadqkbwomgzyswr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const authHeader = req.headers.get('Authorization');
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));

    const body = await req.json();
    const course_slug = body.course_slug?.trim();
    
    const { data: course } = await supabaseAdmin.from('academy_courses').select('title').eq('slug', course_slug).single();
    
    const validationCode = `HCM-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const { data: cert, error: certError } = await supabaseAdmin
      .from('certificates')
      .upsert({
        user_id: user.id,
        course_slug: course_slug,
        validation_code: validationCode,
        issued_at: new Date().toISOString()
      }, { onConflict: 'user_id,course_slug' })
      .select('id')
      .single();

    if (certError) throw certError;

    await supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      title: "🎓 Curso Concluído!",
      content: `Parabéns! Você concluiu o curso "${course.title}" e seu selo de conquista já está disponível no seu perfil.`,
      link: `/certificado/${cert.id}`,
      type: 'success'
    });

    return new Response(JSON.stringify({ success: true, certificate_id: cert.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});