import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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
    console.log("[security-patch-privacy] Reconstruindo políticas de RLS do zero...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Limpeza total de políticas de SELECT na tabela profiles para evitar conflitos
      DO $$ 
      DECLARE 
        pol record;
      BEGIN
        FOR pol IN 
          SELECT policyname FROM pg_policies 
          WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
        END LOOP;
      END $$;

      -- 2. Criar política de "Dono do Perfil" (Sempre permitida)
      CREATE POLICY "profiles_owner_select" ON public.profiles
      FOR SELECT TO authenticated
      USING (auth.uid() = id);

      -- 3. Criar política de "Administrador" (Acesso Total)
      -- Usamos a função check_is_admin() que é SECURITY DEFINER para ignorar o RLS internamente
      CREATE POLICY "profiles_admin_select" ON public.profiles
      FOR SELECT TO authenticated
      USING (public.check_is_admin() = true);

      -- 4. Criar política de "Interação/Match" (Ver dados de contato após interesse)
      CREATE POLICY "profiles_interaction_select" ON public.profiles
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.interactions i 
          WHERE (i.sender_id = auth.uid() AND i.professional_id = profiles.id)
             OR (i.professional_id = auth.uid() AND i.sender_id = profiles.id)
        )
      );

      -- 5. Garantir que a View Segura esteja atualizada
      DROP VIEW IF EXISTS public.professional_discovery CASCADE;
      CREATE VIEW public.professional_discovery AS
      SELECT 
        id, full_name, avatar_url, specialty, city, state, neighborhood, 
        experience, professional_experiences, bio, is_verified, 
        subscription_tier, subscription_end_at, cancel_at_period_end,
        role, lat, lng, referral_count, updated_at, trial_started_at
      FROM public.profiles
      WHERE role = 'professional' 
        AND full_name IS NOT NULL 
        AND email_confirmed = true;

      GRANT SELECT ON public.professional_discovery TO authenticated;
      GRANT SELECT ON public.professional_discovery TO anon;

      -- 6. Notificar recarregamento do esquema
      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Políticas de privacidade reconstruídas com sucesso!" }), {
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
