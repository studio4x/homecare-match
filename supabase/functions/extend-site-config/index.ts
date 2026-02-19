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
      -- Colunas de geolocalização
      ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS lat NUMERIC,
        ADD COLUMN IF NOT EXISTS lng NUMERIC;

      -- Coluna para cache de indicações
      ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

      -- Coluna para Chave de API do Google Maps (Lado do Cliente)
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS google_maps_api_key TEXT;

      -- Coluna para Modelo do Gemini
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS gemini_model TEXT DEFAULT 'gemini-1.5-flash';

      -- Coluna para Configurações de Layout do Push com todos os campos necessários
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS push_layout_json JSONB DEFAULT '{"bgColor": "#ffffff", "titleColor": "#0f172a", "bodyColor": "#64748b", "borderRadius": "32", "iconBgColor": "#007BFF1a", "iconColor": "#007BFF", "shadowIntensity": "0.25", "ctaBgColor": "#007BFF", "ctaTextColor": "#ffffff", "backdropColor": "rgba(0,0,0,0.05)", "duration": 15}'::jsonb;

      -- Notifica o PostgREST para recarregar o esquema
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