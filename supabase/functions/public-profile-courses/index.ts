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

    // Enrollments for the professional
    const { data: enrolls, error: enrErr } = await supabaseAdmin
      .from("academy_enrollments")
      .select("course_slug")
      .eq("user_id", userId);

    if (enrErr) {
      return new Response(JSON.stringify({ error: "Enrollments error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slugs = (enrolls || []).map((e) => e.course_slug);
    const results: Array<{
      slug: string;
      title: string;
      hero_asset_url: string | null;
      workload_minutes: number;
    }> = [];

    for (const slug of slugs) {
      // Course data
      const { data: course, error: courseErr } = await supabaseAdmin
        .from("academy_courses")
        .select("slug,title,hero_asset_url,duration_minutes")
        .eq("slug", slug)
        .maybeSingle();

      if (courseErr || !course) continue;

      // Modules
      const { data: mods, error: modErr } = await supabaseAdmin
        .from("academy_modules")
        .select("id")
        .eq("course_slug", slug);

      if (modErr) continue;
      const moduleIds = (mods || []).map((m) => m.id);
      if (moduleIds.length === 0) continue;

      // Total lessons
      const { count: totalLessons } = await supabaseAdmin
        .from("academy_lessons")
        .select("id", { count: "exact", head: true })
        .in("module_id", moduleIds);

      // Completed lessons by user
      const { count: done } = await supabaseAdmin
        .from("academy_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("course_slug", slug)
        .eq("status", "completed");

      const completed = (totalLessons || 0) > 0 && (done || 0) >= (totalLessons || 0);
      if (!completed) continue;

      // Workload minutes: prefer course.duration_minutes, else sum lessons
      let workload = course.duration_minutes || 0;
      if (!workload) {
        const { data: lessons } = await supabaseAdmin
          .from("academy_lessons")
          .select("duration_minutes")
          .in("module_id", moduleIds);
        workload = (lessons || []).reduce((acc, cur) => acc + (cur.duration_minutes || 0), 0);
      }

      results.push({
        slug: course.slug,
        title: course.title,
        hero_asset_url: course.hero_asset_url || null,
        workload_minutes: workload || 0,
      });
    }

    return new Response(JSON.stringify({ courses: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});