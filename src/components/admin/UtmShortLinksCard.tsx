"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Plus, Link as LinkIcon, Wand2, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type MarketingShortLink = {
  id: string;
  name: string;
  slug: string;
  target_url: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  is_active: boolean;
  click_count: number;
  signup_count: number;
  last_clicked_at?: string | null;
  last_signup_at?: string | null;
  created_at: string;
};

type LinkForm = {
  name: string;
  baseUrl: string;
  destinationPath: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  slug: string;
};

const DEFAULT_BASE_URL = "https://www.homecarematch.com.br";

const RESERVED_SLUGS = new Set([
  "admin",
  "dashboard",
  "login",
  "buscar",
  "empresas",
  "familias",
  "cursos",
  "suporte",
  "funcionalidades",
  "blog",
  "politica-de-privacidade",
  "politica-de-cookies",
  "redefinir-senha",
  "validar",
  "certificado",
  "profissional",
  "recruiter",
  "cadastro-empresa",
  "conversion",
  "convite",
]);

const normalizeBaseUrl = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_BASE_URL;

  try {
    const parsed = raw.startsWith("http://") || raw.startsWith("https://") ? new URL(raw) : new URL(`https://${raw}`);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return DEFAULT_BASE_URL;
  }
};

const normalizeSlug = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const isSlugValid = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

