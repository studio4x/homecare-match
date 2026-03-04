"use client";

import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import SeoMeta from "@/components/SeoMeta";
import BlogArticleCard from "@/components/blog/BlogArticleCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BlogArticle, mapBlogArticleRecord } from "@/lib/blog";

const BlogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("categoria") || "";
  const selectedTag = searchParams.get("tag") || "";

  const {
    data: articles = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["blog", "articles", "published"],
    queryFn: async (): Promise<BlogArticle[]> => {
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
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(mapBlogArticleRecord);
    },
  });

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    articles.forEach((article) => {
      if (!article.category?.slug) return;
      map.set(article.category.slug, article.category.name);
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [articles]);

  const tags = useMemo(() => {
    const map = new Map<string, string>();
    articles.forEach((article) => {
      article.tags.forEach((tag) => map.set(tag.slug, tag.name));
    });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const categoryOk = selectedCategory ? article.category?.slug === selectedCategory : true;
      const tagOk = selectedTag ? article.tags.some((tag) => tag.slug === selectedTag) : true;
      return categoryOk && tagOk;
    });
  }, [articles, selectedCategory, selectedTag]);

  const clearFilters = () => setSearchParams({});

  const canonicalUrl =
    typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}${window.location.search}` : "";

  return (
    <Layout>
      <SeoMeta
        title="Blog de Home Care"
        description="Artigos sobre cuidados domiciliares, carreira em saúde, gestão e melhores práticas em Home Care."
        canonicalUrl={canonicalUrl}
      />

      <div className="container mx-auto space-y-8 px-4">
        <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-success/5 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Blog HomeCare Match</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
            Conteúdo para quem vive o cuidado no dia a dia
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
            Guias práticos para profissionais, empresas e famílias sobre recrutamento, qualidade assistencial e
            segurança no atendimento domiciliar.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/blog/busca" className="gap-2">
                <Search className="h-4 w-4" />
                Buscar no blog
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/blog/categorias">Categorias</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/blog/tags">Tags</Link>
            </Button>
          </div>
        </section>

        {(selectedCategory || selectedTag) && (
          <section className="flex flex-wrap items-center gap-2">
            {selectedCategory && (
              <Badge variant="secondary" className="text-xs">
                Categoria: {categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory}
              </Badge>
            )}
            {selectedTag && (
              <Badge variant="secondary" className="text-xs">
                Tag: {tags.find((t) => t.slug === selectedTag)?.name || selectedTag}
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </section>
        )}

        {categories.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categorias</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.slug}
                  type="button"
                  onClick={() => setSearchParams({ categoria: category.slug })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategory === category.slug
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {isLoading ? (
          <div className="flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredArticles.length > 0 ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredArticles.map((article) => (
              <BlogArticleCard key={article.id} article={article} />
            ))}
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-bold">Nenhum artigo encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tente remover os filtros ou atualizar a página para recarregar os conteúdos.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
              <Button variant="ghost" onClick={() => refetch()}>
                Recarregar
              </Button>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default BlogPage;
