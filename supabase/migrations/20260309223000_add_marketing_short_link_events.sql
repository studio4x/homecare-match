CREATE TABLE IF NOT EXISTS public.marketing_short_link_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_link_id UUID NOT NULL REFERENCES public.marketing_short_links(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'signup')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  visitor_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_short_link_events_short_link_id
  ON public.marketing_short_link_events(short_link_id);

CREATE INDEX IF NOT EXISTS idx_marketing_short_link_events_event_type
  ON public.marketing_short_link_events(event_type);

CREATE INDEX IF NOT EXISTS idx_marketing_short_link_events_occurred_at
  ON public.marketing_short_link_events(occurred_at DESC);

ALTER TABLE public.marketing_short_link_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_short_link_events'
      AND policyname = 'marketing_short_link_events_admin_all'
  ) THEN
    CREATE POLICY "marketing_short_link_events_admin_all"
    ON public.marketing_short_link_events
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;
END
$$;

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
  v_visitor_id TEXT;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN NULL;
  END IF;

  v_visitor_id := NULLIF(btrim(p_visitor_id), '');

  UPDATE public.marketing_short_links
  SET
    click_count = COALESCE(click_count, 0) + 1,
    last_clicked_at = now(),
    updated_at = now()
  WHERE lower(slug) = lower(btrim(p_slug))
    AND is_active = true
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.marketing_short_link_events (
    short_link_id,
    event_type,
    visitor_id,
    occurred_at
  ) VALUES (
    v_id,
    'click',
    v_visitor_id,
    now()
  );

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

  INSERT INTO public.marketing_short_link_events (
    short_link_id,
    event_type,
    user_id,
    occurred_at
  ) VALUES (
    v_short_link_id,
    'signup',
    p_user_id,
    now()
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.track_marketing_short_link_click(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_marketing_short_link_signup(TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.track_marketing_short_link_click(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_marketing_short_link_signup(TEXT, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
