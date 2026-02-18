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
    console.log("[security-patch-privacy] Iniciando blindagem resiliente...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Garantir que as colunas necessárias existam antes de criar a View
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS professional_experiences TEXT;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lat NUMERIC;
      ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lng NUMERIC;

      -- 2. Criar/Atualizar a View de Descoberta (Sem campos sensíveis)
      CREATE OR REPLACE VIEW public.professional_discovery AS
      SELECT 
        id, full_name, avatar_url, specialty, city, state, neighborhood, 
        experience, professional_experiences, bio, is_verified, 
        subscription_tier, role, lat, lng, referral_count, updated_at, trial_started_at
      FROM public.profiles
      WHERE role = 'professional' 
        AND full_name IS NOT NULL 
        AND email_confirmed = true;

      -- 3. Garantir permissões na View
      GRANT SELECT ON public.professional_discovery TO authenticated;
      GRANT SELECT ON public.professional_discovery TO anon;

      -- 4. Limpar políticas antigas que podem causar conflito
      DROP POLICY IF EXISTS "profiles_public_read_policy" ON public.profiles;
      DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles;
      DROP POLICY IF EXISTS "profiles_secure_access" ON public.profiles;

      -- 5. Criar política de visibilidade condicional (Blindagem)
      -- O usuário só vê o perfil completo (com telefone) se:
      -- a) For o dono
      -- b) For admin
      -- c) Houver uma interação (contato) registrada
      CREATE POLICY "profiles_secure_access" ON public.profiles
      FOR SELECT TO authenticated
      USING (
        (auth.uid() = id) OR 
        (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.is_admin = true OR p.role = 'admin'))) OR
        (EXISTS (
          SELECT 1 FROM public.interactions i 
          WHERE (i.sender_id = auth.uid() AND i.professional_id = profiles.id)
             OR (i.professional_id = auth.uid() AND i.sender_id = profiles.id)
        ))
      );

      -- 6. Notifica o recarregamento do esquema
      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Blindagem de dados aplicada com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    console.error("[security-patch-privacy] Erro fatal:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});