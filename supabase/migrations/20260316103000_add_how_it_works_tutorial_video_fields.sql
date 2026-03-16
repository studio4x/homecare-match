ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS video_url_how_it_works_professionals TEXT,
  ADD COLUMN IF NOT EXISTS video_url_how_it_works_companies TEXT,
  ADD COLUMN IF NOT EXISTS video_url_how_it_works_families TEXT,
  ADD COLUMN IF NOT EXISTS video_storage_path_how_it_works_professionals TEXT,
  ADD COLUMN IF NOT EXISTS video_mime_how_it_works_professionals TEXT,
  ADD COLUMN IF NOT EXISTS video_storage_path_how_it_works_companies TEXT,
  ADD COLUMN IF NOT EXISTS video_mime_how_it_works_companies TEXT,
  ADD COLUMN IF NOT EXISTS video_storage_path_how_it_works_families TEXT,
  ADD COLUMN IF NOT EXISTS video_mime_how_it_works_families TEXT;
