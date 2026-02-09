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
    const body = await req.json().catch(() => ({}));
    const action = body?.action || "add_marketing_columns";

    if (action !== "add_marketing_columns") {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    client = new Client(SUPABASE_DB_URL);
    await client.connect();

    const sql = `
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS ga_measurement_id TEXT,
        ADD COLUMN IF NOT EXISTS ga_enabled BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS gtm_container_id TEXT,
        ADD COLUMN IF NOT EXISTS gtm_enabled BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS fb_pixel_id TEXT,
        ADD COLUMN IF NOT EXISTS fb_pixel_enabled BOOLEAN DEFAULT true;
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
    return new Response(JSON.stringify({ error: "Failed to extend site_config" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});