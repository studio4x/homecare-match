ALTER TABLE public.affiliate_applications
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'affiliate_applications_terms_consistency_check'
      AND conrelid = 'public.affiliate_applications'::regclass
  ) THEN
    ALTER TABLE public.affiliate_applications
      ADD CONSTRAINT affiliate_applications_terms_consistency_check
      CHECK (
        terms_accepted = false
        OR terms_accepted_at IS NOT NULL
      );
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

