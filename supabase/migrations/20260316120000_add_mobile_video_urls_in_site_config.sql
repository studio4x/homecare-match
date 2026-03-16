ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS video_url_professionals_mobile TEXT,
  ADD COLUMN IF NOT EXISTS video_url_companies_mobile TEXT,
  ADD COLUMN IF NOT EXISTS video_url_families_mobile TEXT,
  ADD COLUMN IF NOT EXISTS video_url_how_it_works_professionals_mobile TEXT,
  ADD COLUMN IF NOT EXISTS video_url_how_it_works_companies_mobile TEXT,
  ADD COLUMN IF NOT EXISTS video_url_how_it_works_families_mobile TEXT,
  ADD COLUMN IF NOT EXISTS video_url_onboarding_mobile TEXT,
  ADD COLUMN IF NOT EXISTS video_url_onboarding_company_mobile TEXT,
  ADD COLUMN IF NOT EXISTS video_url_onboarding_family_mobile TEXT;
