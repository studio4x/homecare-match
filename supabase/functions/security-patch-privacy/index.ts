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
    console.log("[security-patch-privacy] Iniciando blindagem profunda...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    // Executamos em blocos separados para evitar que um erro de 'View' bloqueie as 'Colunas'
    
    // 1. Garantir colunas
    await client.queryObject(`
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS professional_experiences TEXT;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat NUMERIC;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lng NUMERIC;
    `);

    // 2. Limpeza profunda da View (O CASCADE remove dependências que impedem o REPLACE)
    await client.queryObject(`DROP VIEW IF EXISTS public.professional_discovery CASCADE;`);

    // 3. Criar a View Segura
    await client.queryObject(`
      CREATE VIEW public.professional_discovery AS
      SELECT 
        id, full_name, avatar_url, specialty, city, state, neighborhood, 
        experience, professional_experiences, bio, is_verified, 
        subscription_tier, role, lat, lng, referral_count, updated_at, trial_started_at
      FROM public.profiles
      WHERE role = 'professional' 
        AND full_name IS NOT NULL 
        AND email_confirmed = true;

      GRANT SELECT ON public.professional_discovery TO authenticated;
      GRANT SELECT ON public.professional_discovery TO anon;
    `);

    // 4. Configurar RLS (Remover e Recriar)
    await client.queryObject(`
      DROP POLICY IF EXISTS "profiles_public_read_policy" ON public.profiles;
      DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
      DROP POLICY IF EXISTS "profiles_secure_access" ON public.profiles;

      CREATE POLICY "profiles_secure_access" ON public.profiles
      FOR SELECT TO authenticated
      USING (
        (auth.uid() = id) OR 
        (EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin')
        )) OR
        (EXISTS (
          SELECT 1 FROM public.interactions i 
          WHERE (i.sender_id = auth.uid() AND i.professional_id = profiles.id)
             OR (i.professional_id = auth.uid() AND i.sender_id = profiles.id)
        ))
      );
    `);

    // 5. Notificar recarregamento
    await client.queryObject(`NOTIFY pgrst, 'reload schema';`);

    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Blindagem aplicada com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[security-patch-privacy] Erro fatal:", e.message);
    if (client) {
      try { await client.end(); } catch (err) { console.error("Erro ao fechar cliente:", err); }
    }
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});