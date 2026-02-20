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
      CREATE TABLE IF NOT EXISTS public.feature_videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_key TEXT UNIQUE NOT NULL, -- e.g., 'busca-inteligente-de-profissionais'
        title TEXT NOT NULL, -- Redundant but good for display in admin
        video_url TEXT,
        video_storage_path TEXT,
        video_mime TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE public.feature_videos ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access to feature videos') THEN
          CREATE POLICY "Public read access to feature videos" ON public.feature_videos
          FOR SELECT USING (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage feature videos') THEN
          CREATE POLICY "Admins can manage feature videos" ON public.feature_videos
          FOR ALL TO authenticated USING (check_is_admin()) WITH CHECK (check_is_admin());
        END IF;
      END
      $$;

      NOTIFY pgrst, 'reload schema';
    `;
    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Tabela de vídeos de funcionalidades configurada!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});