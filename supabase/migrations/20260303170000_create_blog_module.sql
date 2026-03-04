CREATE TABLE IF NOT EXISTS public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  seo_title TEXT,
  seo_description TEXT,
  seo_canonical_url TEXT,
  seo_robots TEXT NOT NULL DEFAULT 'index,follow',
  seo_og_title TEXT,
  seo_og_description TEXT,
  seo_og_image_url TEXT,
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  seo_title TEXT,
  seo_description TEXT,
  seo_canonical_url TEXT,
  seo_robots TEXT NOT NULL DEFAULT 'index,follow',
  seo_og_title TEXT,
  seo_og_description TEXT,
  seo_og_image_url TEXT,
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  cover_image_url TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  author_name TEXT NOT NULL DEFAULT 'Equipe HomeCare Match',
  reading_time_minutes INTEGER NOT NULL DEFAULT 1,
  featured BOOLEAN NOT NULL DEFAULT false,
  category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  seo_title TEXT,
  seo_description TEXT,
  seo_canonical_url TEXT,
  seo_robots TEXT NOT NULL DEFAULT 'index,follow',
  seo_og_title TEXT,
  seo_og_description TEXT,
  seo_og_image_url TEXT,
  focus_keyword TEXT,
  schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_article_tags (
  article_id UUID NOT NULL REFERENCES public.blog_articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, tag_id)
);

CREATE OR REPLACE FUNCTION public.set_blog_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_blog_article_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at = now();
  END IF;

  IF NEW.status = 'draft' THEN
    NEW.published_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_categories_updated_at ON public.blog_categories;
CREATE TRIGGER trg_blog_categories_updated_at
BEFORE UPDATE ON public.blog_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_blog_updated_at();

DROP TRIGGER IF EXISTS trg_blog_tags_updated_at ON public.blog_tags;
CREATE TRIGGER trg_blog_tags_updated_at
BEFORE UPDATE ON public.blog_tags
FOR EACH ROW
EXECUTE FUNCTION public.set_blog_updated_at();

DROP TRIGGER IF EXISTS trg_blog_articles_updated_at ON public.blog_articles;
CREATE TRIGGER trg_blog_articles_updated_at
BEFORE UPDATE ON public.blog_articles
FOR EACH ROW
EXECUTE FUNCTION public.set_blog_updated_at();

DROP TRIGGER IF EXISTS trg_blog_articles_status ON public.blog_articles;
CREATE TRIGGER trg_blog_articles_status
BEFORE INSERT OR UPDATE ON public.blog_articles
FOR EACH ROW
EXECUTE FUNCTION public.set_blog_article_published_at();

CREATE INDEX IF NOT EXISTS idx_blog_articles_status_published_at ON public.blog_articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_articles_category_id ON public.blog_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_blog_article_tags_tag_id ON public.blog_article_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_blog_categories_slug ON public.blog_categories(slug);
CREATE INDEX IF NOT EXISTS idx_blog_tags_slug ON public.blog_tags(slug);
CREATE INDEX IF NOT EXISTS idx_blog_articles_search ON public.blog_articles
USING GIN (to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content_html, '')));

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_article_tags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_categories' AND policyname = 'blog_categories_public_select'
  ) THEN
    CREATE POLICY "blog_categories_public_select"
    ON public.blog_categories
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_categories' AND policyname = 'blog_categories_admin_all'
  ) THEN
    CREATE POLICY "blog_categories_admin_all"
    ON public.blog_categories
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_tags' AND policyname = 'blog_tags_public_select'
  ) THEN
    CREATE POLICY "blog_tags_public_select"
    ON public.blog_tags
    FOR SELECT
    TO anon, authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_tags' AND policyname = 'blog_tags_admin_all'
  ) THEN
    CREATE POLICY "blog_tags_admin_all"
    ON public.blog_tags
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_articles' AND policyname = 'blog_articles_public_select_published'
  ) THEN
    CREATE POLICY "blog_articles_public_select_published"
    ON public.blog_articles
    FOR SELECT
    TO anon, authenticated
    USING (status = 'published');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_articles' AND policyname = 'blog_articles_admin_all'
  ) THEN
    CREATE POLICY "blog_articles_admin_all"
    ON public.blog_articles
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_article_tags' AND policyname = 'blog_article_tags_public_select'
  ) THEN
    CREATE POLICY "blog_article_tags_public_select"
    ON public.blog_article_tags
    FOR SELECT
    TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.blog_articles a
        WHERE a.id = blog_article_tags.article_id
          AND a.status = 'published'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_article_tags' AND policyname = 'blog_article_tags_admin_all'
  ) THEN
    CREATE POLICY "blog_article_tags_admin_all"
    ON public.blog_article_tags
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
