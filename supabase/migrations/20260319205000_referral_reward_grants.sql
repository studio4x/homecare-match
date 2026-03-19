-- Referral Program - non-cash milestone rewards (coupon credits)

CREATE TABLE IF NOT EXISTS public.referral_reward_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  milestone_reached INTEGER NOT NULL,
  valid_referrals_count INTEGER NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'coupon_days',
  coupon_id UUID,
  coupon_code TEXT,
  free_days INTEGER NOT NULL DEFAULT 7,
  target_tier TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'granted',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_reward_grants_milestone_check CHECK (milestone_reached > 0),
  CONSTRAINT referral_reward_grants_valid_referrals_check CHECK (valid_referrals_count >= 0),
  CONSTRAINT referral_reward_grants_reward_type_check CHECK (reward_type IN ('coupon_days')),
  CONSTRAINT referral_reward_grants_target_tier_check CHECK (target_tier IN ('monthly', 'yearly')),
  CONSTRAINT referral_reward_grants_status_check CHECK (status IN ('granted', 'voided')),
  CONSTRAINT referral_reward_grants_unique_milestone UNIQUE (referrer_id, milestone_reached)
);

CREATE INDEX IF NOT EXISTS idx_referral_reward_grants_referrer
  ON public.referral_reward_grants (referrer_id, granted_at DESC);

DROP TRIGGER IF EXISTS trg_referral_reward_grants_updated_at ON public.referral_reward_grants;
CREATE TRIGGER trg_referral_reward_grants_updated_at
BEFORE UPDATE ON public.referral_reward_grants
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_updated_at();

ALTER TABLE public.referral_reward_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_reward_grants'
      AND policyname = 'referral_reward_grants_owner_or_admin_select'
  ) THEN
    CREATE POLICY "referral_reward_grants_owner_or_admin_select"
    ON public.referral_reward_grants
    FOR SELECT
    TO authenticated
    USING (check_is_admin() OR referrer_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_reward_grants'
      AND policyname = 'referral_reward_grants_admin_all'
  ) THEN
    CREATE POLICY "referral_reward_grants_admin_all"
    ON public.referral_reward_grants
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
