"use client";

import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Layout from "@/components/layout/Layout";
import SeoMeta from "@/components/SeoMeta";
import SafeHTML from "@/components/SafeHTML";
import BlogArticleCard from "@/components/blog/BlogArticleCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock3, Loader2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BlogArticle, articleUrl, getExcerptFromHtml, mapBlogArticleRecord, stripHtml } from "@/lib/blog";

const BlogArticlePage = () => {
  const { slug = "" } = useParams();

  const {
    data: article,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["blog", "article", slug],
    enabled: !!slug,
    queryFn: async (): Promise<BlogArticle | null> => {
      const { data, error } = await supabase
        .from("blog_articles")
        .select(`
          id,
          title,
          slug,
          excerpt,
          cover_image_url,
          content_html,
          status,
          published_at,
          author_name,
          reading_time_minutes,
          featured,
          category_id,
          seo_title,
          seo_description,
          seo_canonical_url,
          seo_robots,
          seo_og_title,
          seo_og_description,
          seo_og_image_url,
          focus_keyword,
          schema_json,
          created_at,
          updated_at,
          category:blog_categories (
            id,
            name,
            slug,
            description,
            seo_title,
            seo_description,
            seo_canonical_url,
            seo_robots,
            seo_og_title,
            seo_og_description,
            seo_og_image_url,
            schema_json,
            created_at,
            updated_at
          ),
          blog_article_tags (
            tag:blog_tags (
              id,
              name,
              slug,
              description,
              seo_title,
              seo_description,
              seo_canonical_url,
              seo_robots,
              seo_og_title,
              seo_og_description,
              seo_og_image_url,
              schema_json,
              created_at,
              updated_at
            )
          )
        `)
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapBlogArticleRecord(data);
    },
  });

  const { data: relatedArticles = [] } = useQuery({
    queryKey: ["blog", "article", slug, "related", article?.category_id || "none"],
    enabled: !!article?.id,
    queryFn: async (): Promise<BlogArticle[]> => {
      const baseQuery = supabase
        .from("blog_articles")
        .select(`
          id,
          title,
          slug,
          excerpt,
          cover_image_url,
          content_html,
          status,
          published_at,
          author_name,
          reading_time_minutes,
          featured,
          category_id,
          seo_title,
          seo_description,
          seo_canonical_url,
          seo_robots,
          seo_og_title,
          seo_og_description,
          seo_og_image_url,
          focus_keyword,
          schema_json,
          created_at,
          updated_at,
          category:blog_categories (
            id,
            name,
            slug,
            description,
            seo_title,
            seo_description,
            seo_canonical_url,
            seo_robots,
            seo_og_title,
            seo_og_description,
            seo_og_image_url,
            schema_json,
            created_at,
            updated_at
          ),
          blog_article_tags (
            tag:blog_tags (
              id,
              name,
              slug,
              description,
              seo_title,
              seo_description,
              seo_canonical_url,
              seo_robots,
              seo_og_title,
              seo_og_description,
              seo_og_image_url,
              schema_json,
              created_at,
              updated_at
            )
          )
        `)
        .eq("status", "published")
        .neq("id", article?.id)
        .order("published_at", { ascending: false })
        .limit(3);

      const query = article?.category_id ? baseQuery.eq("category_id", article.category_id) : baseQuery;
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapBlogArticleRecord);
    },
  });

  const canonicalUrl = useMemo(() => {
    if (article?.seo_canonical_url) return article.seo_canonical_url;
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${articleUrl(article?.slug || slug)}`;
  }, [article?.seo_canonical_url, article?.slug, slug]);

  const seoTitle = article?.seo_title || article?.title || "Artigo";
  const seoDescription =
    article?.seo_description ||
    article?.excerpt ||
    getExcerptFromHtml(article?.content_html || "", 170) ||
    "Conteúdo do blog HomeCare Match.";

  const articleSchema = useMemo(() => {
    if (!article) return null;

    const primarySchema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description: seoDescription,
      image: article.cover_image_url ? [article.cover_image_url] : undefined,
      datePublished: article.published_at || article.created_at,
      dateModified: article.updated_at || article.created_at || article.published_at,
      author: {
        "@type": "Organization",
        name: article.author_name || "Equipe HomeCare Match",
      },
      publisher: {
        "@type": "Organization",
        name: "HomeCare Match",
        logo: {
          "@type": "ImageObject",
          url:
            typeof window !== "undefined"
              ? `${window.location.origin}/icon-512x512.png`
              : "/icon-512x512.png",
        },
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      keywords: article.tags.map((tag) => tag.name).join(", "),
      articleBody: stripHtml(article.content_html || "").slice(0, 4000),
    };

    const extraSchema =
      article.schema_json && typeof article.schema_json === "object" ? article.schema_json : null;

    return extraSchema ? [primarySchema, extraSchema] : primarySchema;
  }, [article, canonicalUrl, seoDescription]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (isError || !article) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-14">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="text-2xl font-bold">Artigo não encontrado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este conteúdo não está disponível ou ainda não foi publicado.
            </p>
            <Button asChild className="mt-5">
              <Link to="/blog">Voltar para o Blog</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const publishedDate = article.published_at || article.created_at;

  return (
    <Layout>
      <SeoMeta
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={canonicalUrl}
        imageUrl={article.seo_og_image_url || article.cover_image_url || undefined}
        robots={article.seo_robots || "index,follow"}
        jsonLd={articleSchema || undefined}
      />

      <div className="container mx-auto space-y-10 px-4">
        <article className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {article.category && (
                <Link to={`/blog?categoria=${article.category.slug}`}>
                  <Badge variant="secondary">{article.category.name}</Badge>
                </Link>
              )}
              {article.tags.map((tag) => (
                <Link key={tag.id} to={`/blog?tag=${tag.slug}`}>
                  <Badge variant="outline">#{tag.name}</Badge>
                </Link>
              ))}
            </div>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">{article.title}</h1>
            <p className="text-base text-muted-foreground">{seoDescription}</p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" />
                {article.author_name || "Equipe HomeCare Match"}
              </span>
              {publishedDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {format(new Date(publishedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-4 w-4" />
                {article.reading_time_minutes || 1} min de leitura
              </span>
            </div>
          </div>

          {article.cover_image_url && (
            <div className="overflow-hidden rounded-2xl border border-border">
              <img src={article.cover_image_url} alt={article.title} className="h-full w-full object-cover" />
            </div>
          )}

          <SafeHTML
            content={article.content_html || ""}
            className="prose-headings:font-bold prose-p:text-foreground/90 prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
          />
        </article>

        {relatedArticles.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Artigos relacionados</h2>
              <Button asChild variant="ghost">
                <Link to="/blog">Ver todos</Link>
              </Button>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {relatedArticles.map((related) => (
                <BlogArticleCard key={related.id} article={related} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default BlogArticlePage;
