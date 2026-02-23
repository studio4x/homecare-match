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

      -- Coluna para VAPID Public Key
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS vapid_public_key TEXT;

      -- Coluna para Modelo do Gemini
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS gemini_model TEXT DEFAULT 'gemini-1.5-flash';

      -- Coluna para Configurações de Layout do Push
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS push_layout_json JSONB DEFAULT '{"bgColor": "#ffffff", "titleColor": "#0f172a", "bodyColor": "#64748b", "borderRadius": "32", "iconBgColor": "#007BFF1a", "iconColor": "#007BFF", "shadowIntensity": "0.25", "ctaBgColor": "#007BFF", "ctaTextColor": "#ffffff", "backdropColor": "rgba(0,0,0,0.05)", "duration": 15}'::jsonb;

      -- Nova coluna para Registro ANS
      ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS ans_registration TEXT;

      -- PERMISSÃO PARA ANONIMOS VALIDAREM CUPONS NO CADASTRO
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon to validate coupons') THEN
          CREATE POLICY "Allow anon to validate coupons" ON public.coupons
          FOR SELECT TO anon USING (is_active = true);
        END IF;
      END
      $$;

      -- ATUALIZAÇÃO DA FUNÇÃO DE CRIAÇÃO DE USUÁRIO (CORREÇÃO DE ORDEM E ROBUSTEZ)
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
        coupon_id_found UUID;
        coupon_days_found INTEGER;
        final_tier TEXT;
        final_end_at TIMESTAMP WITH TIME ZONE;
        final_coupon_days INTEGER;
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

        -- Valores padrão
        final_tier := CASE WHEN user_role = 'professional' THEN 'free_trial' ELSE NULL END;
        final_end_at := NULL;
        final_coupon_days := NULL;

        -- 1. BUSCA O CUPOM (Se fornecido e for profissional)
        IF meta_coupon IS NOT NULL AND user_role = 'professional' THEN
          SELECT id, free_days INTO coupon_id_found, coupon_days_found 
          FROM public.coupons 
          WHERE upper(code) = upper(meta_coupon) 
            AND is_active = true 
            AND current_uses < max_uses 
          LIMIT 1;
          
          IF coupon_id_found IS NOT NULL THEN
            final_tier := 'monthly';
            final_end_at := NOW() + (coupon_days_found || ' days')::interval;
            final_coupon_days := coupon_days_found;
          END IF;
        END IF;

        -- 2. INSERÇÃO DO PERFIL (Sempre primeiro para garantir integridade)
        INSERT INTO public.profiles (
          id, 
          full_name, 
          email, 
          is_admin, 
          role, 
          subscription_tier, 
          subscription_end_at,
          trial_started_at,
          coupon_days,
          cancel_at_period_end
        )
        VALUES (
          new.id, 
          new.raw_user_meta_data ->> 'full_name',
          new.email,
          (user_role = 'admin'),
          user_role,
          final_tier,
          final_end_at,
          CASE WHEN user_role = 'professional' AND final_coupon_days IS NULL THEN NOW() ELSE NULL END,
          final_coupon_days,
          (final_coupon_days IS NOT NULL)
        );

        -- 3. REGISTRA O USO DO CUPOM (Após o perfil existir)
        IF coupon_id_found IS NOT NULL THEN
          -- Registra o uso
          INSERT INTO public.coupon_usages (coupon_id, user_id) 
          VALUES (coupon_id_found, new.id)
          ON CONFLICT DO NOTHING;
          
          -- Incrementa o contador
          UPDATE public.coupons 
          SET current_uses = current_uses + 1 
          WHERE id = coupon_id_found;
        END IF;

        RETURN new;
      END;
      $function$;

      -- Configurar REPLICA IDENTITY FULL para a tabela profiles (CRÍTICO para Realtime)
      ALTER TABLE public.profiles REPLICA IDENTITY FULL;

      -- Habilitar Realtime para a tabela profiles com verificação de existência
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables 
          WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'profiles'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
        END IF;
      END $$;

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