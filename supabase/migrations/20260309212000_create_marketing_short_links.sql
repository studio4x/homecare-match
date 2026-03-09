CREATE TABLE IF NOT EXISTS public.marketing_short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  target_url TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketing_short_links_slug_format
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

ALTER TABLE IF EXISTS public.marketing_short_links
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS target_url TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.marketing_short_links
SET
  name = COALESCE(NULLIF(trim(name), ''), 'Link sem nome'),
  slug = COALESCE(NULLIF(trim(lower(slug)), ''), 'link-' || substring(id::text, 1, 8)),
  target_url = COALESCE(NULLIF(trim(target_url), ''), 'https://www.homecarematch.com.br/'),
  is_active = COALESCE(is_active, true),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.marketing_short_links
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN target_url SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_short_links_slug_lower
  ON public.marketing_short_links (lower(slug));

CREATE INDEX IF NOT EXISTS idx_marketing_short_links_active
  ON public.marketing_short_links (is_active);

CREATE INDEX IF NOT EXISTS idx_marketing_short_links_created_at
  ON public.marketing_short_links (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_marketing_short_links_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.slug = lower(trim(NEW.slug));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketing_short_links_updated_at ON public.marketing_short_links;
CREATE TRIGGER trg_marketing_short_links_updated_at
BEFORE UPDATE ON public.marketing_short_links
FOR EACH ROW
EXECUTE FUNCTION public.set_marketing_short_links_updated_at();

ALTER TABLE public.marketing_short_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_short_links'
      AND policyname = 'marketing_short_links_public_select_active'
  ) THEN
    CREATE POLICY "marketing_short_links_public_select_active"
    ON public.marketing_short_links
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_short_links'
      AND policyname = 'marketing_short_links_admin_all'
  ) THEN
    CREATE POLICY "marketing_short_links_admin_all"
    ON public.marketing_short_links
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
