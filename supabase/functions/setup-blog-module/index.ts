import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let client: Client | null = null;
  try {
    if (!SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL ausente.");
    if (!SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL ausente.");

    const authHeader = req.headers.get("authorization");
    const jwtToken = authHeader?.replace("Bearer ", "").trim() || "";
    if (!jwtToken) {
      return new Response(JSON.stringify({ error: "Autenticacao ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(jwtToken);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuario nao autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = !!profile?.is_admin || profile?.role === "admin";
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Nao autorizado para sincronizar modulo Blog." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    client = new Client(SUPABASE_DB_URL);
    await client.connect();

    const sql = `
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
    `;

    await client.queryObject(sql);

    const tables = ["blog_categories", "blog_tags", "blog_articles", "blog_article_tags"];
    const verification = await client.queryObject<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(ARRAY['blog_categories','blog_tags','blog_articles','blog_article_tags']);
    `);
    const existing = new Set(verification.rows.map((row) => row.table_name));
    const missing = tables.filter((table) => !existing.has(table));
    if (missing.length > 0) {
      throw new Error(`Tabelas ausentes apos sincronizacao: ${missing.join(", ")}`);
    }

    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Modulo Blog sincronizado com sucesso." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    try { await client?.end(); } catch {}
    return new Response(JSON.stringify({ error: "Erro ao sincronizar modulo Blog.", details: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
