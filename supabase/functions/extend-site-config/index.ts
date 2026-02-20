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
      -- Colunas de geolocalização
      ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS lat NUMERIC,
        ADD COLUMN IF NOT EXISTS lng NUMERIC;

      -- Coluna para cache de indicações
      ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

      -- Coluna para rastrear dias de bonificação via cupom
      ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS coupon_days INTEGER;

      -- Coluna para Chave de API do Google Maps (Lado do Cliente)
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS google_maps_api_key TEXT;

      -- Coluna para VAPID Public Key (Necessária para o navegador assinar o push)
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS vapid_public_key TEXT;

      -- Coluna para Modelo do Gemini
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS gemini_model TEXT DEFAULT 'gemini-1.5-flash';

      -- Coluna para Configurações de Layout do Push
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS push_layout_json JSONB DEFAULT '{"bgColor": "#ffffff", "titleColor": "#0f172a", "bodyColor": "#64748b", "borderRadius": "32", "iconBgColor": "#007BFF1a", "iconColor": "#007BFF", "shadowIntensity": "0.25", "ctaBgColor": "#007BFF", "ctaTextColor": "#ffffff", "backdropColor": "rgba(0,0,0,0.05)", "duration": 15}'::jsonb;

      -- ATUALIZAÇÃO DA FUNÇÃO DE CRIAÇÃO DE USUÁRIO PARA SUPORTAR CUPOM
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path TO 'public'
      AS $function$
      DECLARE
        admin_count INTEGER;
        user_role TEXT;
        meta_coupon TEXT;
        coupon_record RECORD;
      BEGIN
        -- Captura metadados
        user_role := new.raw_user_meta_data ->> 'role';
        meta_coupon := new.raw_user_meta_data ->> 'coupon_code';

        -- Verifica se já existe algum admin
        SELECT count(*) INTO admin_count FROM public.profiles WHERE is_admin = true;

        -- Determina o papel final do usuário
        IF admin_count = 0 THEN
          user_role := 'admin';
        ELSE
          IF user_role IS NULL OR user_role NOT IN ('company', 'family', 'professional') THEN
            user_role := 'professional';
          END IF;
        END IF;

        -- Inserção básica do perfil
        INSERT INTO public.profiles (id, full_name, email, is_admin, role, subscription_tier, trial_started_at)
        VALUES (
          new.id, 
          new.raw_user_meta_data ->> 'full_name',
          new.email,
          (user_role = 'admin'),
          user_role,
          CASE WHEN user_role = 'professional' THEN 'free_trial' ELSE NULL END,
          CASE WHEN user_role = 'professional' THEN NOW() ELSE NULL END
        );

        -- APLICAÇÃO DE CUPOM NO CADASTRO (Apenas para profissionais)
        IF meta_coupon IS NOT NULL AND user_role = 'professional' THEN
          SELECT * INTO coupon_record FROM public.coupons 
          WHERE upper(code) = upper(meta_coupon) 
            AND is_active = true 
            AND current_uses < max_uses 
          LIMIT 1;
          
          IF coupon_record.id IS NOT NULL THEN
            -- Atualiza o perfil recém criado com o benefício do cupom
            UPDATE public.profiles 
            SET 
              subscription_tier = 'monthly',
              subscription_end_at = NOW() + (coupon_record.free_days || ' days')::interval,
              cancel_at_period_end = true,
              coupon_days = coupon_record.free_days,
              updated_at = NOW()
            WHERE id = new.id;

            -- Registra o uso do cupom
            INSERT INTO public.coupon_usages (coupon_id, user_id) VALUES (coupon_record.id, new.id);
            
            -- Incrementa o contador do cupom
            UPDATE public.coupons SET current_uses = current_uses + 1 WHERE id = coupon_record.id;
          END IF;
        END IF;

        RETURN new;
      END;
      $function$;

      -- Notifica o PostgREST para recarregar o esquema
      NOTIFY pgrst, 'reload schema';
    `;
    await client.queryObject(sql);

    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true }), {
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