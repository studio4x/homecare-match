CREATE TABLE IF NOT EXISTS public.whatsapp_commercial_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  placement_id TEXT NOT NULL,
  origin_tag TEXT NOT NULL,
  button_label TEXT,
  page_path TEXT,
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  whatsapp_number TEXT
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_commercial_clicks_created_at
  ON public.whatsapp_commercial_clicks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_commercial_clicks_placement
  ON public.whatsapp_commercial_clicks (placement_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_commercial_clicks_origin_tag
  ON public.whatsapp_commercial_clicks (origin_tag);

ALTER TABLE public.whatsapp_commercial_clicks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_commercial_clicks'
      AND policyname = 'whatsapp_commercial_clicks_admin_read'
  ) THEN
    CREATE POLICY "whatsapp_commercial_clicks_admin_read"
    ON public.whatsapp_commercial_clicks
    FOR SELECT TO authenticated
    USING (check_is_admin());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.track_whatsapp_commercial_click(
  p_placement_id TEXT,
  p_origin_tag TEXT DEFAULT NULL,
  p_button_label TEXT DEFAULT NULL,
  p_page_path TEXT DEFAULT NULL,
  p_page_url TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_whatsapp_number TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_click_id UUID;
  v_placement TEXT;
  v_origin_tag TEXT;
BEGIN
  v_placement := lower(coalesce(btrim(p_placement_id), ''));
  IF v_placement = '' THEN
    RETURN NULL;
  END IF;

  v_origin_tag := coalesce(nullif(btrim(p_origin_tag), ''), format('[origem=%s]', v_placement));

  INSERT INTO public.whatsapp_commercial_clicks (
    user_id,
    placement_id,
    origin_tag,
    button_label,
    page_path,
    page_url,
    referrer,
    user_agent,
    whatsapp_number
  )
  VALUES (
    auth.uid(),
    left(v_placement, 80),
    left(v_origin_tag, 160),
    nullif(left(coalesce(btrim(p_button_label), ''), 120), ''),
    nullif(left(coalesce(btrim(p_page_path), ''), 240), ''),
    nullif(left(coalesce(btrim(p_page_url), ''), 800), ''),
    nullif(left(coalesce(btrim(p_referrer), ''), 800), ''),
    nullif(left(coalesce(btrim(p_user_agent), ''), 800), ''),
    nullif(left(coalesce(btrim(p_whatsapp_number), ''), 32), '')
  )
  RETURNING id INTO v_click_id;

  RETURN v_click_id;
END;
$$;

REVOKE ALL ON FUNCTION public.track_whatsapp_commercial_click(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_whatsapp_commercial_click(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
