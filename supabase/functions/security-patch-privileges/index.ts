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
    console.log("[security-patch] Iniciando aplicação de proteção de colunas...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Função que protege os campos sensíveis
      CREATE OR REPLACE FUNCTION public.protect_profile_fields()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Protege campos sensíveis apenas se a requisição vier de um usuário autenticado comum (não admin)
        -- O papel 'service_role' (usado por webhooks e processos de sistema) deve ter permissão total.
        -- O papel 'postgres' (admin do banco) também tem permissão total.
        
        IF (current_setting('role') = 'authenticated') AND NOT public.check_is_admin() THEN
          -- Se o usuário tentar alterar campos proibidos, forçamos o valor antigo (OLD)
          NEW.is_admin := OLD.is_admin;
          NEW.role := OLD.role;
          NEW.is_verified := OLD.is_verified;
          NEW.subscription_tier := OLD.subscription_tier;
          NEW.email_confirmed := OLD.email_confirmed;
          NEW.trial_started_at := OLD.trial_started_at;
          NEW.subscription_end_at := OLD.subscription_end_at;
          NEW.referral_count := OLD.referral_count;
          NEW.verification_sent := OLD.verification_sent;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- 2. Aplica o gatilho na tabela profiles
      DROP TRIGGER IF EXISTS on_profile_update_protect_fields ON public.profiles;
      CREATE TRIGGER on_profile_update_protect_fields
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.protect_profile_fields();

      -- 3. Notifica o recarregamento do esquema
      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Proteção de privilégios aplicada com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    console.error("[security-patch] Erro:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});