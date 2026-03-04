ALTER TABLE IF EXISTS public.blog_articles
ADD COLUMN IF NOT EXISTS source_reference_url TEXT;

ALTER TABLE IF EXISTS public.blog_categories
ADD COLUMN IF NOT EXISTS parent_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'blog_categories'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_categories_parent_id_fkey'
      AND conrelid = 'public.blog_categories'::regclass
  ) THEN
    ALTER TABLE public.blog_categories
    ADD CONSTRAINT blog_categories_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES public.blog_categories(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_blog_categories_parent_id
ON public.blog_categories(parent_id);
