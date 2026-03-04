"use client";

import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import SeoMeta from "@/components/SeoMeta";
import BlogArticleCard from "@/components/blog/BlogArticleCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BlogArticle, mapBlogArticleRecord } from "@/lib/blog";

const normalizeSearch = (value: string) => value.trim().replace(/\s+/g, " ");

const BlogSearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [queryText, setQueryText] = useState(initialQ);
  const normalizedQ = useMemo(() => normalizeSearch(initialQ), [initialQ]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["blog", "search", normalizedQ],
    enabled: normalizedQ.length >= 2,
    queryFn: async (): Promise<BlogArticle[]> => {
      const escaped = normalizedQ.replace(/,/g, " ");
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
        .or(`title.ilike.%${escaped}%,excerpt.ilike.%${escaped}%,content_html.ilike.%${escaped}%`)
        .order("published_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data || []).map(mapBlogArticleRecord);
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cleaned = normalizeSearch(queryText);
    if (!cleaned) {
      setSearchParams({});
      return;
    }
    setSearchParams({ q: cleaned });
  };

  return (
    <Layout>
      <SeoMeta
        title="Buscar no Blog"
        description="Pesquise conteúdos do blog HomeCare Match por temas, termos técnicos e boas práticas."
      />

      <div className="container mx-auto space-y-8 px-4">
        <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-success/5 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Blog HomeCare Match</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Busca de artigos</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
            Digite um tema para encontrar publicações sobre carreira, gestão, cuidado e atendimento domiciliar.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-2 md:flex-row">
            <Input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Ex: cuidados paliativos, escala de técnicos, segurança do paciente..."
              className="h-11 md:max-w-2xl"
            />
            <Button type="submit" className="h-11 gap-2">
              <Search className="h-4 w-4" />
              Buscar
            </Button>
            <Button asChild variant="ghost" className="h-11">
              <Link to="/blog">Voltar</Link>
            </Button>
          </form>
        </section>

        {normalizedQ.length < 2 ? (
          <section className="rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-bold">Digite ao menos 2 caracteres</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Exemplo de busca: "gestão de equipe", "cuidador", "home care".
            </p>
          </section>
        ) : isLoading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : results.length > 0 ? (
          <section className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {results.length} resultado(s) para <strong>"{normalizedQ}"</strong>
            </p>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {results.map((article) => (
                <BlogArticleCard key={article.id} article={article} />
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-bold">Nenhum resultado encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tente outros termos ou navegue por categorias e tags.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/blog/categorias">Categorias</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/blog/tags">Tags</Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default BlogSearchPage;
