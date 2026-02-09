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
    
    // 1. Adiciona coluna de status na tabela de interações
    const addStatusSql = `
      ALTER TABLE public.interactions 
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    `;
    await client.queryObject(addStatusSql);

    // 2. Garante permissão de UPDATE em interactions
    const updatePolicySql = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'interactions' AND policyname = 'interactions_update_policy') THEN
          CREATE POLICY "interactions_update_policy" ON public.interactions
          FOR UPDATE TO authenticated
          USING ((auth.uid() = sender_id) OR (auth.uid() = professional_id))
          WITH CHECK ((auth.uid() = sender_id) OR (auth.uid() = professional_id));
        END IF;
      END
      $$;
    `;
    await client.queryObject(updatePolicySql);

    // 3. Tabela de Reviews
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

      DO $$
      BEGIN
        -- Qualquer um pode ler reviews
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reviews_read_policy') THEN
          CREATE POLICY "reviews_read_policy" ON public.reviews FOR SELECT USING (true);
        END IF;
        
        -- Apenas o autor pode criar
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reviews_insert_policy') THEN
          CREATE POLICY "reviews_insert_policy" ON public.reviews 
          FOR INSERT TO authenticated 
          WITH CHECK (auth.uid() = reviewer_id);
        END IF;
      END
      $$;
    `;
    await client.queryObject(createReviewsSql);

    // 4. CRUCIAL: Permitir ver nome/foto de quem fez review (Empresas/Famílias são privadas por padrão)
    const visibilityPolicySql = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_reviewer_visibility') THEN
          CREATE POLICY "profiles_reviewer_visibility" ON public.profiles
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM public.reviews 
              WHERE reviews.reviewer_id = profiles.id
            )
          );
        END IF;
      END
      $$;
    `;
    await client.queryObject(visibilityPolicySql);

    await client.end();
    return new Response(JSON.stringify({ ok: true, message: "Banco de dados atualizado e permissões de visibilidade aplicadas!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[setup-reviews] Erro:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});