const toOptional = (value: string) => {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const truncateMiddle = (value: string, max = 90) => {
  const text = String(value || "");
  if (text.length <= max) return text;
  const start = text.slice(0, Math.floor(max * 0.55));
  const end = text.slice(-Math.floor(max * 0.35));
  return `${start}...${end}`;
};

const buildTrackedUrl = (form: LinkForm) => {
  const base = normalizeBaseUrl(form.baseUrl);
  const rawDestination = String(form.destinationPath || "").trim();
  if (!rawDestination) return "";

  let url: URL;
  try {
    if (/^https?:\/\//i.test(rawDestination)) {
      url = new URL(rawDestination);
    } else {
      const path = rawDestination.startsWith("/") ? rawDestination : `/${rawDestination}`;
      url = new URL(path, base);
    }
  } catch {
    return "";
  }

  const params = [
    ["utm_source", form.utmSource],
    ["utm_medium", form.utmMedium],
    ["utm_campaign", form.utmCampaign],
    ["utm_term", form.utmTerm],
    ["utm_content", form.utmContent],
  ] as const;

  for (const [key, value] of params) {
    const cleaned = String(value || "").trim();
    if (cleaned) {
      url.searchParams.set(key, cleaned);
    }
  }

  return url.toString();
};

const UtmShortLinksCard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState<MarketingShortLink[]>([]);
  const [form, setForm] = useState<LinkForm>({
    name: "",
    baseUrl: DEFAULT_BASE_URL,
    destinationPath: "/",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmTerm: "",
    utmContent: "",
    slug: "",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      setForm((prev) => ({ ...prev, baseUrl: normalizeBaseUrl(window.location.origin || DEFAULT_BASE_URL) }));
    }
  }, []);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("marketing_short_links")
        .select(
          "id,name,slug,target_url,utm_source,utm_medium,utm_campaign,utm_term,utm_content,is_active,click_count,signup_count,last_clicked_at,last_signup_at,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;
      setLinks((data || []) as MarketingShortLink[]);
    } catch (error: any) {
      console.error("[UtmShortLinksCard] load error:", error);
      toast.error("Nao foi possivel carregar os links curtos. Verifique se o banco foi sincronizado.");
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLinks();
  }, []);

  const trackedUrlPreview = useMemo(() => buildTrackedUrl(form), [form]);
  const normalizedSlug = useMemo(() => normalizeSlug(form.slug), [form.slug]);
  const publicShortUrlPreview = useMemo(() => {
    if (!normalizedSlug) return "";
    return `${normalizeBaseUrl(form.baseUrl)}/${normalizedSlug}`;
  }, [form.baseUrl, normalizedSlug]);

  const copyText = async (value: string, successMessage: string) => {
    if (!value) {
      toast.error("Nada para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Nao foi possivel copiar.");
    }
  };

  const handleGenerateSlug = () => {
    const seed = form.slug || form.utmCampaign || form.name || form.destinationPath;
    const generated = normalizeSlug(seed);
    if (!generated) {
      toast.error("Informe nome, campanha ou destino para gerar o slug.");
      return;
    }
    setForm((prev) => ({ ...prev, slug: generated }));
  };

  const handleCreate = async () => {
    const name = String(form.name || "").trim();
    const slug = normalizeSlug(form.slug);
    const targetUrl = buildTrackedUrl(form);

    if (name.length < 2) {
      toast.error("Informe um nome para identificar o link.");
      return;
    }
    if (!slug || !isSlugValid(slug)) {
      toast.error("Slug invalido. Use apenas letras, numeros e hifen.");
      return;
    }
    if (RESERVED_SLUGS.has(slug)) {
      toast.error("Este slug conflita com uma rota existente da plataforma.");
      return;
    }
    if (!targetUrl) {
      toast.error("Destino invalido. Informe um caminho ou URL valido.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        slug,
        target_url: targetUrl,
        utm_source: toOptional(form.utmSource),
        utm_medium: toOptional(form.utmMedium),
        utm_campaign: toOptional(form.utmCampaign),
        utm_term: toOptional(form.utmTerm),
        utm_content: toOptional(form.utmContent),
        is_active: true,
        created_by: user?.id || null,
      };

      const { error } = await supabase.from("marketing_short_links").insert(payload);
      if (error) {
        if (String(error.message || "").toLowerCase().includes("duplicate")) {
          toast.error("Este slug ja existe. Escolha outro.");
          return;
        }
        throw error;
      }

      toast.success("Link curto criado com sucesso.");
      setForm((prev) => ({
        ...prev,
        name: "",
        destinationPath: "/",
        utmSource: "",
        utmMedium: "",
        utmCampaign: "",
        utmTerm: "",
        utmContent: "",
        slug: "",
      }));
      await loadLinks();
    } catch (error: any) {
      console.error("[UtmShortLinksCard] create error:", error);
      toast.error(error?.message || "Nao foi possivel criar o link curto.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: MarketingShortLink) => {
    try {
      const { error } = await supabase.from("marketing_short_links").update({ is_active: !row.is_active }).eq("id", row.id);
      if (error) throw error;
      setLinks((prev) => prev.map((item) => (item.id === row.id ? { ...item, is_active: !item.is_active } : item)));
      toast.success(!row.is_active ? "Link ativado." : "Link desativado.");
    } catch (error) {
      console.error("[UtmShortLinksCard] toggle error:", error);
      toast.error("Nao foi possivel alterar o status do link.");
    }
  };

  const handleDelete = async (row: MarketingShortLink) => {
    const confirmed = window.confirm(`Deseja excluir o link "${row.name}" (${row.slug})?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase.from("marketing_short_links").delete().eq("id", row.id);
      if (error) throw error;
      setLinks((prev) => prev.filter((item) => item.id !== row.id));
      toast.success("Link excluido.");
    } catch (error) {
      console.error("[UtmShortLinksCard] delete error:", error);
      toast.error("Nao foi possivel excluir o link.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>UTM + Links Curtos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome interno do link</Label>
            <Input
              placeholder="Ex: Campanha Facebook Profissionais"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Dominio base</Label>
            <Input
              placeholder={DEFAULT_BASE_URL}
              value={form.baseUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, baseUrl: event.target.value }))}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Destino (path ou URL completa)</Label>
            <Input
              placeholder="/"
              value={form.destinationPath}
              onChange={(event) => setForm((prev) => ({ ...prev, destinationPath: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Slug curto</Label>
            <div className="flex gap-2">
              <Input
                placeholder="cadastro-profissional"
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              />
              <Button type="button" variant="outline" className="gap-2 shrink-0" onClick={handleGenerateSlug}>
                <Wand2 className="h-4 w-4" />
                Gerar
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>utm_source</Label>
            <Input value={form.utmSource} onChange={(event) => setForm((prev) => ({ ...prev, utmSource: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>utm_medium</Label>
            <Input value={form.utmMedium} onChange={(event) => setForm((prev) => ({ ...prev, utmMedium: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>utm_campaign</Label>
            <Input value={form.utmCampaign} onChange={(event) => setForm((prev) => ({ ...prev, utmCampaign: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>utm_term (opcional)</Label>
            <Input value={form.utmTerm} onChange={(event) => setForm((prev) => ({ ...prev, utmTerm: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>utm_content (opcional)</Label>
            <Input value={form.utmContent} onChange={(event) => setForm((prev) => ({ ...prev, utmContent: event.target.value }))} />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview URL com UTM</p>
            <p className="break-all text-sm">{trackedUrlPreview || "Preencha destino e UTM para gerar a URL final."}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview link curto</p>
            <p className="break-all text-sm">{publicShortUrlPreview || "Defina um slug para visualizar o link curto."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => void copyText(trackedUrlPreview, "URL com UTM copiada.")} disabled={!trackedUrlPreview}>
              <Copy className="h-4 w-4" />
              Copiar URL com UTM
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => void copyText(publicShortUrlPreview, "Link curto copiado.")} disabled={!publicShortUrlPreview}>
              <Copy className="h-4 w-4" />
              Copiar Link Curto
            </Button>
            <Button type="button" className="gap-2" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Criar Link Curto
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Links curtos cadastrados</h4>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadLinks()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando links...
            </div>
          ) : links.length === 0 ? (
            <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
              Nenhum link curto criado.
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((row) => {
                const shortUrl = `${normalizeBaseUrl(form.baseUrl)}/${row.slug}`;
                const clicks = Number(row.click_count || 0);
                const signups = Number(row.signup_count || 0);
                const conversionRate = clicks > 0 ? (signups / clicks) * 100 : 0;
                return (
                  <div key={row.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{row.name}</p>
                        <Badge variant={row.is_active ? "default" : "secondary"}>
                          {row.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Badge variant="outline">Cliques: {clicks}</Badge>
                        <Badge variant="outline">Cadastros: {signups}</Badge>
                        <Badge variant="outline">Conversao: {conversionRate.toFixed(1)}%</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void copyText(shortUrl, "Link curto copiado.")}>
                          <Copy className="h-3.5 w-3.5" />
                          Curto
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void copyText(row.target_url, "URL de destino copiada.")}>
                          <Copy className="h-3.5 w-3.5" />
                          Destino
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void handleToggleActive(row)}>
                          {row.is_active ? "Desativar" : "Ativar"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => void handleDelete(row)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="mb-1 font-semibold uppercase tracking-wide">Curto</p>
                        <a href={shortUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <LinkIcon className="h-3.5 w-3.5" />
                          {truncateMiddle(shortUrl, 85)}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="mb-1 font-semibold uppercase tracking-wide">Destino</p>
                        <a href={row.target_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          {truncateMiddle(row.target_url, 90)}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UtmShortLinksCard;
