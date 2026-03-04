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
import { BlogCategory } from "@/lib/blog";

const BlogCategoriesPage = () => {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["blog", "categories"],
    queryFn: async (): Promise<BlogCategory[]> => {
      const { data, error } = await supabase
        .from("blog_categories")
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

  const { data: publishedCategoryIds = [], isLoading: loadingCounts } = useQuery({
    queryKey: ["blog", "categories", "counts"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("blog_articles")
        .select("category_id")
        .eq("status", "published")
        .not("category_id", "is", null);
      if (error) throw error;
      return (data || []).map((item: any) => String(item.category_id));
    },
  });

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    publishedCategoryIds.forEach((categoryId) => {
      map.set(categoryId, (map.get(categoryId) || 0) + 1);
    });
    return map;
  }, [publishedCategoryIds]);

  return (
    <Layout>
      <SeoMeta
        title="Categorias do Blog"
        description="Navegue por categorias e encontre conteúdos relevantes sobre Home Care, saúde e cuidados domiciliares."
      />

      <div className="container mx-auto space-y-8 px-4">
        <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-success/5 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Blog HomeCare Match</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Categorias</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
            Explore os temas principais do nosso blog e encontre conteúdo alinhado ao seu contexto.
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
        ) : categories.length > 0 ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => {
              const count = categoryCounts.get(category.id) || 0;
              return (
                <Card key={category.id} className="border-border/80">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="line-clamp-1">{category.name}</span>
                      <Badge variant="secondary">{count} artigo(s)</Badge>
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {category.description || "Categoria de conteúdo do blog HomeCare Match."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="outline" className="w-full">
                      <Link to={`/blog?categoria=${category.slug}`}>Ver artigos</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-bold">Nenhuma categoria cadastrada</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ainda não existem categorias disponíveis para navegação.
            </p>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default BlogCategoriesPage;
