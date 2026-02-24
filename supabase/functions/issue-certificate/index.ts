import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { v4 as uuidv4 } from "https://deno.land/std@0.224.0/uuid/mod.ts";

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use SERVICE_ROLE_KEY for elevated permissions
      {
        global: {
          headers: { 'x-client-info': 'supabase-edge-function' },
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[issue-certificate] Missing Authorization header");
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("[issue-certificate] Authentication error:", authError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { course_slug } = await req.json();
    if (!course_slug) {
      console.error("[issue-certificate] Missing course_slug in request body");
      return new Response(JSON.stringify({ error: 'Missing course_slug' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[issue-certificate] Attempting to issue certificate for user ${user.id} and course ${course_slug}`);

    // 1. Check if all lessons are completed
    const { data: modules, error: modulesError } = await supabaseClient
      .from('academy_modules')
      .select('id, lessons(id)')
      .eq('course_slug', course_slug);

    if (modulesError) throw modulesError;
    if (!modules || modules.length === 0) {
      console.warn(`[issue-certificate] No modules found for course ${course_slug}`);
      return new Response(JSON.stringify({ error: 'Course not found or has no lessons' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allLessonIds = modules.flatMap(m => m.lessons.map((l: any) => l.id));
    if (allLessonIds.length === 0) {
      console.warn(`[issue-certificate] No lessons found for course ${course_slug}`);
      return new Response(JSON.stringify({ error: 'Course has no lessons' }), {
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
      console.warn(`[issue-certificate] User ${user.id} has not completed all lessons for course ${course_slug}`);
      return new Response(JSON.stringify({ error: 'Not all lessons completed yet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Check for existing certificate
    const { data: existingCertificate, error: existingCertError } = await supabaseClient
      .from('certificates')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_slug', course_slug)
      .maybeSingle();

    if (existingCertError) throw existingCertError;

    if (existingCertificate) {
      console.log(`[issue-certificate] Certificate already exists for user ${user.id} and course ${course_slug}: ${existingCertificate.id}`);
      return new Response(JSON.stringify({ certificate_id: existingCertificate.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Get course workload
    const { data: courseData, error: courseDataError } = await supabaseClient
      .from('academy_courses')
      .select('duration_minutes')
      .eq('slug', course_slug)
      .single();

    if (courseDataError) throw courseDataError;
    const workloadMinutes = courseData?.duration_minutes || 0;

    // 4. Insert new certificate
    const validationCode = uuidv4();
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

    console.log(`[issue-certificate] Successfully issued certificate ${newCertificate.id} for user ${user.id} and course ${course_slug}`);
    return new Response(JSON.stringify({ certificate_id: newCertificate.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[issue-certificate] General error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
