"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/use-site-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, ImagePlus, Loader2, Plus, RefreshCw, Save, Smartphone, Trash2 } from "lucide-react";

type ImageField = "pwa_icon_192_url" | "pwa_icon_512_url" | "pwa_maskable_icon_url" | "pwa_install_image_url";

type ManifestScreenshot = {
  id: string;
  src: string;
  sizes: string;
  type: string;
  label: string;
  form_factor: "narrow" | "wide";
};

const defaults = {
  pwa_app_name: "HomeCare Match",
  pwa_short_name: "HomeCare",
  pwa_description: "Conectando profissionais de saude as melhores oportunidades em Home Care.",
  pwa_theme_color: "#0f172a",
  pwa_background_color: "#ffffff",
  pwa_install_title: "Instale o app HomeCare Match",
  pwa_install_description: "Acesse mais rapido pelo seu celular, direto da tela inicial.",
};

const createScreenshot = (): ManifestScreenshot => ({
  id: crypto.randomUUID(),
  src: "",
  sizes: "1080x1920",
  type: "image/png",
  label: "",
  form_factor: "narrow",
});

const normalizeScreenshots = (value: unknown): ManifestScreenshot[] => {
  if (!Array.isArray(value)) return [];

  const parsed = value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      id: crypto.randomUUID(),
      src: typeof item.src === "string" ? item.src : "",
      sizes: typeof item.sizes === "string" ? item.sizes : "1080x1920",
      type: typeof item.type === "string" ? item.type : "image/png",
      label: typeof item.label === "string" ? item.label : "",
      form_factor: item.form_factor === "wide" ? "wide" : "narrow",
    }))
    .filter((item) => item.src.trim() || item.label.trim());

  return parsed;
};

