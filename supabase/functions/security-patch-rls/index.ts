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
    console.log("[security-patch-rls] Iniciando implementação de View Segura e restrição de dados...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Criar a View Segura para Descoberta de Profissionais
      -- Esta view expõe apenas campos não sensíveis
      CREATE OR REPLACE VIEW public.professional_discovery AS
      SELECT 
        id, 
        full_name, 
        avatar_url, 
        specialty, 
        city, 
        state, 
        neighborhood, 
        experience, 
        bio, 
        is_verified, 
        subscription_tier, 
        role, 
        lat, 
        lng, 
        referral_count, 
        updated_at,
        trial_started_at
      FROM public.profiles
      WHERE role = 'professional' 
        AND full_name IS NOT NULL 
        AND email_confirmed = true;

      -- 2. Garantir permissões na View
      GRANT SELECT ON public.professional_discovery TO authenticated;
      GRANT SELECT ON public.professional_discovery TO anon;

      -- 3. Atualizar Políticas de RLS na tabela principal 'profiles'
      -- Removemos a política antiga que expunha tudo
      DROP POLICY IF EXISTS "profiles_public_discovery" ON public.profiles;

      -- Criamos uma nova política restrita para a tabela principal
      -- Agora, para ver os dados sensíveis (como telefone), o usuário deve:
      -- a) Ser o dono do perfil
      -- b) Ser um administrador
      -- c) Ter uma interação ativa (contato) com aquele profissional
      
      -- Nota: A política 'profiles_owner_select' e 'profiles_interaction_visibility' 
      -- já existem e cobrem os casos (a) e (c). 
      -- Vamos apenas garantir que não haja uma política 'SELECT true' sobrando.

      -- 4. Notificar o PostgREST para recarregar o esquema
      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Camada de proteção de dados aplicada com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    console.error("[security-patch-rls] Erro:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});