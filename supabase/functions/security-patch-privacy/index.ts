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
    console.log("[security-patch-privacy] Corrigindo políticas de RLS para evitar recursão...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Limpeza da View (CASCADE para garantir que nada bloqueie)
      DROP VIEW IF EXISTS public.professional_discovery CASCADE;

      -- 2. Recriar a View Segura
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

      -- 3. Corrigir Política de RLS na tabela 'profiles'
      -- Usamos a função check_is_admin() que é SECURITY DEFINER para evitar recursão infinita
      DROP POLICY IF EXISTS "profiles_secure_access" ON public.profiles;

      CREATE POLICY "profiles_secure_access" ON public.profiles
      FOR SELECT TO authenticated
      USING (
        (auth.uid() = id) OR 
        (public.check_is_admin() = true) OR
        (EXISTS (
          SELECT 1 FROM public.interactions i 
          WHERE (i.sender_id = auth.uid() AND i.professional_id = profiles.id)
             OR (i.professional_id = auth.uid() AND i.sender_id = profiles.id)
        ))
      );

      -- 4. Notificar recarregamento
      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Políticas corrigidas com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[security-patch-privacy] Erro fatal:", e.message);
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});