const PwaSettingsPage = () => {
  const { data: config, isLoading } = useSiteConfig();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    ...defaults,
    pwa_icon_192_url: "",
    pwa_icon_512_url: "",
    pwa_maskable_icon_url: "",
    pwa_install_image_url: "",
    pwa_screenshots_json: [] as ManifestScreenshot[],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadingField, setUploadingField] = useState<ImageField | null>(null);
  const [uploadingScreenshotId, setUploadingScreenshotId] = useState<string | null>(null);

  const icon192Ref = useRef<HTMLInputElement>(null);
  const icon512Ref = useRef<HTMLInputElement>(null);
  const maskableRef = useRef<HTMLInputElement>(null);
  const installImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!config) return;

    setFormData({
      pwa_app_name: config.pwa_app_name || defaults.pwa_app_name,
      pwa_short_name: config.pwa_short_name || defaults.pwa_short_name,
      pwa_description: config.pwa_description || defaults.pwa_description,
      pwa_theme_color: config.pwa_theme_color || defaults.pwa_theme_color,
      pwa_background_color: config.pwa_background_color || defaults.pwa_background_color,
      pwa_install_title: config.pwa_install_title || defaults.pwa_install_title,
      pwa_install_description: config.pwa_install_description || defaults.pwa_install_description,
      pwa_icon_192_url: config.pwa_icon_192_url || "",
      pwa_icon_512_url: config.pwa_icon_512_url || "",
      pwa_maskable_icon_url: config.pwa_maskable_icon_url || "",
      pwa_install_image_url: config.pwa_install_image_url || "",
      pwa_screenshots_json: normalizeScreenshots(config.pwa_screenshots_json),
    });
  }, [config]);

  const syncBaseStructure = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("extend-site-config");
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Estrutura PWA sincronizada com sucesso.");
    } catch {
      toast.error("Nao foi possivel sincronizar a estrutura PWA.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>, field: ImageField) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingField(field);

    const ext = file.name.split(".").pop() || "png";
    const fileName = `${field}_${Date.now()}.${ext}`;
    const filePath = `pwa-assets/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from("uploads").upload(filePath, file, {
        upsert: true,
        cacheControl: "31536000",
      });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("uploads").getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, [field]: publicUrl }));
      toast.success("Imagem enviada com sucesso.");
    } catch {
      toast.error("Falha no upload da imagem.");
    } finally {
      setUploadingField(null);
      event.target.value = "";
    }
  };

  const handleScreenshotUpload = async (event: ChangeEvent<HTMLInputElement>, screenshotId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingScreenshotId(screenshotId);

    const ext = file.name.split(".").pop() || "png";
    const fileName = `screenshot_${Date.now()}_${screenshotId}.${ext}`;
    const filePath = `pwa-screenshots/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage.from("uploads").upload(filePath, file, {
        upsert: true,
        cacheControl: "31536000",
      });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("uploads").getPublicUrl(filePath);

      setFormData((prev) => ({
        ...prev,
        pwa_screenshots_json: prev.pwa_screenshots_json.map((item) =>
          item.id === screenshotId
            ? { ...item, src: publicUrl, type: file.type || item.type || "image/png" }
            : item,
        ),
      }));

      toast.success("Screenshot enviada com sucesso.");
    } catch {
      toast.error("Falha no upload da screenshot.");
    } finally {
      setUploadingScreenshotId(null);
      event.target.value = "";
    }
  };

  const updateScreenshot = (screenshotId: string, patch: Partial<ManifestScreenshot>) => {
    setFormData((prev) => ({
      ...prev,
      pwa_screenshots_json: prev.pwa_screenshots_json.map((item) =>
        item.id === screenshotId ? { ...item, ...patch } : item,
      ),
    }));
  };

  const addScreenshot = () => {
    setFormData((prev) => ({
      ...prev,
      pwa_screenshots_json: [...prev.pwa_screenshots_json, createScreenshot()],
    }));
  };

  const removeScreenshot = (screenshotId: string) => {
    setFormData((prev) => ({
      ...prev,
      pwa_screenshots_json: prev.pwa_screenshots_json.filter((item) => item.id !== screenshotId),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const screenshotsForManifest = formData.pwa_screenshots_json
        .map((item) => ({
          src: item.src.trim(),
          sizes: item.sizes.trim(),
          type: item.type.trim() || "image/png",
          label: item.label.trim() || undefined,
          form_factor: item.form_factor,
        }))
        .filter((item) => item.src && item.sizes);

      const { error } = await supabase
        .from("site_config")
        .update({
          pwa_app_name: formData.pwa_app_name,
          pwa_short_name: formData.pwa_short_name,
          pwa_description: formData.pwa_description,
          pwa_theme_color: formData.pwa_theme_color,
          pwa_background_color: formData.pwa_background_color,
          pwa_install_title: formData.pwa_install_title,
          pwa_install_description: formData.pwa_install_description,
          pwa_icon_192_url: formData.pwa_icon_192_url || null,
          pwa_icon_512_url: formData.pwa_icon_512_url || null,
          pwa_maskable_icon_url: formData.pwa_maskable_icon_url || null,
          pwa_install_image_url: formData.pwa_install_image_url || null,
          pwa_screenshots_json: screenshotsForManifest,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) {
        if (error.message.includes("column") || error.code === "42703") {
          toast.error("Campos PWA ainda nao existem no banco.", {
            description: "Clique em 'Sincronizar Estrutura PWA' e tente novamente.",
          });
          return;
        }
        throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Configuracoes PWA salvas.");
    } catch {
      toast.error("Nao foi possivel salvar as configuracoes PWA.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const imageButtons: Array<{ label: string; field: ImageField; ref: RefObject<HTMLInputElement> }> = [
    { label: "Icone 192x192", field: "pwa_icon_192_url", ref: icon192Ref },
    { label: "Icone 512x512", field: "pwa_icon_512_url", ref: icon512Ref },
    { label: "Icone Maskable", field: "pwa_maskable_icon_url", ref: maskableRef },
    { label: "Imagem do Prompt", field: "pwa_install_image_url", ref: installImageRef },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">PWA Android</h1>
        <p className="text-muted-foreground">Configure o app instalavel (nome, descricao, cores, icones, screenshots e prompt).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Identidade do App
          </CardTitle>
          <CardDescription>Esses textos aparecem no manifesto e no prompt de instalacao.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do App</Label>
              <Input
                value={formData.pwa_app_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, pwa_app_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nome Curto</Label>
              <Input
                value={formData.pwa_short_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, pwa_short_name: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descricao do App</Label>
            <Input
              value={formData.pwa_description}
              onChange={(e) => setFormData((prev) => ({ ...prev, pwa_description: e.target.value }))}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Titulo do Prompt</Label>
              <Input
                value={formData.pwa_install_title}
                onChange={(e) => setFormData((prev) => ({ ...prev, pwa_install_title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Texto do Prompt</Label>
              <Input
                value={formData.pwa_install_description}
                onChange={(e) => setFormData((prev) => ({ ...prev, pwa_install_description: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor Tema</Label>
              <Input
                type="color"
                value={formData.pwa_theme_color}
                onChange={(e) => setFormData((prev) => ({ ...prev, pwa_theme_color: e.target.value }))}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor de Fundo</Label>
              <Input
                type="color"
                value={formData.pwa_background_color}
                onChange={(e) => setFormData((prev) => ({ ...prev, pwa_background_color: e.target.value }))}
                className="h-11"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-primary" />
            Imagens do PWA
          </CardTitle>
          <CardDescription>Use PNG para icones (recomendado) e imagem leve no prompt.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            {imageButtons.map((item) => (
              <div key={item.field} className="rounded-lg border p-3 space-y-2">
                <Label>{item.label}</Label>
                {formData[item.field] ? (
                  <img src={formData[item.field]} alt={item.label} className="h-16 w-16 object-cover rounded border" />
                ) : (
                  <div className="h-16 w-16 rounded border bg-muted/40" />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => item.ref.current?.click()}
                  disabled={uploadingField === item.field}
                  className="w-full gap-2"
                >
                  {uploadingField === item.field ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Enviar
                </Button>
                <input
                  ref={item.ref}
                  type="file"
                  accept="image/png,image/webp,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={(e) => handleUpload(e, item.field)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Screenshots do Manifest</span>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={addScreenshot}>
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </CardTitle>
          <CardDescription>
            Essas screenshots ajudam na apresentacao do app instalavel no Android. Informe tamanho real (ex: 1080x1920).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.pwa_screenshots_json.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Nenhuma screenshot cadastrada.
            </div>
          ) : (
            formData.pwa_screenshots_json.map((screenshot) => (
              <div key={screenshot.id} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-20 w-12 rounded border bg-muted/30 overflow-hidden">
                      {screenshot.src ? (
                        <img src={screenshot.src} alt={screenshot.label || "Screenshot"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{screenshot.label || "Screenshot"}</p>
                      <p className="text-xs text-muted-foreground">{screenshot.sizes || "1080x1920"}</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeScreenshot(screenshot.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Label</Label>
                    <Input
                      value={screenshot.label}
                      onChange={(e) => updateScreenshot(screenshot.id, { label: e.target.value })}
                      placeholder="Tela inicial"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Sizes</Label>
                    <Input
                      value={screenshot.sizes}
                      onChange={(e) => updateScreenshot(screenshot.id, { sizes: e.target.value })}
                      placeholder="1080x1920"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Tipo</Label>
                    <Input
                      value={screenshot.type}
                      onChange={(e) => updateScreenshot(screenshot.id, { type: e.target.value })}
                      placeholder="image/png"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Form Factor</Label>
                    <select
                      value={screenshot.form_factor}
                      onChange={(e) =>
                        updateScreenshot(screenshot.id, {
                          form_factor: e.target.value === "wide" ? "wide" : "narrow",
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="narrow">narrow (mobile)</option>
                      <option value="wide">wide (tablet)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>URL da Screenshot</Label>
                  <Input
                    value={screenshot.src}
                    onChange={(e) => updateScreenshot(screenshot.id, { src: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-1">
                  <Label>Upload de arquivo</Label>
                  <Input
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    onChange={(e) => handleScreenshotUpload(e, screenshot.id)}
                    disabled={uploadingScreenshotId === screenshot.id}
                  />
                  {uploadingScreenshotId === screenshot.id ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Enviando screenshot...
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Previa rapida</CardTitle>
          <CardDescription>Exemplo visual do prompt de instalacao.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md rounded-xl border p-4 shadow-sm" style={{ backgroundColor: formData.pwa_background_color }}>
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-lg overflow-hidden border shrink-0 bg-white">
                {formData.pwa_icon_192_url ? (
                  <img src={formData.pwa_icon_192_url} alt="icone" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-muted" />
                )}
              </div>
              <div>
                <p className="font-semibold" style={{ color: formData.pwa_theme_color }}>{formData.pwa_install_title}</p>
                <p className="text-sm text-muted-foreground">{formData.pwa_install_description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Screenshots configuradas: {formData.pwa_screenshots_json.filter((item) => item.src.trim() && item.sizes.trim()).length}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={syncBaseStructure} disabled={isSyncing} className="gap-2">
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar Estrutura PWA
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configuracoes
        </Button>
      </div>
    </div>
  );
};

export default PwaSettingsPage;