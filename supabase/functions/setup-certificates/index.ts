import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let client: Client | null = null;
  try {
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
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

      DO $$
      BEGIN
        -- Qualquer um pode ler um certificado (para validação pública)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'certificates_public_read') THEN
          CREATE POLICY "certificates_public_read" ON public.certificates FOR SELECT USING (true);
        END IF;
        
        -- Apenas o usuário dono pode inserir (ao completar o curso)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'certificates_insert_owner') THEN
          CREATE POLICY "certificates_insert_owner" ON public.certificates 
          FOR INSERT TO authenticated 
          WITH CHECK (auth.uid() = user_id);
        END IF;
      END
      $$;
    `;
    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Tabela de certificados configurada!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});