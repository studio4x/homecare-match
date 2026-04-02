ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS free_trial_monthly_upgrade_target TEXT NOT NULL DEFAULT 'free_trial';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_config_free_trial_monthly_upgrade_target_check'
  ) THEN
    ALTER TABLE public.site_config
      ADD CONSTRAINT site_config_free_trial_monthly_upgrade_target_check
      CHECK (free_trial_monthly_upgrade_target IN ('free_trial', 'monthly_coupon', 'both'));
  END IF;
END $$;

UPDATE public.site_config
SET free_trial_monthly_upgrade_target = COALESCE(
  NULLIF(TRIM(free_trial_monthly_upgrade_target), ''),
  'free_trial'
)
WHERE id = 1;
