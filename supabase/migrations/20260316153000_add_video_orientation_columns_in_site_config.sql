ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS video_orientation_professionals TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS video_orientation_companies TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS video_orientation_families TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS video_orientation_how_it_works_professionals TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS video_orientation_how_it_works_companies TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS video_orientation_how_it_works_families TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS video_orientation_onboarding TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS video_orientation_onboarding_company TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS video_orientation_onboarding_family TEXT DEFAULT 'auto';

UPDATE public.site_config
SET
  video_orientation_professionals = COALESCE(NULLIF(video_orientation_professionals, ''), 'auto'),
  video_orientation_companies = COALESCE(NULLIF(video_orientation_companies, ''), 'auto'),
  video_orientation_families = COALESCE(NULLIF(video_orientation_families, ''), 'auto'),
  video_orientation_how_it_works_professionals = COALESCE(NULLIF(video_orientation_how_it_works_professionals, ''), 'auto'),
  video_orientation_how_it_works_companies = COALESCE(NULLIF(video_orientation_how_it_works_companies, ''), 'auto'),
  video_orientation_how_it_works_families = COALESCE(NULLIF(video_orientation_how_it_works_families, ''), 'auto'),
  video_orientation_onboarding = COALESCE(NULLIF(video_orientation_onboarding, ''), 'auto'),
  video_orientation_onboarding_company = COALESCE(NULLIF(video_orientation_onboarding_company, ''), 'auto'),
  video_orientation_onboarding_family = COALESCE(NULLIF(video_orientation_onboarding_family, ''), 'auto');
