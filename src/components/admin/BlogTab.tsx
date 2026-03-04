"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { estimateReadingTime, generateSlug } from "@/lib/blog";
import {
  Bot,
  Database,
  Edit2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

type BlogSeoForm = {
  seo_title: string;
  seo_description: string;
  seo_canonical_url: string;
  seo_robots: string;
  seo_og_title: string;
  seo_og_description: string;
  seo_og_image_url: string;
  schema_json: string;
};

type BlogCategoryForm = {
  id?: string | null;
  name: string;
  slug: string;
  description: string;
} & BlogSeoForm;

type BlogTagForm = {
  id?: string | null;
  name: string;
  slug: string;
  description: string;
} & BlogSeoForm;

type BlogArticleForm = {
  id?: string | null;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_html: string;
  status: "draft" | "published";
  published_at: string;
  author_name: string;
  reading_time_minutes: number;
  featured: boolean;
  category_id: string;
  tag_ids: string[];
  focus_keyword: string;
} & BlogSeoForm;

const emptySeoForm: BlogSeoForm = {
  seo_title: "",
  seo_description: "",
  seo_canonical_url: "",
  seo_robots: "index,follow",
  seo_og_title: "",
  seo_og_description: "",
  seo_og_image_url: "",
  schema_json: "{}",
};

const emptyCategoryForm: BlogCategoryForm = {
  id: null,
  name: "",
  slug: "",
  description: "",
  ...emptySeoForm,
};

const emptyTagForm: BlogTagForm = {
  id: null,
  name: "",
  slug: "",
  description: "",
  ...emptySeoForm,
};

const emptyArticleForm: BlogArticleForm = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  cover_image_url: "",
  content_html: "",
  status: "draft",
  published_at: "",
  author_name: "Equipe HomeCare Match",
  reading_time_minutes: 1,
  featured: false,
  category_id: "",
  tag_ids: [],
  focus_keyword: "",
  ...emptySeoForm,
};

const parseSchemaJson = (value: string) => {
  const clean = value?.trim() || "{}";
  try {
    const parsed = JSON.parse(clean);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { error: "O Schema JSON deve ser um objeto JSON válido." };
    }
    return { value: parsed };
  } catch {
    return { error: "Schema JSON inválido. Verifique a sintaxe." };
  }
};

