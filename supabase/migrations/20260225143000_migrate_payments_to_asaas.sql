-- Asaas payment migration

ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS asaas_environment TEXT DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS asaas_checkout_base_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_allow_credit_card BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS asaas_allow_pix BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS asaas_default_installment_max INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS asaas_checkout_expiration_minutes INTEGER DEFAULT 60;

UPDATE public.site_config
SET payment_provider = 'asaas'
WHERE payment_provider IS NULL OR payment_provider <> 'asaas';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS asaas_installment_max INTEGER;

UPDATE public.plans
SET asaas_installment_max = 12
WHERE id = 'yearly' AND asaas_installment_max IS NULL;

UPDATE public.plans
SET asaas_installment_max = 1
WHERE asaas_installment_max IS NULL;

ALTER TABLE public.academy_courses
  ADD COLUMN IF NOT EXISTS asaas_installment_max INTEGER DEFAULT 1;

UPDATE public.academy_courses
SET asaas_installment_max = 1
WHERE asaas_installment_max IS NULL;

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

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_date
  ON public.payment_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment
  ON public.payment_transactions (provider, payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
  ON public.payment_transactions (status);

ALTER TABLE public.asaas_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$
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
$$;

DO $$
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
$$;

NOTIFY pgrst, 'reload schema';

