import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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
      CREATE TABLE IF NOT EXISTS public.company_patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        patient_name TEXT NOT NULL,
        patient_age INTEGER,
        patient_medical_conditions TEXT,
        patient_mobility_level TEXT[],
        patient_cognitive_state TEXT[],
        patient_special_equipment TEXT[],
        patient_communication_skills TEXT[],
        is_visible BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE public.company_patients ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
        -- Companies can manage their own patients
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Companies can manage their own patients') THEN
          CREATE POLICY "Companies can manage their own patients" ON public.company_patients
          FOR ALL TO authenticated
          USING (auth.uid() = company_id)
          WITH CHECK (auth.uid() = company_id);
        END IF;

        -- Authenticated users can view visible patients of companies they interacted with
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view visible company patients') THEN
          CREATE POLICY "Authenticated users can view visible company patients" ON public.company_patients
          FOR SELECT TO authenticated
          USING (
            is_visible = TRUE
            AND EXISTS (
              SELECT 1 FROM public.interactions i
              WHERE (i.sender_id = auth.uid() AND i.professional_id = company_patients.company_id)
                 OR (i.professional_id = auth.uid() AND i.sender_id = company_patients.company_id)
            )
          );
        END IF;

        -- Admins can view all patients
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all company patients') THEN
          CREATE POLICY "Admins can view all company patients" ON public.company_patients
          FOR SELECT TO authenticated
          USING (check_is_admin());
        END IF;
      END
      $$;

      NOTIFY pgrst, 'reload schema';
    `;
    await client.queryObject(sql);

    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Tabela de pacientes da empresa configurada!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    try { await client?.end(); } catch {}
    return new Response(JSON.stringify({ error: "Failed to setup company patients table", details: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});