import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let client: Client | null = null;
  try {
    if (!SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL ausente.");
    if (!SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL ausente.");

    const authHeader = req.headers.get("authorization");
    const jwtToken = authHeader?.replace("Bearer ", "").trim() || "";
    if (!jwtToken) {
      return new Response(JSON.stringify({ error: "Autenticacao ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(jwtToken);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuario nao autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = !!profile?.is_admin || profile?.role === "admin";
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    client = new Client(SUPABASE_DB_URL);
    await client.connect();

    const sql = `
      -- Base profile columns
      ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS lat NUMERIC,
        ADD COLUMN IF NOT EXISTS lng NUMERIC,
        ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS coupon_days INTEGER,
        ADD COLUMN IF NOT EXISTS cpf TEXT,
        ADD COLUMN IF NOT EXISTS ans_registration TEXT,
        ADD COLUMN IF NOT EXISTS company_name TEXT,
        ADD COLUMN IF NOT EXISTS cnpj TEXT,
        ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
        ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at TIMESTAMPTZ;

      -- Site config columns
      ALTER TABLE public.site_config
        ADD COLUMN IF NOT EXISTS google_maps_api_key TEXT,
        ADD COLUMN IF NOT EXISTS vapid_public_key TEXT,
        ADD COLUMN IF NOT EXISTS video_url_professionals TEXT,
        ADD COLUMN IF NOT EXISTS video_url_companies TEXT,
        ADD COLUMN IF NOT EXISTS video_url_families TEXT,
        ADD COLUMN IF NOT EXISTS video_url_onboarding TEXT,
        ADD COLUMN IF NOT EXISTS video_url_onboarding_company TEXT,
        ADD COLUMN IF NOT EXISTS video_url_onboarding_family TEXT,
        ADD COLUMN IF NOT EXISTS video_storage_path_professionals TEXT,
        ADD COLUMN IF NOT EXISTS video_mime_professionals TEXT,
        ADD COLUMN IF NOT EXISTS video_storage_path_companies TEXT,
        ADD COLUMN IF NOT EXISTS video_mime_companies TEXT,
        ADD COLUMN IF NOT EXISTS video_storage_path_families TEXT,
        ADD COLUMN IF NOT EXISTS video_mime_families TEXT,
        ADD COLUMN IF NOT EXISTS video_storage_path_onboarding TEXT,
        ADD COLUMN IF NOT EXISTS video_mime_onboarding TEXT,
        ADD COLUMN IF NOT EXISTS video_storage_path_onboarding_company TEXT,
        ADD COLUMN IF NOT EXISTS video_mime_onboarding_company TEXT,
        ADD COLUMN IF NOT EXISTS video_storage_path_onboarding_family TEXT,
        ADD COLUMN IF NOT EXISTS video_mime_onboarding_family TEXT,
        ADD COLUMN IF NOT EXISTS gemini_model TEXT DEFAULT 'gemini-1.5-flash',
        ADD COLUMN IF NOT EXISTS push_layout_json JSONB DEFAULT '{"bgColor": "#ffffff", "titleColor": "#0f172a", "bodyColor": "#64748b", "borderRadius": "32", "iconBgColor": "#007BFF1a", "iconColor": "#007BFF", "shadowIntensity": "0.25", "ctaBgColor": "#007BFF", "ctaTextColor": "#ffffff", "backdropColor": "rgba(0,0,0,0.05)", "duration": 15}'::jsonb,
        ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'asaas',
        ADD COLUMN IF NOT EXISTS asaas_environment TEXT DEFAULT 'sandbox',
        ADD COLUMN IF NOT EXISTS asaas_checkout_base_url TEXT,
        ADD COLUMN IF NOT EXISTS asaas_allow_credit_card BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS asaas_allow_pix BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS asaas_default_installment_max INTEGER DEFAULT 12,
        ADD COLUMN IF NOT EXISTS asaas_checkout_expiration_minutes INTEGER DEFAULT 60,
        ADD COLUMN IF NOT EXISTS pwa_app_name TEXT DEFAULT 'HomeCare Match',
        ADD COLUMN IF NOT EXISTS pwa_short_name TEXT DEFAULT 'HomeCare',
        ADD COLUMN IF NOT EXISTS pwa_description TEXT DEFAULT 'Conectando profissionais de saúde às melhores oportunidades em Home Care.',
        ADD COLUMN IF NOT EXISTS pwa_theme_color TEXT DEFAULT '#0f172a',
        ADD COLUMN IF NOT EXISTS pwa_background_color TEXT DEFAULT '#ffffff',
        ADD COLUMN IF NOT EXISTS pwa_icon_192_url TEXT,
        ADD COLUMN IF NOT EXISTS pwa_icon_512_url TEXT,
        ADD COLUMN IF NOT EXISTS pwa_maskable_icon_url TEXT,
        ADD COLUMN IF NOT EXISTS pwa_install_image_url TEXT,
        ADD COLUMN IF NOT EXISTS pwa_install_title TEXT DEFAULT 'Instale o app HomeCare Match',
        ADD COLUMN IF NOT EXISTS pwa_install_description TEXT DEFAULT 'Acesse mais rápido pelo seu celular, direto da tela inicial.',
        ADD COLUMN IF NOT EXISTS pwa_assets_json JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS pwa_screenshots_json JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS chatbot_enabled BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS chatbot_use_ai BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS chatbot_ai_first BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS chatbot_show_mode_badge BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS chatbot_welcome_message TEXT DEFAULT 'Ola! Sou o assistente da plataforma. Posso ajudar com funcionalidades e como usar cada recurso.',
        ADD COLUMN IF NOT EXISTS chatbot_out_of_scope_message TEXT DEFAULT 'Posso responder apenas sobre funcionalidades da plataforma e como usa-las. Se precisar, posso te direcionar para o suporte.',
        ADD COLUMN IF NOT EXISTS chatbot_error_message TEXT DEFAULT 'Nao consegui responder agora. Tente novamente em instantes ou abra um chamado no suporte.',
        ADD COLUMN IF NOT EXISTS chatbot_max_requests_anon_per_day INTEGER DEFAULT 20,
        ADD COLUMN IF NOT EXISTS chatbot_max_requests_auth_per_day INTEGER DEFAULT 80,
        ADD COLUMN IF NOT EXISTS chatbot_history_window INTEGER DEFAULT 12,
        ADD COLUMN IF NOT EXISTS chatbot_retention_days INTEGER DEFAULT 30;

      UPDATE public.site_config
      SET payment_provider = 'asaas'
      WHERE payment_provider IS NULL OR payment_provider <> 'asaas';

      -- Installment columns for plans and academy
      ALTER TABLE public.plans
        ADD COLUMN IF NOT EXISTS asaas_installment_max INTEGER;

      UPDATE public.plans SET asaas_installment_max = 12 WHERE id = 'yearly' AND asaas_installment_max IS NULL;
      UPDATE public.plans SET asaas_installment_max = 1 WHERE asaas_installment_max IS NULL;

      ALTER TABLE public.academy_courses
        ADD COLUMN IF NOT EXISTS asaas_installment_max INTEGER DEFAULT 1;

      UPDATE public.academy_courses SET asaas_installment_max = 1 WHERE asaas_installment_max IS NULL;

      -- Asaas operational tables
      CREATE TABLE IF NOT EXISTS public.asaas_checkout_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        checkout_id TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL DEFAULT 'asaas',
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        plan_id TEXT,
        course_slug TEXT,
        plan_duration_days INTEGER,
        amount NUMERIC(12,2),
        status TEXT NOT NULL DEFAULT 'CHECKOUT_CREATED',
        checkout_url TEXT,
        asaas_customer_id TEXT,
        payment_id TEXT,
        payment_status TEXT,
        paid_at TIMESTAMPTZ,
        raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_asaas_checkout_sessions_user_created
        ON public.asaas_checkout_sessions (user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_asaas_checkout_sessions_checkout
        ON public.asaas_checkout_sessions (checkout_id);

      CREATE INDEX IF NOT EXISTS idx_asaas_checkout_sessions_payment
        ON public.asaas_checkout_sessions (payment_id);

      CREATE TABLE IF NOT EXISTS public.payment_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider TEXT NOT NULL DEFAULT 'asaas',
        payment_id TEXT NOT NULL,
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        transaction_type TEXT NOT NULL DEFAULT 'unknown',
        plan_id TEXT,
        course_slug TEXT,
        plan_duration_days INTEGER,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'BRL',
        status TEXT,
        description TEXT,
        invoice_url TEXT,
        asaas_checkout_id TEXT,
        asaas_customer_id TEXT,
        payment_date TIMESTAMPTZ,
        confirmed_at TIMESTAMPTZ,
        subscription_end_at TIMESTAMPTZ,
        raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        last_event TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT payment_transactions_provider_payment_id_key UNIQUE (provider, payment_id)
      );

      CREATE TABLE IF NOT EXISTS public.whatsapp_notification_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type TEXT NOT NULL,
        target_kind TEXT NOT NULL CHECK (target_kind IN ('user', 'admin')),
        recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        recipient_phone_e164 TEXT NOT NULL,
        template_name TEXT NOT NULL,
        template_params JSONB NOT NULL DEFAULT '[]'::jsonb,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retry', 'sent', 'failed')),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_date
        ON public.payment_transactions (user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment
        ON public.payment_transactions (provider, payment_id);

      CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
        ON public.payment_transactions (status);

      CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status_next_retry
        ON public.whatsapp_notification_queue (status, next_retry_at);

      CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_created_at
        ON public.whatsapp_notification_queue (created_at DESC);

      ALTER TABLE public.asaas_checkout_sessions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.whatsapp_notification_queue ENABLE ROW LEVEL SECURITY;

      DO $policy$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'asaas_checkout_sessions'
            AND policyname = 'Users can read own checkout sessions'
        ) THEN
          CREATE POLICY "Users can read own checkout sessions"
            ON public.asaas_checkout_sessions
            FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
        END IF;
      END
      $policy$;

      DO $policy$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'payment_transactions'
            AND policyname = 'Users can read own payment transactions'
        ) THEN
          CREATE POLICY "Users can read own payment transactions"
            ON public.payment_transactions
            FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
        END IF;
      END
      $policy$;

      -- Allow anonymous validation of active coupons
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon to validate coupons') THEN
          CREATE POLICY "Allow anon to validate coupons" ON public.coupons
          FOR SELECT TO anon USING (is_active = true);
        END IF;
      END
      $$;

      -- Coupon behavior fields
      ALTER TABLE public.coupons
        ADD COLUMN IF NOT EXISTS apply_mode TEXT,
        ADD COLUMN IF NOT EXISTS target_tier TEXT;

      UPDATE public.coupons
      SET apply_mode = CASE WHEN only_new_users THEN 'signup_only' ELSE 'dashboard_only' END
      WHERE apply_mode IS NULL OR btrim(apply_mode) = '';

      UPDATE public.coupons
      SET target_tier = COALESCE(NULLIF(lower(target_tier), ''), 'monthly')
      WHERE target_tier IS NULL OR btrim(target_tier) = '';

      ALTER TABLE public.coupons ALTER COLUMN apply_mode SET DEFAULT 'signup_only';
      ALTER TABLE public.coupons ALTER COLUMN apply_mode SET NOT NULL;
      ALTER TABLE public.coupons ALTER COLUMN target_tier SET DEFAULT 'monthly';
      ALTER TABLE public.coupons ALTER COLUMN target_tier SET NOT NULL;

      DO $coupon_constraints$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'coupons_apply_mode_check'
            AND conrelid = 'public.coupons'::regclass
        ) THEN
          ALTER TABLE public.coupons
            ADD CONSTRAINT coupons_apply_mode_check
            CHECK (apply_mode IN ('signup_only', 'dashboard_only', 'signup_and_dashboard'));
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'coupons_target_tier_check'
            AND conrelid = 'public.coupons'::regclass
        ) THEN
          ALTER TABLE public.coupons
            ADD CONSTRAINT coupons_target_tier_check
            CHECK (target_tier IN ('monthly', 'yearly'));
        END IF;
      END
      $coupon_constraints$;

      -- Keep handle_new_user aligned with current app model
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
        coupon_apply_mode_found TEXT;
        coupon_target_tier_found TEXT;
        final_tier TEXT;
        final_end_at TIMESTAMP WITH TIME ZONE;
        final_coupon_days INTEGER;
      BEGIN
        user_role := new.raw_user_meta_data ->> 'role';
        meta_coupon := new.raw_user_meta_data ->> 'coupon_code';

        SELECT count(*) INTO admin_count FROM public.profiles WHERE is_admin = true;

        IF admin_count = 0 THEN
          user_role := 'admin';
        ELSE
          IF user_role IS NULL OR user_role NOT IN ('company', 'family', 'professional') THEN
            user_role := 'professional';
          END IF;
        END IF;

        final_tier := CASE WHEN user_role = 'professional' THEN 'free_trial' ELSE NULL END;
        final_end_at := NULL;
        final_coupon_days := NULL;

        IF meta_coupon IS NOT NULL AND user_role = 'professional' THEN
          SELECT
            id,
            free_days,
            COALESCE(NULLIF(lower(apply_mode), ''), CASE WHEN only_new_users THEN 'signup_only' ELSE 'dashboard_only' END),
            COALESCE(NULLIF(lower(target_tier), ''), 'monthly')
          INTO coupon_id_found, coupon_days_found, coupon_apply_mode_found, coupon_target_tier_found
          FROM public.coupons
          WHERE upper(code) = upper(meta_coupon)
            AND is_active = true
            AND current_uses < max_uses
            AND COALESCE(NULLIF(lower(apply_mode), ''), CASE WHEN only_new_users THEN 'signup_only' ELSE 'dashboard_only' END)
              IN ('signup_only', 'signup_and_dashboard')
          LIMIT 1;

          IF coupon_id_found IS NOT NULL THEN
            final_tier := CASE WHEN coupon_target_tier_found = 'yearly' THEN 'yearly' ELSE 'monthly' END;
            final_end_at := NOW() + (coupon_days_found || ' days')::interval;
            final_coupon_days := coupon_days_found;
          END IF;
        END IF;

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
          cancel_at_period_end,
          cpf,
          company_name,
          cnpj,
          ans_registration
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
          (final_coupon_days IS NOT NULL),
          new.raw_user_meta_data ->> 'cpf',
          new.raw_user_meta_data ->> 'company_name',
          new.raw_user_meta_data ->> 'cnpj',
          new.raw_user_meta_data ->> 'ans_registration'
        );

        IF coupon_id_found IS NOT NULL THEN
          INSERT INTO public.coupon_usages (coupon_id, user_id)
          VALUES (coupon_id_found, new.id)
          ON CONFLICT DO NOTHING;

          UPDATE public.coupons
          SET current_uses = current_uses + 1
          WHERE id = coupon_id_found;
        END IF;

        RETURN new;
      END;
      $function$;

      ALTER TABLE public.profiles REPLICA IDENTITY FULL;

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
      END
      $$;

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
    try {
      await client?.end();
    } catch {
      // ignore
    }

    return new Response(JSON.stringify({ error: "Failed to extend schema", details: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});



