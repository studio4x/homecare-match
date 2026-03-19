-- Affiliate Program v1 - public applications funnel

CREATE TABLE IF NOT EXISTS public.affiliate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  state TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  audience TEXT,
  experience TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  affiliate_partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_applications_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT affiliate_applications_pix_type_check CHECK (
    pix_key_type IS NULL OR pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_applications_email_unique_active
  ON public.affiliate_applications (email_normalized)
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status_created
  ON public.affiliate_applications (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_affiliate_application_email_normalized()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email_normalized := lower(btrim(COALESCE(NEW.email, '')));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_applications_email_normalized ON public.affiliate_applications;
CREATE TRIGGER trg_affiliate_applications_email_normalized
BEFORE INSERT OR UPDATE OF email ON public.affiliate_applications
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_application_email_normalized();

DROP TRIGGER IF EXISTS trg_affiliate_applications_updated_at ON public.affiliate_applications;
CREATE TRIGGER trg_affiliate_applications_updated_at
BEFORE UPDATE ON public.affiliate_applications
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_updated_at();

ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'affiliate_applications'
      AND policyname = 'affiliate_applications_admin_all'
  ) THEN
    CREATE POLICY "affiliate_applications_admin_all"
    ON public.affiliate_applications
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
