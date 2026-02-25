import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const requiredFamilyColumns = [
  "patient_name",
  "patient_age",
  "patient_medical_conditions",
  "patient_mobility_level",
  "patient_cognitive_state",
  "patient_special_equipment",
  "patient_communication_skills",
  "patient_document_url",
  "patient_address_proof_url",
];

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
        ADD COLUMN IF NOT EXISTS patient_communication_skills TEXT[],
        ADD COLUMN IF NOT EXISTS patient_document_url TEXT,
        ADD COLUMN IF NOT EXISTS patient_address_proof_url TEXT;

      NOTIFY pgrst, 'reload schema';
    `;
    await client.queryObject(sql);

    const columnsResult = await client.queryObject<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
    `);
    const existingColumns = new Set(columnsResult.rows.map((row) => row.column_name));
    const missingColumns = requiredFamilyColumns.filter((column) => !existingColumns.has(column));

    if (missingColumns.length > 0) {
      await client.end();
      client = null;

      return new Response(
        JSON.stringify({
          error: "Family profile fields are still missing after setup",
          missing_columns: missingColumns,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await client.end();
    client = null;

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Campos de perfil da familia configurados!",
        ensured_columns: requiredFamilyColumns,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    try { await client?.end(); } catch {}
    return new Response(JSON.stringify({ error: "Failed to extend schema", details: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
