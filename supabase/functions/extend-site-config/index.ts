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

    const sql = `
      -- Configuração do modo Stripe
      ALTER TABLE public.site_config 
        ADD COLUMN IF NOT EXISTS stripe_mode TEXT DEFAULT 'test',
        ADD COLUMN IF NOT EXISTS stripe_publishable_key_test TEXT,
        ADD COLUMN IF NOT EXISTS stripe_publishable_key_live TEXT;

      -- IDs de preço na tabela de planos
      ALTER TABLE public.plans 
        ADD COLUMN IF NOT EXISTS stripe_price_id_test TEXT,
        ADD COLUMN IF NOT EXISTS stripe_price_id_live TEXT;

      -- IDs de preço na tabela de cursos
      ALTER TABLE public.academy_courses
        ADD COLUMN IF NOT EXISTS stripe_price_id_test TEXT,
        ADD COLUMN IF NOT EXISTS stripe_price_id_live TEXT;

      -- Colunas de marketing
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS ga_measurement_id TEXT,
        ADD COLUMN IF NOT EXISTS ga_enabled BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS gtm_container_id TEXT,
        ADD COLUMN IF NOT EXISTS gtm_enabled BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS fb_pixel_id TEXT,
        ADD COLUMN IF NOT EXISTS fb_pixel_enabled BOOLEAN DEFAULT true;

      -- Colunas de controle de assinatura no perfil
      ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

      -- NOVAS COLUNAS PARA VÍDEOS DAS LANDING PAGES E ONBOARDING
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS video_url_professionals TEXT,
        ADD COLUMN IF NOT EXISTS video_url_companies TEXT,
        ADD COLUMN IF NOT EXISTS video_url_families TEXT,
        ADD COLUMN IF NOT EXISTS video_url_onboarding TEXT,
        ADD COLUMN IF NOT EXISTS video_url_onboarding_company TEXT,
        ADD COLUMN IF NOT EXISTS video_url_onboarding_family TEXT;

      -- CONTROLE DE ONBOARDING NO PERFIL
      ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS has_seen_onboarding BOOLEAN DEFAULT false;
        
      -- Notifica o PostgREST para recarregar o esquema (Schema Cache)
      NOTIFY pgrst, 'reload schema';
    `;
    await client.queryObject(sql);

    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    try { await client?.end(); } catch {}
    return new Response(JSON.stringify({ error: "Failed to extend schema", details: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});