ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS pwa_assets_json JSONB DEFAULT '{}'::jsonb;

UPDATE public.site_config
SET pwa_assets_json = COALESCE(pwa_assets_json, '{}'::jsonb)
WHERE id = 1;

NOTIFY pgrst, 'reload schema';
