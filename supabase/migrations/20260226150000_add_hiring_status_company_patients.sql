ALTER TABLE public.company_patients
  ADD COLUMN IF NOT EXISTS hiring_status TEXT;

ALTER TABLE public.company_patients
  ALTER COLUMN hiring_status SET DEFAULT 'needs_professional';

UPDATE public.company_patients
SET hiring_status = 'needs_professional'
WHERE hiring_status IS NULL
   OR hiring_status NOT IN ('needs_professional', 'hiring_in_progress', 'hired');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_patients_hiring_status_check'
  ) THEN
    ALTER TABLE public.company_patients
      ADD CONSTRAINT company_patients_hiring_status_check
      CHECK (hiring_status IN ('needs_professional', 'hiring_in_progress', 'hired'));
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
