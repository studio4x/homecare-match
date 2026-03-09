ALTER TABLE IF EXISTS public.marketing_short_links
  ADD COLUMN IF NOT EXISTS click_count BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signup_count BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_signup_at TIMESTAMPTZ;

UPDATE public.marketing_short_links
SET
  click_count = COALESCE(click_count, 0),
  signup_count = COALESCE(signup_count, 0);

ALTER TABLE public.marketing_short_links
  ALTER COLUMN click_count SET NOT NULL,
  ALTER COLUMN signup_count SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.marketing_short_link_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id UUID NOT NULL REFERENCES public.marketing_short_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (short_link_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_short_link_signups_short_link_id
  ON public.marketing_short_link_signups(short_link_id);

CREATE INDEX IF NOT EXISTS idx_marketing_short_link_signups_user_id
  ON public.marketing_short_link_signups(user_id);

CREATE OR REPLACE FUNCTION public.track_marketing_short_link_click(
  p_slug TEXT,
  p_visitor_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN NULL;
  END IF;

  UPDATE public.marketing_short_links
  SET
    click_count = COALESCE(click_count, 0) + 1,
    last_clicked_at = now(),
    updated_at = now()
  WHERE lower(slug) = lower(btrim(p_slug))
    AND is_active = true
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_marketing_short_link_signup(
  p_slug TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_short_link_id UUID;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN false;
  END IF;

  SELECT id
    INTO v_short_link_id
  FROM public.marketing_short_links
  WHERE lower(slug) = lower(btrim(p_slug))
  LIMIT 1;

  IF v_short_link_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.marketing_short_link_signups (short_link_id, user_id)
    VALUES (v_short_link_id, p_user_id)
    ON CONFLICT (short_link_id, user_id) DO NOTHING;

    IF NOT FOUND THEN
      RETURN false;
    END IF;
  END IF;

  UPDATE public.marketing_short_links
  SET
    signup_count = COALESCE(signup_count, 0) + 1,
    last_signup_at = now(),
    updated_at = now()
  WHERE id = v_short_link_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.track_marketing_short_link_click(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_marketing_short_link_signup(TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.track_marketing_short_link_click(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_marketing_short_link_signup(TEXT, UUID) TO anon, authenticated;

ALTER TABLE public.marketing_short_link_signups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_short_link_signups'
      AND policyname = 'marketing_short_link_signups_admin_all'
  ) THEN
    CREATE POLICY "marketing_short_link_signups_admin_all"
    ON public.marketing_short_link_signups
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
