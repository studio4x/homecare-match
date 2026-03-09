"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Download, ExternalLink, FileCode } from "lucide-react";
import { toast } from "sonner";
import UtmShortLinksCard from "@/components/admin/UtmShortLinksCard";

interface SiteConfig {
  id: number;
  ga_measurement_id?: string | null;
  ga_enabled?: boolean | null;
  gtm_container_id?: string | null;
  gtm_enabled?: boolean | null;
  fb_pixel_id?: string | null;
  fb_pixel_enabled?: boolean | null;
}

const MarketingTab = () => {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [sitemapLoading, setSitemapLoading] = useState<boolean>(true);
  const [sitemapXml, setSitemapXml] = useState<string>("");
  const [sitemapUrl, setSitemapUrl] = useState<string>("https://www.homecarematch.com.br/sitemap.xml");

  useEffect(() => {
    const ensureColumns = async () => {
      try {
        await supabase.functions.invoke("extend-site-config", { body: { action: "add_marketing_columns" } });
      } catch (e) {
        console.warn("[MarketingTab] extend-site-config warning:", e);
      }
    };

    const loadConfig = async () => {
      setLoading(true);
      try {
        await ensureColumns();
        const { data, error } = await supabase
          .from("site_config")
          .select("*")
          .eq("id", 1)
          .maybeSingle();

        if (error) throw error;

        const initial: SiteConfig = {
          id: 1,
          ga_measurement_id: data?.ga_measurement_id || "",
          ga_enabled: data?.ga_enabled ?? true,
          gtm_container_id: data?.gtm_container_id || "",
          gtm_enabled: data?.gtm_enabled ?? true,
          fb_pixel_id: data?.fb_pixel_id || "",
          fb_pixel_enabled: data?.fb_pixel_enabled ?? true,
        };
        setConfig(initial);
      } catch (e) {
        console.error("[MarketingTab] loadConfig error:", e);
        toast.error("Falha ao carregar configurações.");
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSitemapUrl(`${window.location.origin}/sitemap.xml`);
    }
  }, []);

  const loadSitemapPreview = async () => {
    setSitemapLoading(true);
    try {
      const requestUrl = `${sitemapUrl}${sitemapUrl.includes("?") ? "&" : "?"}preview_ts=${Date.now()}`;
      const response = await fetch(requestUrl, { cache: "no-store" });
      const xml = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!xml.includes("<urlset")) {
        throw new Error("O endpoint não retornou um sitemap válido.");
      }
      setSitemapXml(xml);
    } catch (e: any) {
      console.error("[MarketingTab] sitemap preview error:", e);
      toast.error(e?.message || "Falha ao carregar sitemap.xml.");
      setSitemapXml("");
    } finally {
      setSitemapLoading(false);
    }
  };

  useEffect(() => {
    if (!sitemapUrl) return;
    void loadSitemapPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitemapUrl]);

  const copyToClipboard = async (value: string, successMessage: string) => {
    if (!value) {
      toast.error("Nada para copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const downloadSitemap = () => {
    if (!sitemapXml) {
      toast.error("Gere a prévia do sitemap antes de baixar.");
      return;
    }
    const blob = new Blob([sitemapXml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sitemap.xml";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Download do sitemap.xml iniciado.");
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const payload = {
        id: 1,
        ga_measurement_id: (config.ga_measurement_id || "").trim(),
        ga_enabled: !!config.ga_enabled,
        gtm_container_id: (config.gtm_container_id || "").trim(),
        gtm_enabled: !!config.gtm_enabled,
        fb_pixel_id: (config.fb_pixel_id || "").trim(),
        fb_pixel_enabled: !!config.fb_pixel_enabled,
      };

      const { error } = await supabase
        .from("site_config")
        .update(payload)
        .eq("id", 1);

      if (error) throw error;
      toast.success("Configurações de marketing salvas!");
    } catch (e) {
      console.error("[MarketingTab] save error:", e);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Marketing e Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Google Analytics (Measurement ID)</Label>
              <Input
                placeholder="Ex: G-XXXXXXXXXX"
                value={config?.ga_measurement_id || ""}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, ga_measurement_id: e.target.value } : prev)}
              />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Ativar GA</span>
                <Switch
                  checked={!!config?.ga_enabled}
                  onCheckedChange={(v) => setConfig((prev) => prev ? { ...prev, ga_enabled: v } : prev)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Google Tag Manager (Container ID)</Label>
              <Input
                placeholder="Ex: GTM-XXXXXXX"
                value={config?.gtm_container_id || ""}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, gtm_container_id: e.target.value } : prev)}
              />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Ativar GTM</span>
                <Switch
                  checked={!!config?.gtm_enabled}
                  onCheckedChange={(v) => setConfig((prev) => prev ? { ...prev, gtm_enabled: v } : prev)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Facebook Pixel (ID)</Label>
            <Input
              placeholder="Ex: 123456789012345"
              value={config?.fb_pixel_id || ""}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, fb_pixel_id: e.target.value } : prev)}
            />
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">Ativar Pixel</span>
              <Switch
                checked={!!config?.fb_pixel_enabled}
                onCheckedChange={(v) => setConfig((prev) => prev ? { ...prev, fb_pixel_enabled: v } : prev)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sitemap XML</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL pública do sitemap</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={sitemapUrl} readOnly />
              <Button type="button" variant="outline" className="gap-2 sm:shrink-0" onClick={() => window.open(sitemapUrl, "_blank", "noopener,noreferrer")}>
                <ExternalLink className="h-4 w-4" />
                Abrir
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => void loadSitemapPreview()} disabled={sitemapLoading}>
              {sitemapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
              Atualizar prévia
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => void copyToClipboard(sitemapUrl, "URL do sitemap copiada.")}>
              <Copy className="h-4 w-4" />
              Copiar URL
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => void copyToClipboard(sitemapXml, "XML do sitemap copiado.")} disabled={!sitemapXml}>
              <Copy className="h-4 w-4" />
              Copiar XML
            </Button>
            <Button type="button" className="gap-2" onClick={downloadSitemap} disabled={!sitemapXml}>
              <Download className="h-4 w-4" />
              Baixar sitemap.xml
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Prévia do sitemap.xml</Label>
            <textarea
              className="min-h-[260px] w-full rounded-md border bg-muted/30 p-3 font-mono text-xs"
              value={sitemapXml || (sitemapLoading ? "Carregando sitemap..." : "Sitemap indisponível no momento.")}
              readOnly
            />
          </div>
        </CardContent>
      </Card>

      <UtmShortLinksCard />
    </div>
  );
};

export default MarketingTab;
