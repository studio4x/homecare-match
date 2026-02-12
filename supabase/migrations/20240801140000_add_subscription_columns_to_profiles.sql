ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;