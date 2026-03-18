"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Copy,
  CopyPlus,
  Plus,
  Link as LinkIcon,
  Wand2,
  Pencil,
  Trash2,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
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

type MarketingShortLinkEvent = {
  short_link_id: string;
  event_type: "click" | "signup";
  occurred_at: string;
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
const PERIOD_OPTIONS = [7, 30, 90] as const;
const CHART_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const UTM_PARAM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

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

const stripUtmFromUrl = (rawUrl: string) => {
  try {
    const parsed = new URL(rawUrl);
    for (const key of UTM_PARAM_KEYS) {
      parsed.searchParams.delete(key);
    }
    return parsed;
  } catch {
    return null;
  }
};

const resolveDestinationPath = (targetUrl: string, baseUrl: string) => {
  const parsed = stripUtmFromUrl(targetUrl);
  if (!parsed) return targetUrl;

  const normalizedBase = normalizeBaseUrl(baseUrl);
  try {
    const base = new URL(normalizedBase);
    if (parsed.origin === base.origin) {
      const query = parsed.searchParams.toString();
      return `${parsed.pathname}${query ? `?${query}` : ""}${parsed.hash || ""}`;
    }
  } catch {
    // ignore base parse fallback
  }

  return parsed.toString();
};

const buildDuplicatedSlug = (seedSlug: string, existingLinks: MarketingShortLink[]) => {
  const baseSeed = normalizeSlug(seedSlug) || "link";
  const used = new Set(existingLinks.map((row) => normalizeSlug(row.slug)));
  const makeCandidate = (suffixIndex: number) => {
    const suffix = suffixIndex === 1 ? "-copia" : `-copia-${suffixIndex}`;
    return normalizeSlug(`${baseSeed}${suffix}`);
  };

  let attempt = 1;
  let candidate = makeCandidate(attempt);
  while (!candidate || used.has(candidate) || RESERVED_SLUGS.has(candidate)) {
    attempt += 1;
    candidate = makeCandidate(attempt);
  }
  return candidate;
};

const normalizeHost = (value: string) => String(value || "").trim().toLowerCase().replace(/^www\./, "");

const pointsToOwnSlug = (targetUrl: string, slug: string, baseUrl: string) => {
  try {
    const base = new URL(normalizeBaseUrl(baseUrl));
    const resolvedTarget = new URL(targetUrl, base.origin);

    if (normalizeHost(base.hostname) !== normalizeHost(resolvedTarget.hostname)) {
      return false;
    }

    const cleanedPath = String(resolvedTarget.pathname || "").replace(/^\/+|\/+$/g, "");
    if (!cleanedPath || cleanedPath.includes("/")) return false;
    return normalizeSlug(cleanedPath) === slug;
  } catch {
    return false;
  }
};

const truncateMiddle = (value: string, max = 90) => {
  const text = String(value || "");
  if (text.length <= max) return text;
  const start = text.slice(0, Math.floor(max * 0.55));
  const end = text.slice(-Math.floor(max * 0.35));
  return `${start}...${end}`;
};

const toDayKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const buildDayKeys = (periodDays: number) => {
  const days = Math.max(1, periodDays);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(toDayKey(d));
  }
  return out;
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
  const [eventsLoading, setEventsLoading] = useState(false);
  const [links, setLinks] = useState<MarketingShortLink[]>([]);
  const [events, setEvents] = useState<MarketingShortLinkEvent[]>([]);
  const [periodDays, setPeriodDays] = useState<(typeof PERIOD_OPTIONS)[number]>(30);
  const [selectedChartLinkId, setSelectedChartLinkId] = useState<string>("");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
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
      const rows = (data || []) as MarketingShortLink[];
      setLinks(rows);
      setSelectedChartLinkId((current) => {
        if (current && rows.some((row) => row.id === current)) return current;
        return rows[0]?.id || "";
      });
    } catch (error: any) {
      console.error("[UtmShortLinksCard] load error:", error);
      toast.error("Nao foi possivel carregar os links curtos. Verifique se o banco foi sincronizado.");
      setLinks([]);
      setSelectedChartLinkId("");
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (days: number) => {
    setEventsLoading(true);
    try {
      const cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - Math.max(1, days) + 1);

      const { data, error } = await supabase
        .from("marketing_short_link_events")
        .select("short_link_id,event_type,occurred_at")
        .gte("occurred_at", cutoff.toISOString())
        .order("occurred_at", { ascending: true })
        .limit(200000);

      if (error) throw error;
      setEvents((data || []) as MarketingShortLinkEvent[]);
    } catch (error: any) {
      console.error("[UtmShortLinksCard] load events error:", error);
      toast.error("Nao foi possivel carregar o historico por periodo.");
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    void loadLinks();
  }, []);

  useEffect(() => {
    void loadEvents(periodDays);
  }, [periodDays]);

  const trackedUrlPreview = useMemo(() => buildTrackedUrl(form), [form]);
  const normalizedSlug = useMemo(() => normalizeSlug(form.slug), [form.slug]);
  const publicShortUrlPreview = useMemo(() => {
    if (!normalizedSlug) return "";
    return `${normalizeBaseUrl(form.baseUrl)}/${normalizedSlug}`;
  }, [form.baseUrl, normalizedSlug]);

  const periodStatsByLink = useMemo(() => {
    const stats = new Map<string, { clicks: number; signups: number }>();
    for (const event of events) {
      const current = stats.get(event.short_link_id) || { clicks: 0, signups: 0 };
      if (event.event_type === "signup") current.signups += 1;
      else current.clicks += 1;
      stats.set(event.short_link_id, current);
    }
    return stats;
  }, [events]);

  const chartData = useMemo(() => {
    if (!selectedChartLinkId) return [];
    const dayKeys = buildDayKeys(periodDays);
    const byDay = new Map<string, { clicks: number; signups: number }>();
    for (const key of dayKeys) {
      byDay.set(key, { clicks: 0, signups: 0 });
    }

    for (const event of events) {
      if (event.short_link_id !== selectedChartLinkId) continue;
      const dayKey = toDayKey(event.occurred_at);
      if (!dayKey || !byDay.has(dayKey)) continue;
      const row = byDay.get(dayKey)!;
      if (event.event_type === "signup") row.signups += 1;
      else row.clicks += 1;
    }

    return dayKeys.map((dayKey) => {
      const date = new Date(`${dayKey}T00:00:00Z`);
      const day = byDay.get(dayKey) || { clicks: 0, signups: 0 };
      return {
        dayKey,
        label: CHART_DATE_FORMATTER.format(date),
        clicks: day.clicks,
        signups: day.signups,
      };
    });
  }, [events, periodDays, selectedChartLinkId]);

  const selectedChartLink = useMemo(
    () => links.find((row) => row.id === selectedChartLinkId) || null,
    [links, selectedChartLinkId],
  );

  const selectedPeriodStats = useMemo(() => {
    if (!selectedChartLinkId) return { clicks: 0, signups: 0, conversionRate: 0 };
    const base = periodStatsByLink.get(selectedChartLinkId) || { clicks: 0, signups: 0 };
    const conversionRate = base.clicks > 0 ? (base.signups / base.clicks) * 100 : 0;
    return { clicks: base.clicks, signups: base.signups, conversionRate };
  }, [periodStatsByLink, selectedChartLinkId]);

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

  const resetForm = () => {
    setEditingLinkId(null);
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
  };

  const hydrateFormFromLink = (row: MarketingShortLink, nextSlug?: string) => {
    setForm((prev) => ({
      ...prev,
      name: row.name,
      destinationPath: resolveDestinationPath(row.target_url, prev.baseUrl),
      utmSource: String(row.utm_source || ""),
      utmMedium: String(row.utm_medium || ""),
      utmCampaign: String(row.utm_campaign || ""),
      utmTerm: String(row.utm_term || ""),
      utmContent: String(row.utm_content || ""),
      slug: nextSlug || row.slug,
    }));
  };

  const handleEdit = (row: MarketingShortLink) => {
    setEditingLinkId(row.id);
    hydrateFormFromLink(row);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    toast.success(`Editando link: ${row.name}`);
  };

  const handleDuplicate = (row: MarketingShortLink) => {
    const nextSlug = buildDuplicatedSlug(row.slug, links);
    setEditingLinkId(null);
    hydrateFormFromLink(
      { ...row, name: `${row.name} (Copia)` },
      nextSlug,
    );
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    toast.success("Formulario preenchido para duplicacao.");
  };

  const handleSaveLink = async () => {
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
    if (pointsToOwnSlug(targetUrl, slug, form.baseUrl)) {
      toast.error("Destino invalido: este link curto aponta para ele mesmo e geraria loop.");
      return;
    }

    const rowBeingEdited = editingLinkId ? links.find((row) => row.id === editingLinkId) || null : null;
    if (editingLinkId && !rowBeingEdited) {
      toast.error("Link original nao encontrado para edicao.");
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
      };

      let error: { message?: string } | null = null;
      if (editingLinkId) {
        const updatePayload = {
          ...payload,
        };
        const response = await supabase
          .from("marketing_short_links")
          .update(updatePayload)
          .eq("id", editingLinkId);
        error = response.error;
      } else {
        const createPayload = {
          ...payload,
          is_active: true,
          created_by: user?.id || null,
        };
        const response = await supabase.from("marketing_short_links").insert(createPayload);
        error = response.error;
      }

      if (error) {
        if (String(error.message || "").toLowerCase().includes("duplicate")) {
          toast.error("Este slug ja existe. Escolha outro.");
          return;
        }
        throw error;
      }

      toast.success(editingLinkId ? "Link curto atualizado com sucesso." : "Link curto criado com sucesso.");
      resetForm();
      await Promise.all([loadLinks(), loadEvents(periodDays)]);
    } catch (error: any) {
      console.error("[UtmShortLinksCard] save error:", error);
      toast.error(error?.message || "Nao foi possivel salvar o link curto.");
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
      setLinks((prev) => {
        const next = prev.filter((item) => item.id !== row.id);
        if (selectedChartLinkId === row.id) {
          setSelectedChartLinkId(next[0]?.id || "");
        }
        return next;
      });
      toast.success("Link excluido.");
      await loadEvents(periodDays);
    } catch (error) {
      console.error("[UtmShortLinksCard] delete error:", error);
      toast.error("Nao foi possivel excluir o link.");
    }
  };

  const renderPeriodActions = () => (
    <div className="flex flex-wrap gap-2">
      {PERIOD_OPTIONS.map((days) => (
        <Button
          key={days}
          type="button"
          size="sm"
          variant={periodDays === days ? "default" : "outline"}
          onClick={() => setPeriodDays(days)}
        >
          {days} dias
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => void loadEvents(periodDays)}
        disabled={eventsLoading}
      >
        {eventsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Atualizar"}
      </Button>
    </div>
  );

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
            <p className="text-xs text-muted-foreground">Origem do trafego. Ex: facebook, instagram, google, newsletter.</p>
          </div>
          <div className="space-y-2">
            <Label>utm_medium</Label>
            <Input value={form.utmMedium} onChange={(event) => setForm((prev) => ({ ...prev, utmMedium: event.target.value }))} />
            <p className="text-xs text-muted-foreground">Canal/formato da divulgacao. Ex: cpc, social, email, organic.</p>
          </div>
          <div className="space-y-2">
            <Label>utm_campaign</Label>
            <Input value={form.utmCampaign} onChange={(event) => setForm((prev) => ({ ...prev, utmCampaign: event.target.value }))} />
            <p className="text-xs text-muted-foreground">Nome da campanha. Ex: profissionais-mar-2026, black-friday.</p>
          </div>
          <div className="space-y-2">
            <Label>utm_term (opcional)</Label>
            <Input value={form.utmTerm} onChange={(event) => setForm((prev) => ({ ...prev, utmTerm: event.target.value }))} />
            <p className="text-xs text-muted-foreground">Palavra-chave/segmento. Mais comum em anuncios de busca.</p>
          </div>
          <div className="space-y-2">
            <Label>utm_content (opcional)</Label>
            <Input value={form.utmContent} onChange={(event) => setForm((prev) => ({ ...prev, utmContent: event.target.value }))} />
            <p className="text-xs text-muted-foreground">Variacao da peca/link para teste A/B. Ex: botao-azul, criativo-video-1.</p>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          {editingLinkId ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              Modo edicao ativo. Altere os campos e clique em <strong>Salvar Edicao</strong>.
            </div>
          ) : null}
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
            <Button type="button" className="gap-2" onClick={handleSaveLink} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingLinkId ? "Salvar Edicao" : "Criar Link Curto"}
            </Button>
            {editingLinkId ? (
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar Edicao
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Analitico por periodo</p>
              <p className="text-xs text-muted-foreground">Cliques e cadastros por link encurtado.</p>
            </div>
            {renderPeriodActions()}
          </div>

          <div className="grid gap-3 md:grid-cols-[320px,1fr]">
            <div className="space-y-2">
              <Label>Link para visualizar no grafico</Label>
              <Select value={selectedChartLinkId} onValueChange={setSelectedChartLinkId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um link" />
                </SelectTrigger>
                <SelectContent>
                  {links.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name} ({row.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="outline">Cliques {periodDays}d: {selectedPeriodStats.clicks}</Badge>
                <Badge variant="outline">Cadastros {periodDays}d: {selectedPeriodStats.signups}</Badge>
                <Badge variant="outline">Conversao: {selectedPeriodStats.conversionRate.toFixed(1)}%</Badge>
              </div>
            </div>

            <div className="h-[280px] rounded-lg border bg-muted/10 p-2">
              {!selectedChartLink ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Selecione um link para visualizar o grafico.
                </div>
              ) : eventsLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando serie do periodo...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="clicks" name="Cliques" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="signups" name="Cadastros" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Links curtos cadastrados</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void Promise.all([loadLinks(), loadEvents(periodDays)]);
              }}
              disabled={loading}
            >
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
                const periodStats = periodStatsByLink.get(row.id) || { clicks: 0, signups: 0 };
                const periodRate = periodStats.clicks > 0 ? (periodStats.signups / periodStats.clicks) * 100 : 0;
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
                        <Badge variant="outline">Conversao total: {conversionRate.toFixed(1)}%</Badge>
                        <Badge variant="outline">
                          Periodo {periodDays}d: {periodStats.clicks}/{periodStats.signups} ({periodRate.toFixed(1)}%)
                        </Badge>
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
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setSelectedChartLinkId(row.id)}
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          Ver grafico
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => handleEdit(row)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => handleDuplicate(row)}>
                          <CopyPlus className="h-3.5 w-3.5" />
                          Duplicar
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
