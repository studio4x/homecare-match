"use client";

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout/Layout";
import SeoMeta from "@/components/SeoMeta";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BlogTag } from "@/lib/blog";

const BlogTagsPage = () => {
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["blog", "tags"],
    queryFn: async (): Promise<BlogTag[]> => {
      const { data, error } = await supabase
        .from("blog_tags")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).map((item: any) => ({
        id: String(item.id),
        name: item.name || "",
        slug: item.slug || "",
        description: item.description || null,
        seo_title: item.seo_title || null,
        seo_description: item.seo_description || null,
        seo_canonical_url: item.seo_canonical_url || null,
        seo_robots: item.seo_robots || null,
        seo_og_title: item.seo_og_title || null,
        seo_og_description: item.seo_og_description || null,
        seo_og_image_url: item.seo_og_image_url || null,
        schema_json: item.schema_json || null,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));
    },
  });

  const { data: publishedTags = [], isLoading: loadingCounts } = useQuery({
    queryKey: ["blog", "tags", "counts"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("blog_articles")
        .select(`
          id,
          blog_article_tags (
            tag:blog_tags (id)
          )
        `)
        .eq("status", "published");

      if (error) throw error;

      const result: string[] = [];
      (data || []).forEach((article: any) => {
        const links = Array.isArray(article.blog_article_tags) ? article.blog_article_tags : [];
        links.forEach((link: any) => {
          if (link?.tag?.id) result.push(String(link.tag.id));
        });
      });
      return result;
    },
  });

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    publishedTags.forEach((tagId) => map.set(tagId, (map.get(tagId) || 0) + 1));
    return map;
  }, [publishedTags]);

  return (
    <Layout>
      <SeoMeta
        title="Tags do Blog"
        description="Encontre conteúdos por tags específicas sobre Home Care, rotinas assistenciais e gestão."
      />

      <div className="container mx-auto space-y-8 px-4">
        <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-success/5 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Blog HomeCare Match</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Tags</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
            Navegue por palavras-chave e encontre rapidamente os assuntos mais relevantes.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link to="/blog">Voltar para artigos</Link>
            </Button>
          </div>
        </section>

        {isLoading || loadingCounts ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : tags.length > 0 ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tags.map((tag) => {
              const count = tagCounts.get(tag.id) || 0;
              return (
                <Card key={tag.id} className="border-border/80">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="line-clamp-1">#{tag.name}</span>
                      <Badge variant="secondary">{count} artigo(s)</Badge>
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {tag.description || "Tag de classificação de conteúdo do blog."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to={`/blog?tag=${tag.slug}`}>Ver artigos</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-bold">Nenhuma tag cadastrada</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ainda não existem tags disponíveis para navegação.
            </p>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default BlogTagsPage;
