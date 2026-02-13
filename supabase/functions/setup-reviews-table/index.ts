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
    console.log("[setup-sync] Iniciando sincronização de permissões...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    await client.queryObject(`
      -- Garante que as tabelas existam
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

      ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;

      -- Remove políticas antigas para evitar conflitos e recria com permissão total para Admin
      DROP POLICY IF EXISTS "academy_enrollments_admin_select" ON public.academy_enrollments;
      CREATE POLICY "academy_enrollments_admin_select" ON public.academy_enrollments 
      FOR SELECT TO authenticated USING (check_is_admin());

      DROP POLICY IF EXISTS "academy_progress_admin_select" ON public.academy_progress;
      CREATE POLICY "academy_progress_admin_select" ON public.academy_progress 
      FOR SELECT TO authenticated USING (check_is_admin());

      -- Permissão para o próprio usuário ver suas matrículas (caso não exista)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'academy_enrollments_self_select') THEN
          CREATE POLICY "academy_enrollments_self_select" ON public.academy_enrollments 
          FOR SELECT TO authenticated USING (auth.uid() = user_id);
        END IF;
      END
      $$;
    `);

    await client.end();
    return new Response(JSON.stringify({ ok: true, message: "Permissões de administrador sincronizadas!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});