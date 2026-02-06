import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://rkjvtnadqkbwomgzyswr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJranZ0bmFkcWtid29tZ3p5c3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjI3NTAsImV4cCI6MjA4NTYzODc1MH0.Xc1l3rYeR3zs-9ZRsAtvYDrhnXHvyydf6VmpCoLNeFI";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[academy-migrate] Request received");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("[academy-migrate] Missing Authorization header");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    console.error("[academy-migrate] Invalid token", { userErr });
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Check admin
  const { data: profile, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id,is_admin,role")
    .eq("id", userData.user.id)
    .single();

  if (profErr || !profile?.is_admin) {
    console.error("[academy-migrate] Not admin", { profErr });
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    console.error("[academy-migrate] Invalid JSON body", e);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const action = body.action;

  if (action === "create_tables") {
    console.log("[academy-migrate] Creating tables with RLS");
    const client = new Client(SUPABASE_DB_URL);
    try {
      await client.connect();

      const sql = `
      CREATE TABLE IF NOT EXISTS public.academy_courses (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        level TEXT,
        duration_minutes INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        hero_asset_url TEXT,
        content_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.academy_modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        position INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS public.academy_lessons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module_id UUID NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        duration_minutes INTEGER,
        resource_url TEXT,
        position INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS public.academy_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, course_slug)
      );

      CREATE TABLE IF NOT EXISTS public.academy_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
        lesson_id UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;

      -- Public read for courses/modules/lessons
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_courses' AND policyname = 'academy_courses_public_select') THEN
          CREATE POLICY "academy_courses_public_select" ON public.academy_courses FOR SELECT USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_modules' AND policyname = 'academy_modules_public_select') THEN
          CREATE POLICY "academy_modules_public_select" ON public.academy_modules FOR SELECT USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_lessons' AND policyname = 'academy_lessons_public_select') THEN
          CREATE POLICY "academy_lessons_public_select" ON public.academy_lessons FOR SELECT USING (true);
        END IF;
      END
      $$;

      -- Admin-only write access
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_courses' AND policyname = 'academy_courses_admin_write') THEN
          CREATE POLICY "academy_courses_admin_write" ON public.academy_courses FOR ALL TO authenticated USING (check_is_admin()) WITH CHECK (check_is_admin());
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_modules' AND policyname = 'academy_modules_admin_write') THEN
          CREATE POLICY "academy_modules_admin_write" ON public.academy_modules FOR ALL TO authenticated USING (check_is_admin()) WITH CHECK (check_is_admin());
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_lessons' AND policyname = 'academy_lessons_admin_write') THEN
          CREATE POLICY "academy_lessons_admin_write" ON public.academy_lessons FOR ALL TO authenticated USING (check_is_admin()) WITH CHECK (check_is_admin());
        END IF;
      END
      $$;

      -- Enrollment & progress (user-specific)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_enrollments' AND policyname = 'academy_enrollments_select') THEN
          CREATE POLICY "academy_enrollments_select" ON public.academy_enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_enrollments' AND policyname = 'academy_enrollments_insert') THEN
          CREATE POLICY "academy_enrollments_insert" ON public.academy_enrollments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_enrollments' AND policyname = 'academy_enrollments_delete') THEN
          CREATE POLICY "academy_enrollments_delete" ON public.academy_enrollments FOR DELETE TO authenticated USING (auth.uid() = user_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_progress' AND policyname = 'academy_progress_select') THEN
          CREATE POLICY "academy_progress_select" ON public.academy_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_progress' AND policyname = 'academy_progress_insert') THEN
          CREATE POLICY "academy_progress_insert" ON public.academy_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_progress' AND policyname = 'academy_progress_update') THEN
          CREATE POLICY "academy_progress_update" ON public.academy_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_progress' AND policyname = 'academy_progress_delete') THEN
          CREATE POLICY "academy_progress_delete" ON public.academy_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
        END IF;
      END
      $$;
      `;

      await client.queryObject(sql);
      await client.end();
      console.log("[academy-migrate] Tables and RLS created");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("[academy-migrate] Error creating tables", e);
      try {
        await client.end();
      } catch {}
      return new Response(JSON.stringify({ error: "Create tables failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  if (action === "migrate_from_storage") {
    console.log("[academy-migrate] Migrating from storage");
    try {
      const { data: file, error: downloadErr } = await supabaseAdmin.storage.from("uploads").download("academy/courses.json");
      if (downloadErr || !file) {
        console.error("[academy-migrate] Download error", downloadErr);
        return new Response(JSON.stringify({ error: "No storage data" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const text = await file.text();
      const parsed = JSON.parse(text) as any[];
      const courses = Array.isArray(parsed) ? parsed : [];

      // Upsert courses
      for (const c of courses) {
        const coursePayload = {
          slug: c.slug,
          title: c.title,
          description: c.description,
          level: c.level,
          duration_minutes: c.duration_minutes,
          is_active: c.is_active ?? true,
          hero_asset_url: c.hero_asset_url,
          content_url: c.content_url,
          created_at: c.created_at || new Date().toISOString(),
        };
        const { error: upsertCourseErr } = await supabaseAdmin.from("academy_courses").upsert(coursePayload);
        if (upsertCourseErr) console.error("[academy-migrate] Upsert course error", upsertCourseErr);

        const modules = Array.isArray(c.modules) ? c.modules : [];
        for (const m of modules) {
          const modulePayload = {
            id: m.id,
            course_slug: c.slug,
            title: m.title,
            description: m.description,
            position: m.position ?? 1,
          };
          const { error: upsertModuleErr } = await supabaseAdmin.from("academy_modules").upsert(modulePayload);
          if (upsertModuleErr) console.error("[academy-migrate] Upsert module error", upsertModuleErr);

          const lessons = Array.isArray(m.lessons) ? m.lessons : [];
          for (const l of lessons) {
            const lessonPayload = {
              id: l.id,
              module_id: m.id,
              title: l.title,
              type: l.type,
              duration_minutes: l.duration_minutes,
              resource_url: l.resource_url,
              position: l.position ?? 1,
            };
            const { error: upsertLessonErr } = await supabaseAdmin.from("academy_lessons").upsert(lessonPayload);
            if (upsertLessonErr) console.error("[academy-migrate] Upsert lesson error", upsertLessonErr);
          }
        }
      }

      console.log("[academy-migrate] Migration completed");
      return new Response(JSON.stringify({ ok: true, count: courses.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      console.error("[academy-migrate] Migration error", e);
      return new Response(JSON.stringify({ error: "Migration failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  console.warn("[academy-migrate] Unknown action", action);
  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});