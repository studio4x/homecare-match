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
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    console.log("[setup-reviews-table] Iniciando sincronização profunda...");

    // 1. Criar tabelas base se não existirem
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS public.academy_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.academy_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
        lesson_id UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'in-progress',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Adicionar restrições de unicidade (Obrigatório para o UPSERT funcionar)
    await client.queryObject(`
      DO $$
      BEGIN
        -- Unicidade para Inscrições
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academy_enrollments_user_course_unique') THEN
          ALTER TABLE public.academy_enrollments ADD CONSTRAINT academy_enrollments_user_course_unique UNIQUE (user_id, course_slug);
        END IF;

        -- Unicidade para Progresso (Corrige o erro 42P10)
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academy_progress_user_lesson_unique') THEN
          ALTER TABLE public.academy_progress ADD CONSTRAINT academy_progress_user_lesson_unique UNIQUE (user_id, lesson_id);
        END IF;
      END
      $$;
    `);

    // 3. Colunas Adicionais e Tabelas de Apoio
    await client.queryObject(`
      ALTER TABLE public.academy_lessons ADD COLUMN IF NOT EXISTS content TEXT;
      ALTER TABLE public.academy_lessons ADD COLUMN IF NOT EXISTS storage_path TEXT;
      ALTER TABLE public.academy_lessons ADD COLUMN IF NOT EXISTS mime_type TEXT;
      ALTER TABLE public.academy_courses ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
      ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

      CREATE TABLE IF NOT EXISTS public.reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (reviewer_id, subject_id)
      );

      CREATE TABLE IF NOT EXISTS public.certificates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
        issued_at TIMESTAMPTZ DEFAULT NOW(),
        validation_code TEXT UNIQUE NOT NULL,
        workload_minutes INTEGER DEFAULT 0,
        UNIQUE (user_id, course_slug)
      );
    `);

    // 4. RLS e Policies
    await client.queryObject(`
      ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academy_enrollments_owner') THEN
          CREATE POLICY "academy_enrollments_owner" ON public.academy_enrollments FOR ALL TO authenticated USING (auth.uid() = user_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academy_progress_owner') THEN
          CREATE POLICY "academy_progress_owner" ON public.academy_progress FOR ALL TO authenticated USING (auth.uid() = user_id);
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
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});