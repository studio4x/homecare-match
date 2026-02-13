import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let client: Client | null = null;
  try {
    console.log("[setup-sync] Iniciando sincronização profunda...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    // 1. Tabelas base e extensões
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS public.academy_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, course_slug)
      );

      CREATE TABLE IF NOT EXISTS public.academy_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
        lesson_id UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'in-progress',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, lesson_id)
      );

      CREATE TABLE IF NOT EXISTS public.reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (reviewer_id, subject_id)
      );

      CREATE TABLE IF NOT EXISTS public.suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. RLS e Policies
    await client.queryObject(`
      ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
        -- Policies para Reports
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reports_insert_policy') THEN
          CREATE POLICY "reports_insert_policy" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reports_admin_select') THEN
          CREATE POLICY "reports_admin_select" ON public.reports FOR SELECT TO authenticated USING (check_is_admin());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reports_admin_all') THEN
          CREATE POLICY "reports_admin_all" ON public.reports FOR ALL TO authenticated USING (check_is_admin());
        END IF;

        -- Policies para Academy (Admin)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academy_enrollments_admin_select') THEN
          CREATE POLICY "academy_enrollments_admin_select" ON public.academy_enrollments FOR SELECT TO authenticated USING (check_is_admin());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academy_progress_admin_select') THEN
          CREATE POLICY "academy_progress_admin_select" ON public.academy_progress FOR SELECT TO authenticated USING (check_is_admin());
        END IF;
      END
      $$;
    `);

    await client.end();
    return new Response(JSON.stringify({ ok: true, message: "Sincronização concluída com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[setup-sync] Erro crítico:", e);
    if (client) {
      try { await client.end(); } catch (err) { console.error("[setup-sync] Erro ao fechar cliente:", err); }
    }
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});