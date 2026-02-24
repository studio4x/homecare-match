// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { 'x-client-info': 'supabase-edge-function' },
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { course_slug } = await req.json();
    if (!course_slug) {
      return new Response(JSON.stringify({ error: 'Missing course_slug' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Check if all lessons are completed
    const { data: modules, error: modulesError } = await supabaseClient
      .from('academy_modules')
      .select('id, academy_lessons(id)')
      .eq('course_slug', course_slug);

    if (modulesError) throw modulesError;
    
    const allLessonIds = modules?.flatMap(m => (m.academy_lessons || []).map((l: any) => l.id)) || [];
    if (allLessonIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Course not found or has no lessons' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: progress, error: progressError } = await supabaseClient
      .from('academy_progress')
      .select('lesson_id, status')
      .eq('user_id', user.id)
      .eq('course_slug', course_slug);

    if (progressError) throw progressError;

    const completedLessonIds = new Set(progress?.filter(p => p.status === 'completed').map(p => p.lesson_id));
    const allLessonsCompleted = allLessonIds.every(lessonId => completedLessonIds.has(lessonId));

    if (!allLessonsCompleted) {
      return new Response(JSON.stringify({ error: 'Not all lessons completed yet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Check for existing certificate
    const { data: existingCertificate } = await supabaseClient
      .from('certificates')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_slug', course_slug)
      .maybeSingle();

    if (existingCertificate) {
      return new Response(JSON.stringify({ certificate_id: existingCertificate.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Get course workload
    const { data: courseData } = await supabaseClient
      .from('academy_courses')
      .select('duration_minutes')
      .eq('slug', course_slug)
      .single();

    const workloadMinutes = courseData?.duration_minutes || 0;

    // 4. Insert new certificate with a readable code
    // Gera um código no formato HCM-XXXX-XXXX usando caracteres aleatórios
    const randomChars = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    const validationCode = `HCM-${randomChars()}-${randomChars()}`;
    
    const { data: newCertificate, error: insertError } = await supabaseClient
      .from('certificates')
      .insert({
        user_id: user.id,
        course_slug: course_slug,
        validation_code: validationCode,
        workload_minutes: workloadMinutes,
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ certificate_id: newCertificate.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});