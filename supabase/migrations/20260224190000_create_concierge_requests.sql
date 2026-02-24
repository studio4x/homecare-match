CREATE TABLE IF NOT EXISTS public.concierge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_role TEXT NOT NULL,
  requester_name TEXT,
  requester_email TEXT,
  specialty TEXT,
  city TEXT,
  state TEXT,
  neighborhood TEXT,
  availability TEXT,
  patient_profile TEXT,
  max_hourly_rate NUMERIC,
  urgency TEXT NOT NULL DEFAULT 'esta-semana',
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.concierge_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'concierge_requests' AND policyname = 'concierge_requests_insert_own'
  ) THEN
    CREATE POLICY "concierge_requests_insert_own"
    ON public.concierge_requests
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'concierge_requests' AND policyname = 'concierge_requests_select_own'
  ) THEN
    CREATE POLICY "concierge_requests_select_own"
    ON public.concierge_requests
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'concierge_requests' AND policyname = 'concierge_requests_admin_all'
  ) THEN
    CREATE POLICY "concierge_requests_admin_all"
    ON public.concierge_requests
    FOR ALL TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_concierge_requests_created_at ON public.concierge_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_requests_status ON public.concierge_requests(status);

NOTIFY pgrst, 'reload schema';
