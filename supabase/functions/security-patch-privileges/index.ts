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
    console.log("[security-patch] Atualizando proteção de privilégios com trava de auto-bloqueio...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Função que protege os campos sensíveis
      CREATE OR REPLACE FUNCTION public.protect_profile_fields()
      RETURNS TRIGGER AS $$
      BEGIN
        -- CASO 1: Usuário comum (não admin) tentando mudar campos proibidos
        IF (current_setting('role') = 'authenticated') AND NOT public.check_is_admin() THEN
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

        -- CASO 2: Administrador tentando remover o próprio acesso (Trava de Segurança)
        -- Se o ID que está sendo alterado for o mesmo do usuário logado
        IF (auth.uid() = NEW.id) AND (OLD.is_admin = true OR OLD.role = 'admin') THEN
          -- Impede que is_admin mude para false
          IF NEW.is_admin = false THEN
            NEW.is_admin := true;
          END IF;
          -- Impede que o papel mude para algo diferente de admin
          IF NEW.role != 'admin' THEN
            NEW.role := 'admin';
          END IF;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- 2. Garante que o gatilho esteja aplicado
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

    return new Response(JSON.stringify({ ok: true, message: "Proteção de privilégios e trava de auto-bloqueio aplicadas!" }), {
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