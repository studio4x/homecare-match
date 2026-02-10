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
    
    console.log("[setup-reviews-table] Iniciando sincronização completa...");

    // 1. ACADEMY: Colunas necessárias
    await client.queryObject(`ALTER TABLE public.academy_lessons ADD COLUMN IF NOT EXISTS content TEXT;`);
    await client.queryObject(`ALTER TABLE public.academy_lessons ADD COLUMN IF NOT EXISTS storage_path TEXT;`);
    await client.queryObject(`ALTER TABLE public.academy_lessons ADD COLUMN IF NOT EXISTS mime_type TEXT;`);
    await client.queryObject(`ALTER TABLE public.academy_courses ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;`);
    await client.queryObject(`ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';`);

    // 2. REVIEWS: Tabela de avaliações
    const createReviewsSql = `
      CREATE TABLE IF NOT EXISTS public.reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (reviewer_id, subject_id)
      );
      ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
    `;
    await client.queryObject(createReviewsSql);

    // 3. CERTIFICATES: Tabela de certificados
    const createCertsSql = `
      CREATE TABLE IF NOT EXISTS public.certificates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
        issued_at TIMESTAMPTZ DEFAULT NOW(),
        validation_code TEXT UNIQUE NOT NULL,
        workload_minutes INTEGER DEFAULT 0,
        UNIQUE (user_id, course_slug)
      );
      ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
    `;
    await client.queryObject(createCertsSql);

    // 4. POLICIES: Garantir permissões básicas
    const policiesSql = `
      DO $$
      BEGIN
        -- Interactions update
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'interactions_update_policy') THEN
          CREATE POLICY "interactions_update_policy" ON public.interactions FOR UPDATE TO authenticated USING ((auth.uid() = sender_id) OR (auth.uid() = professional_id));
        END IF;

        -- Reviews read/insert
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reviews_read_policy') THEN
          CREATE POLICY "reviews_read_policy" ON public.reviews FOR SELECT USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reviews_insert_policy') THEN
          CREATE POLICY "reviews_insert_policy" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
        END IF;

        -- Certificates read
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'certificates_public_read') THEN
          CREATE POLICY "certificates_public_read" ON public.certificates FOR SELECT USING (true);
        END IF;
      END
      $$;
    `;
    await client.queryObject(policiesSql);

    await client.end();
    return new Response(JSON.stringify({ ok: true, message: "Sincronização concluída!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[setup-sync] Erro:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});