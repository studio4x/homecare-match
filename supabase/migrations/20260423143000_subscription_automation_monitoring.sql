CREATE TABLE IF NOT EXISTS public.subscription_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_key TEXT NOT NULL DEFAULT 'subscription_expiry_alerts',
  action TEXT NOT NULL DEFAULT 'process',
  trigger_source TEXT NOT NULL DEFAULT 'cron',
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'warning')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  checked_count INTEGER NOT NULL DEFAULT 0,
  notified_count INTEGER NOT NULL DEFAULT 0,
  bonus_upgrades_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_automation_runs_key_started
  ON public.subscription_automation_runs (automation_key, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_automation_runs_key_status
  ON public.subscription_automation_runs (automation_key, status, started_at DESC);

ALTER TABLE public.subscription_automation_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_automation_runs'
      AND policyname = 'Admins can read subscription automation runs'
  ) THEN
    CREATE POLICY "Admins can read subscription automation runs"
      ON public.subscription_automation_runs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND (profiles.is_admin = true OR profiles.role = 'admin')
        )
      );
  END IF;
END $$;
