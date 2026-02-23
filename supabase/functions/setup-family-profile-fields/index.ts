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
      ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS patient_name TEXT,
        ADD COLUMN IF NOT EXISTS patient_age INTEGER,
        ADD COLUMN IF NOT EXISTS patient_medical_conditions TEXT,
        ADD COLUMN IF NOT EXISTS patient_mobility_level TEXT[],
        ADD COLUMN IF NOT EXISTS patient_cognitive_state TEXT[],
        ADD COLUMN IF NOT EXISTS patient_special_equipment TEXT[],
        ADD COLUMN IF NOT EXISTS patient_communication_skills TEXT[];

      NOTIFY pgrst, 'reload schema';
    `;
    await client.queryObject(sql);

    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Campos de perfil da família configurados!" }), {
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