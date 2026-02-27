-- PWA configuration fields
ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS pwa_app_name TEXT DEFAULT 'HomeCare Match',
  ADD COLUMN IF NOT EXISTS pwa_short_name TEXT DEFAULT 'HomeCare',
  ADD COLUMN IF NOT EXISTS pwa_description TEXT DEFAULT 'Conectando profissionais de saúde às melhores oportunidades em Home Care.',
  ADD COLUMN IF NOT EXISTS pwa_theme_color TEXT DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS pwa_background_color TEXT DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS pwa_icon_192_url TEXT,
  ADD COLUMN IF NOT EXISTS pwa_icon_512_url TEXT,
  ADD COLUMN IF NOT EXISTS pwa_maskable_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS pwa_install_image_url TEXT,
  ADD COLUMN IF NOT EXISTS pwa_install_title TEXT DEFAULT 'Instale o app HomeCare Match',
  ADD COLUMN IF NOT EXISTS pwa_install_description TEXT DEFAULT 'Acesse mais rápido pelo seu celular, direto da tela inicial.',
  ADD COLUMN IF NOT EXISTS pwa_screenshots_json JSONB DEFAULT '[]'::jsonb;

UPDATE public.site_config
SET
  pwa_app_name = COALESCE(NULLIF(pwa_app_name, ''), 'HomeCare Match'),
  pwa_short_name = COALESCE(NULLIF(pwa_short_name, ''), 'HomeCare'),
  pwa_description = COALESCE(NULLIF(pwa_description, ''), 'Conectando profissionais de saúde às melhores oportunidades em Home Care.'),
  pwa_theme_color = COALESCE(NULLIF(pwa_theme_color, ''), '#0f172a'),
  pwa_background_color = COALESCE(NULLIF(pwa_background_color, ''), '#ffffff'),
  pwa_install_title = COALESCE(NULLIF(pwa_install_title, ''), 'Instale o app HomeCare Match'),
  pwa_install_description = COALESCE(NULLIF(pwa_install_description, ''), 'Acesse mais rápido pelo seu celular, direto da tela inicial.')
WHERE id = 1;

NOTIFY pgrst, 'reload schema';