const BlogSeoFields = ({
  value,
  onChange,
}: {
  value: BlogSeoForm;
  onChange: (patch: Partial<BlogSeoForm>) => void;
}) => (
  <div className="space-y-4 rounded-xl border border-border/70 bg-secondary/10 p-4">
    <div>
      <p className="text-sm font-semibold">SEO e Schema</p>
      <p className="text-xs text-muted-foreground">
        Configure metadata para Google e redes sociais, além de schema customizado.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Título SEO</Label>
        <Input value={value.seo_title} onChange={(e) => onChange({ seo_title: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Robots</Label>
        <Input
          value={value.seo_robots}
          onChange={(e) => onChange({ seo_robots: e.target.value })}
          placeholder="index,follow"
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label>Descrição SEO</Label>
      <Textarea
        value={value.seo_description}
        onChange={(e) => onChange({ seo_description: e.target.value })}
        rows={3}
      />
    </div>

    <div className="space-y-2">
      <Label>Canonical URL</Label>
      <Input
        value={value.seo_canonical_url}
        onChange={(e) => onChange({ seo_canonical_url: e.target.value })}
        placeholder="https://www.homecarematch.com.br/blog/..."
      />
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Open Graph Título</Label>
        <Input value={value.seo_og_title} onChange={(e) => onChange({ seo_og_title: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Open Graph Imagem (URL)</Label>
        <Input
          value={value.seo_og_image_url}
          onChange={(e) => onChange({ seo_og_image_url: e.target.value })}
          placeholder="https://..."
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label>Open Graph Descrição</Label>
      <Textarea
        value={value.seo_og_description}
        onChange={(e) => onChange({ seo_og_description: e.target.value })}
        rows={2}
      />
    </div>

    <div className="space-y-2">
      <Label>Schema JSON (opcional)</Label>
      <Textarea
        value={value.schema_json}
        onChange={(e) => onChange({ schema_json: e.target.value })}
        rows={5}
        className="font-mono text-xs"
      />
    </div>
  </div>
);

const BlogTab = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("articles");
  const [syncing, setSyncing] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingTag, setSavingTag] = useState(false);
  const [savingArticle, setSavingArticle] = useState(false);
  const [generatingAI, setGeneratingAI] = useState<"suggestion" | "automatic" | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState("");

  const [categories, setCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);

  const [categoryForm, setCategoryForm] = useState<BlogCategoryForm>(emptyCategoryForm);
  const [tagForm, setTagForm] = useState<BlogTagForm>(emptyTagForm);
  const [articleForm, setArticleForm] = useState<BlogArticleForm>(emptyArticleForm);

  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")),
    [tags],
  );

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [categoriesRes, tagsRes, articlesRes] = await Promise.all([
        supabase.from("blog_categories").select("*").order("name", { ascending: true }),
        supabase.from("blog_tags").select("*").order("name", { ascending: true }),
        supabase
          .from("blog_articles")
          .select(
            `
            *,
            category:blog_categories ( id, name, slug ),
            blog_article_tags (
              tag:blog_tags ( id, name, slug )
            )
          `,
          )
          .order("updated_at", { ascending: false }),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (tagsRes.error) throw tagsRes.error;
      if (articlesRes.error) throw articlesRes.error;

      setCategories(categoriesRes.data || []);
      setTags(tagsRes.data || []);
      setArticles(articlesRes.data || []);
    } catch (err: any) {
      console.error("[BlogTab] fetchAll error:", err);
      toast.error(
        err?.message?.includes("relation")
          ? "Estrutura de blog ainda não existe. Execute a migration antes de usar este painel."
          : "Erro ao carregar dados do blog.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSyncSchema = async () => {
    setSyncing(true);
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || currentSession?.access_token || "";

      if (!accessToken) {
        throw new Error("Sessao expirada. Entre novamente para sincronizar.");
      }

      const { error } = await supabase.functions.invoke("extend-site-config", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (error) throw error;

      const blogResponse = await fetch(`${SUPABASE_URL}/functions/v1/setup-blog-module`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!blogResponse.ok) {
        let detail = `HTTP ${blogResponse.status}`;
        try {
          const payload = await blogResponse.json();
          const message = typeof payload?.error === "string" ? payload.error : "";
          const extra = typeof payload?.details === "string" ? payload.details : "";
          const text = [message, extra].filter(Boolean).join(" - ");
          if (text) detail = text;
        } catch {
          // noop
        }
        throw new Error(`Falha ao sincronizar modulo Blog: ${detail}`);
      }

      toast.success("Sincronizacao concluida (estrutura base + modulo Blog).");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao sincronizar estrutura base.");
    } finally {
      setSyncing(false);
    }
  };

  const resetCategoryForm = () => setCategoryForm(emptyCategoryForm);
  const resetTagForm = () => setTagForm(emptyTagForm);
  const resetArticleForm = () => setArticleForm(emptyArticleForm);

  const handleSaveCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    if (!categoryForm.slug.trim()) {
      toast.error("Informe o slug da categoria.");
      return;
    }

    const schema = parseSchemaJson(categoryForm.schema_json);
    if (schema.error) {
      toast.error(schema.error);
      return;
    }

    setSavingCategory(true);
    try {
      const payload = {
        name: categoryForm.name.trim(),
        slug: generateSlug(categoryForm.slug),
        description: categoryForm.description || null,
        seo_title: categoryForm.seo_title || null,
        seo_description: categoryForm.seo_description || null,
        seo_canonical_url: categoryForm.seo_canonical_url || null,
        seo_robots: categoryForm.seo_robots || "index,follow",
        seo_og_title: categoryForm.seo_og_title || null,
        seo_og_description: categoryForm.seo_og_description || null,
        seo_og_image_url: categoryForm.seo_og_image_url || null,
        schema_json: schema.value,
      };

      if (categoryForm.id) {
        const { error } = await supabase.from("blog_categories").update(payload).eq("id", categoryForm.id);
        if (error) throw error;
        toast.success("Categoria atualizada.");
      } else {
        const { error } = await supabase.from("blog_categories").insert(payload);
        if (error) throw error;
        toast.success("Categoria criada.");
      }

      resetCategoryForm();
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar categoria.");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSaveTag = async (event: FormEvent) => {
    event.preventDefault();
    if (!tagForm.name.trim()) {
      toast.error("Informe o nome da tag.");
      return;
    }
    if (!tagForm.slug.trim()) {
      toast.error("Informe o slug da tag.");
      return;
    }

    const schema = parseSchemaJson(tagForm.schema_json);
    if (schema.error) {
      toast.error(schema.error);
      return;
    }

    setSavingTag(true);
    try {
      const payload = {
        name: tagForm.name.trim(),
        slug: generateSlug(tagForm.slug),
        description: tagForm.description || null,
        seo_title: tagForm.seo_title || null,
        seo_description: tagForm.seo_description || null,
        seo_canonical_url: tagForm.seo_canonical_url || null,
        seo_robots: tagForm.seo_robots || "index,follow",
        seo_og_title: tagForm.seo_og_title || null,
        seo_og_description: tagForm.seo_og_description || null,
        seo_og_image_url: tagForm.seo_og_image_url || null,
        schema_json: schema.value,
      };

      if (tagForm.id) {
        const { error } = await supabase.from("blog_tags").update(payload).eq("id", tagForm.id);
        if (error) throw error;
        toast.success("Tag atualizada.");
      } else {
        const { error } = await supabase.from("blog_tags").insert(payload);
        if (error) throw error;
        toast.success("Tag criada.");
      }

      resetTagForm();
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar tag.");
    } finally {
      setSavingTag(false);
    }
  };

  const handleSaveArticle = async (event: FormEvent) => {
    event.preventDefault();

    if (!articleForm.title.trim()) {
      toast.error("Informe o título do artigo.");
      return;
    }
    if (!articleForm.slug.trim()) {
      toast.error("Informe o slug do artigo.");
      return;
    }
    if (!articleForm.content_html.trim()) {
      toast.error("Informe o conteúdo do artigo.");
      return;
    }

    const schema = parseSchemaJson(articleForm.schema_json);
    if (schema.error) {
      toast.error(schema.error);
      return;
    }

    setSavingArticle(true);
    try {
      const estimatedReadingTime = Math.max(
        1,
        Number(articleForm.reading_time_minutes || estimateReadingTime(articleForm.content_html)),
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        title: articleForm.title.trim(),
        slug: generateSlug(articleForm.slug),
        excerpt: articleForm.excerpt || null,
        cover_image_url: articleForm.cover_image_url || null,
        content_html: articleForm.content_html,
        status: articleForm.status,
        published_at:
          articleForm.status === "published"
            ? articleForm.published_at || new Date().toISOString()
            : null,
        author_name: articleForm.author_name || "Equipe HomeCare Match",
        reading_time_minutes: estimatedReadingTime,
        featured: !!articleForm.featured,
        category_id: articleForm.category_id || null,
        focus_keyword: articleForm.focus_keyword || null,
        seo_title: articleForm.seo_title || null,
        seo_description: articleForm.seo_description || null,
        seo_canonical_url: articleForm.seo_canonical_url || null,
        seo_robots: articleForm.seo_robots || "index,follow",
        seo_og_title: articleForm.seo_og_title || null,
        seo_og_description: articleForm.seo_og_description || null,
        seo_og_image_url: articleForm.seo_og_image_url || null,
        schema_json: schema.value,
        updated_by: user?.id || null,
      };

      let articleId = articleForm.id || "";
      if (articleForm.id) {
        const { error } = await supabase.from("blog_articles").update(payload).eq("id", articleForm.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("blog_articles")
          .insert({
            ...payload,
            created_by: user?.id || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        articleId = data?.id;
      }

      if (articleId) {
        const { error: deleteLinksError } = await supabase
          .from("blog_article_tags")
          .delete()
          .eq("article_id", articleId);
        if (deleteLinksError) throw deleteLinksError;

        if (articleForm.tag_ids.length > 0) {
          const rows = articleForm.tag_ids.map((tagId) => ({
            article_id: articleId,
            tag_id: tagId,
          }));
          const { error: insertLinksError } = await supabase.from("blog_article_tags").insert(rows);
          if (insertLinksError) throw insertLinksError;
        }
      }

      toast.success(articleForm.id ? "Artigo atualizado." : "Artigo criado.");
      resetArticleForm();
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar artigo.");
    } finally {
      setSavingArticle(false);
    }
  };

  const handleDelete = async (table: "blog_categories" | "blog_tags" | "blog_articles", id: string) => {
    if (!confirm("Deseja remover este item?")) return;
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Item removido.");
      fetchAll();
      if (table === "blog_categories" && categoryForm.id === id) resetCategoryForm();
      if (table === "blog_tags" && tagForm.id === id) resetTagForm();
      if (table === "blog_articles" && articleForm.id === id) resetArticleForm();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover item.");
    }
  };

  const applyArticleToForm = (article: any) => {
    const tagIds = (Array.isArray(article?.blog_article_tags) ? article.blog_article_tags : [])
      .map((link: any) => link?.tag?.id)
      .filter(Boolean);

    setArticleForm({
      id: article.id,
      title: article.title || "",
      slug: article.slug || "",
      excerpt: article.excerpt || "",
      cover_image_url: article.cover_image_url || "",
      content_html: article.content_html || "",
      status: article.status === "published" ? "published" : "draft",
      published_at: article.published_at || "",
      author_name: article.author_name || "Equipe HomeCare Match",
      reading_time_minutes: article.reading_time_minutes || 1,
      featured: !!article.featured,
      category_id: article.category_id || "",
      tag_ids: tagIds,
      focus_keyword: article.focus_keyword || "",
      seo_title: article.seo_title || "",
      seo_description: article.seo_description || "",
      seo_canonical_url: article.seo_canonical_url || "",
      seo_robots: article.seo_robots || "index,follow",
      seo_og_title: article.seo_og_title || "",
      seo_og_description: article.seo_og_description || "",
      seo_og_image_url: article.seo_og_image_url || "",
      schema_json: JSON.stringify(article.schema_json || {}, null, 2),
    });
    setActiveTab("articles");
  };

  const handleGenerateAI = async (mode: "suggestion" | "automatic") => {
    if (mode === "suggestion" && !aiSuggestion.trim()) {
      toast.error("Informe uma sugestão para gerar o artigo com IA.");
      return;
    }

    setGeneratingAI(mode);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-article", {
        body: {
          mode,
          suggestion: mode === "suggestion" ? aiSuggestion : null,
        },
      });
      if (error) throw error;

      const payload = data || {};
      const aiTitle = String(payload.title || "").trim();
      const aiSlug = generateSlug(String(payload.slug || aiTitle || ""));
      const aiExcerpt = String(payload.excerpt || "").trim();
      const aiContent = String(payload.content_html || "").trim();
      const aiFocusKeyword = String(payload.focus_keyword || "").trim();
      const aiTagsSuggested = Array.isArray(payload.tags_suggested) ? payload.tags_suggested : [];

      const suggestedTagIds = sortedTags
        .filter((tag) =>
          aiTagsSuggested.some(
            (name: string) =>
              generateSlug(String(name || "")) === generateSlug(String(tag.slug || "")) ||
              generateSlug(String(name || "")) === generateSlug(String(tag.name || "")),
          ),
        )
        .map((tag) => String(tag.id));

      setArticleForm((prev) => ({
        ...prev,
        title: aiTitle || prev.title,
        slug: aiSlug || prev.slug,
        excerpt: aiExcerpt || prev.excerpt,
        content_html: aiContent || prev.content_html,
        focus_keyword: aiFocusKeyword || prev.focus_keyword,
        seo_title: String(payload.seo_title || aiTitle || prev.seo_title),
        seo_description: String(payload.seo_description || aiExcerpt || prev.seo_description),
        seo_og_title: String(payload.seo_og_title || aiTitle || prev.seo_og_title),
        seo_og_description: String(payload.seo_og_description || aiExcerpt || prev.seo_og_description),
        reading_time_minutes:
          Number(payload.reading_time_minutes || 0) || Math.max(1, estimateReadingTime(aiContent || prev.content_html)),
        tag_ids: suggestedTagIds.length > 0 ? suggestedTagIds : prev.tag_ids,
      }));

      toast.success("Artigo gerado com IA. Revise e ajuste antes de publicar.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar artigo com IA. Verifique se a função foi publicada no Supabase.");
    } finally {
      setGeneratingAI(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSyncSchema} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Sincronizar Base
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-3 md:w-[420px]">
          <TabsTrigger value="articles">Artigos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Artigos</CardTitle>
              <CardDescription>Gerencie conteúdos do blog e status de publicação.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.length > 0 ? (
                    articles.map((article) => (
                      <TableRow key={article.id}>
                        <TableCell className="font-medium">{article.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{article.slug}</TableCell>
                        <TableCell>
                          <Badge variant={article.status === "published" ? "default" : "secondary"}>
                            {article.status === "published" ? "Publicado" : "Rascunho"}
                          </Badge>
                        </TableCell>
                        <TableCell>{article.category?.name || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => applyArticleToForm(article)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete("blog_articles", article.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Nenhum artigo cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{articleForm.id ? "Editar artigo" : "Novo artigo"}</CardTitle>
                  <CardDescription>
                    Conteúdo, SEO completo e schema otimizado para Google.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={resetArticleForm} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3 rounded-xl border border-border/70 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Bot className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Assistente de IA para Artigos</p>
                    <p className="text-xs text-muted-foreground">
                      Gere um artigo por sugestão ou deixe a IA escolher um tema estratégico para a plataforma.
                    </p>
                  </div>
                </div>
                <Textarea
                  value={aiSuggestion}
                  onChange={(e) => setAiSuggestion(e.target.value)}
                  placeholder="Sugestão opcional: Ex. Como reduzir turnover em equipes de Home Care"
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleGenerateAI("suggestion")}
                    disabled={!!generatingAI}
                  >
                    {generatingAI === "suggestion" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Gerar com sugestão
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleGenerateAI("automatic")}
                    disabled={!!generatingAI}
                  >
                    {generatingAI === "automatic" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                    IA escolhe tema relevante
                  </Button>
                </div>
              </div>

              <form onSubmit={handleSaveArticle} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={articleForm.title}
                      onChange={(e) =>
                        setArticleForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                          slug: prev.id ? prev.slug : generateSlug(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input
                      value={articleForm.slug}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, slug: generateSlug(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Resumo (excerpt)</Label>
                  <Textarea
                    value={articleForm.excerpt}
                    onChange={(e) => setArticleForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Imagem de capa (URL)</Label>
                  <Input
                    value={articleForm.cover_image_url}
                    onChange={(e) => setArticleForm((prev) => ({ ...prev, cover_image_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Conteúdo do artigo</Label>
                  <RichTextEditor
                    content={articleForm.content_html}
                    onChange={(html) =>
                      setArticleForm((prev) => ({
                        ...prev,
                        content_html: html,
                        reading_time_minutes: Math.max(1, estimateReadingTime(html)),
                      }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={articleForm.status}
                      onValueChange={(value: "draft" | "published") =>
                        setArticleForm((prev) => ({
                          ...prev,
                          status: value,
                          published_at:
                            value === "published" && !prev.published_at ? new Date().toISOString() : prev.published_at,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Rascunho</SelectItem>
                        <SelectItem value="published">Publicado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data de publicação (ISO)</Label>
                    <Input
                      value={articleForm.published_at}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, published_at: e.target.value }))}
                      placeholder="2026-03-03T12:00:00.000Z"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Autor</Label>
                    <Input
                      value={articleForm.author_name}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, author_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo de leitura (min)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={articleForm.reading_time_minutes}
                      onChange={(e) =>
                        setArticleForm((prev) => ({
                          ...prev,
                          reading_time_minutes: Number(e.target.value || 1),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={articleForm.category_id || "__none__"}
                      onValueChange={(value) =>
                        setArticleForm((prev) => ({ ...prev, category_id: value === "__none__" ? "" : value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem categoria</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Palavra-chave foco</Label>
                    <Input
                      value={articleForm.focus_keyword}
                      onChange={(e) => setArticleForm((prev) => ({ ...prev, focus_keyword: e.target.value }))}
                      placeholder="Ex: cuidador de idosos"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/70 p-3">
                  <div>
                    <p className="text-sm font-medium">Artigo em destaque</p>
                    <p className="text-xs text-muted-foreground">Prioriza o conteúdo na listagem do blog.</p>
                  </div>
                  <Switch
                    checked={articleForm.featured}
                    onCheckedChange={(checked) => setArticleForm((prev) => ({ ...prev, featured: checked }))}
                  />
                </div>

                <div className="space-y-2 rounded-xl border border-border/70 p-4">
                  <Label className="text-sm font-semibold">Tags do artigo</Label>
                  <div className="grid gap-2 md:grid-cols-3">
                    {sortedTags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={articleForm.tag_ids.includes(tag.id)}
                          onCheckedChange={(checked) => {
                            setArticleForm((prev) => ({
                              ...prev,
                              tag_ids: checked
                                ? Array.from(new Set([...prev.tag_ids, tag.id]))
                                : prev.tag_ids.filter((id) => id !== tag.id),
                            }));
                          }}
                        />
                        <span>#{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <BlogSeoFields
                  value={articleForm}
                  onChange={(patch) => setArticleForm((prev) => ({ ...prev, ...patch }))}
                />

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetArticleForm}>
                    Limpar
                  </Button>
                  <Button type="submit" disabled={savingArticle} className="gap-2">
                    {savingArticle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar artigo
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Categorias</CardTitle>
              <CardDescription>Gerencie categorias com SEO próprio e schema específico.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{category.slug}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setCategoryForm({
                                  id: category.id,
                                  name: category.name || "",
                                  slug: category.slug || "",
                                  description: category.description || "",
                                  seo_title: category.seo_title || "",
                                  seo_description: category.seo_description || "",
                                  seo_canonical_url: category.seo_canonical_url || "",
                                  seo_robots: category.seo_robots || "index,follow",
                                  seo_og_title: category.seo_og_title || "",
                                  seo_og_description: category.seo_og_description || "",
                                  seo_og_image_url: category.seo_og_image_url || "",
                                  schema_json: JSON.stringify(category.schema_json || {}, null, 2),
                                })
                              }
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete("blog_categories", category.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        Nenhuma categoria cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{categoryForm.id ? "Editar categoria" : "Nova categoria"}</CardTitle>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={resetCategoryForm}>
                  <Plus className="h-4 w-4" />
                  Nova
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCategory} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                          slug: prev.id ? prev.slug : generateSlug(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input
                      value={categoryForm.slug}
                      onChange={(e) => setCategoryForm((prev) => ({ ...prev, slug: generateSlug(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <BlogSeoFields
                  value={categoryForm}
                  onChange={(patch) => setCategoryForm((prev) => ({ ...prev, ...patch }))}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetCategoryForm}>
                    Limpar
                  </Button>
                  <Button type="submit" disabled={savingCategory} className="gap-2">
                    {savingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar categoria
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>Gerencie tags com SEO e schema próprio.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.length > 0 ? (
                    tags.map((tag) => (
                      <TableRow key={tag.id}>
                        <TableCell className="font-medium">{tag.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{tag.slug}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setTagForm({
                                  id: tag.id,
                                  name: tag.name || "",
                                  slug: tag.slug || "",
                                  description: tag.description || "",
                                  seo_title: tag.seo_title || "",
                                  seo_description: tag.seo_description || "",
                                  seo_canonical_url: tag.seo_canonical_url || "",
                                  seo_robots: tag.seo_robots || "index,follow",
                                  seo_og_title: tag.seo_og_title || "",
                                  seo_og_description: tag.seo_og_description || "",
                                  seo_og_image_url: tag.seo_og_image_url || "",
                                  schema_json: JSON.stringify(tag.schema_json || {}, null, 2),
                                })
                              }
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete("blog_tags", tag.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        Nenhuma tag cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>{tagForm.id ? "Editar tag" : "Nova tag"}</CardTitle>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={resetTagForm}>
                  <Plus className="h-4 w-4" />
                  Nova
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveTag} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={tagForm.name}
                      onChange={(e) =>
                        setTagForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                          slug: prev.id ? prev.slug : generateSlug(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input value={tagForm.slug} onChange={(e) => setTagForm((prev) => ({ ...prev, slug: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    rows={3}
                    value={tagForm.description}
                    onChange={(e) => setTagForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <BlogSeoFields
                  value={tagForm}
                  onChange={(patch) => setTagForm((prev) => ({ ...prev, ...patch }))}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetTagForm}>
                    Limpar
                  </Button>
                  <Button type="submit" disabled={savingTag} className="gap-2">
                    {savingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar tag
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BlogTab;

