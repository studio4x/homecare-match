"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";
import { useSiteConfig } from "@/hooks/use-site-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Download, ImagePlus, Loader2, Plus, RefreshCw, Save, Smartphone, Trash2, WandSparkles } from "lucide-react";

type ImageField = "pwa_icon_192_url" | "pwa_icon_512_url" | "pwa_maskable_icon_url" | "pwa_install_image_url";
type PwaAssetKey =
  | "icon_192x192"
  | "icon_512x512"
  | "icon_512x512_maskable"
  | "apple_touch_icon_180x180"
  | "apple_touch_icon_167x167"
  | "apple_touch_icon_152x152"
  | "favicon_16x16"
  | "favicon_32x32"
  | "favicon_ico"
  | "mstile_144x144"
  | "splash_640x1136"
  | "splash_750x1334"
  | "splash_828x1792"
  | "splash_1125x2436"
  | "splash_1170x2532"
  | "splash_1242x2208"
  | "splash_1242x2688"
  | "splash_1284x2778"
  | "splash_1536x2048"
  | "splash_1668x2224"
  | "splash_1668x2388"
  | "splash_2048x2732";

type PwaAssetsMap = Partial<Record<PwaAssetKey, string>>;
type PwaAssetCategory = "icons" | "apple" | "favicon" | "windows" | "splash";
type PwaAssetKind = "icon" | "maskable" | "splash" | "manual";

type PwaAssetSpec = {
  key: PwaAssetKey;
  label: string;
  category: PwaAssetCategory;
  required: boolean;
  recommended: boolean;
  auto: boolean;
  kind: PwaAssetKind;
  width?: number;
  height?: number;
  fileName: string;
};

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

const pwaAssetSpecs: PwaAssetSpec[] = [
  { key: "icon_192x192", label: "icon-192x192.png", category: "icons", required: true, recommended: true, auto: true, kind: "icon", width: 192, height: 192, fileName: "icon-192x192.png" },
  { key: "icon_512x512", label: "icon-512x512.png", category: "icons", required: true, recommended: true, auto: true, kind: "icon", width: 512, height: 512, fileName: "icon-512x512.png" },
  { key: "icon_512x512_maskable", label: "icon-512x512-maskable.png", category: "icons", required: true, recommended: true, auto: true, kind: "maskable", width: 512, height: 512, fileName: "icon-512x512-maskable.png" },
  { key: "apple_touch_icon_180x180", label: "apple-touch-icon.png", category: "apple", required: true, recommended: true, auto: true, kind: "icon", width: 180, height: 180, fileName: "apple-touch-icon.png" },
  { key: "apple_touch_icon_167x167", label: "apple-touch-icon-167x167.png", category: "apple", required: false, recommended: false, auto: true, kind: "icon", width: 167, height: 167, fileName: "apple-touch-icon-167x167.png" },
  { key: "apple_touch_icon_152x152", label: "apple-touch-icon-152x152.png", category: "apple", required: false, recommended: false, auto: true, kind: "icon", width: 152, height: 152, fileName: "apple-touch-icon-152x152.png" },
  { key: "favicon_16x16", label: "favicon-16x16.png", category: "favicon", required: true, recommended: true, auto: true, kind: "icon", width: 16, height: 16, fileName: "favicon-16x16.png" },
  { key: "favicon_32x32", label: "favicon-32x32.png", category: "favicon", required: true, recommended: true, auto: true, kind: "icon", width: 32, height: 32, fileName: "favicon-32x32.png" },
  { key: "favicon_ico", label: "favicon.ico", category: "favicon", required: true, recommended: false, auto: false, kind: "manual", fileName: "favicon.ico" },
  { key: "mstile_144x144", label: "mstile-144x144.png", category: "windows", required: true, recommended: false, auto: true, kind: "icon", width: 144, height: 144, fileName: "mstile-144x144.png" },
  { key: "splash_640x1136", label: "splash-640x1136.png", category: "splash", required: true, recommended: false, auto: true, kind: "splash", width: 640, height: 1136, fileName: "splash-640x1136.png" },
  { key: "splash_750x1334", label: "splash-750x1334.png", category: "splash", required: true, recommended: false, auto: true, kind: "splash", width: 750, height: 1334, fileName: "splash-750x1334.png" },
  { key: "splash_828x1792", label: "splash-828x1792.png", category: "splash", required: true, recommended: true, auto: true, kind: "splash", width: 828, height: 1792, fileName: "splash-828x1792.png" },
  { key: "splash_1125x2436", label: "splash-1125x2436.png", category: "splash", required: true, recommended: false, auto: true, kind: "splash", width: 1125, height: 2436, fileName: "splash-1125x2436.png" },
  { key: "splash_1170x2532", label: "splash-1170x2532.png", category: "splash", required: true, recommended: true, auto: true, kind: "splash", width: 1170, height: 2532, fileName: "splash-1170x2532.png" },
  { key: "splash_1242x2208", label: "splash-1242x2208.png", category: "splash", required: true, recommended: false, auto: true, kind: "splash", width: 1242, height: 2208, fileName: "splash-1242x2208.png" },
  { key: "splash_1242x2688", label: "splash-1242x2688.png", category: "splash", required: true, recommended: false, auto: true, kind: "splash", width: 1242, height: 2688, fileName: "splash-1242x2688.png" },
  { key: "splash_1284x2778", label: "splash-1284x2778.png", category: "splash", required: true, recommended: true, auto: true, kind: "splash", width: 1284, height: 2778, fileName: "splash-1284x2778.png" },
  { key: "splash_1536x2048", label: "splash-1536x2048.png", category: "splash", required: true, recommended: true, auto: true, kind: "splash", width: 1536, height: 2048, fileName: "splash-1536x2048.png" },
  { key: "splash_1668x2224", label: "splash-1668x2224.png", category: "splash", required: true, recommended: false, auto: true, kind: "splash", width: 1668, height: 2224, fileName: "splash-1668x2224.png" },
  { key: "splash_1668x2388", label: "splash-1668x2388.png", category: "splash", required: true, recommended: false, auto: true, kind: "splash", width: 1668, height: 2388, fileName: "splash-1668x2388.png" },
  { key: "splash_2048x2732", label: "splash-2048x2732.png", category: "splash", required: true, recommended: false, auto: true, kind: "splash", width: 2048, height: 2732, fileName: "splash-2048x2732.png" },
];

const minimumRecommendedKeys = new Set<PwaAssetKey>([
  "icon_192x192",
  "icon_512x512",
  "icon_512x512_maskable",
  "apple_touch_icon_180x180",
  "favicon_16x16",
  "favicon_32x32",
  "splash_1170x2532",
  "splash_1284x2778",
  "splash_828x1792",
  "splash_1536x2048",
]);

const categoryLabels: Record<PwaAssetCategory, string> = {
  icons: "Icones principais (manifest)",
  apple: "Apple touch icon (iOS)",
  favicon: "Favicons",
  windows: "Windows tile",
  splash: "Splash screens iOS (retrato)",
};

const createScreenshot = (): ManifestScreenshot => ({
  id: crypto.randomUUID(),
  src: "",
  sizes: "1080x2400",
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
      sizes: typeof item.sizes === "string" ? item.sizes : "1080x2400",
      type: typeof item.type === "string" ? item.type : "image/png",
      label: typeof item.label === "string" ? item.label : "",
      form_factor: item.form_factor === "wide" ? "wide" : "narrow",
    }))
    .filter((item) => item.src.trim() || item.label.trim());

  return parsed;
};

const normalizeAssetsMap = (value: unknown): PwaAssetsMap => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const result: PwaAssetsMap = {};
  for (const spec of pwaAssetSpecs) {
    const maybeUrl = raw[spec.key];
    if (typeof maybeUrl === "string" && maybeUrl.trim()) {
      result[spec.key] = maybeUrl.trim();
    }
  }
  return result;
};

const parseScreenshotSizes = (value: string) => {
  const match = value.trim().match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
};

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel ler a imagem base."));
    };
    image.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Falha ao gerar imagem."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });

const drawImageAsset = async (
  source: HTMLImageElement,
  width: number,
  height: number,
  options?: { paddingRatio?: number; backgroundColor?: string },
) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponivel.");

  if (options?.backgroundColor) {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  const paddingRatio = options?.paddingRatio || 0;
  const innerW = width * (1 - paddingRatio * 2);
  const innerH = height * (1 - paddingRatio * 2);
  const scale = Math.min(innerW / source.width, innerH / source.height);
  const drawW = source.width * scale;
  const drawH = source.height * scale;
  const x = (width - drawW) / 2;
  const y = (height - drawH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, x, y, drawW, drawH);

  return canvasToBlob(canvas);
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
    pwa_assets_json: {} as PwaAssetsMap,
    pwa_screenshots_json: [] as ManifestScreenshot[],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadingField, setUploadingField] = useState<ImageField | null>(null);
  const [uploadingScreenshotId, setUploadingScreenshotId] = useState<string | null>(null);
  const [uploadingAssetKey, setUploadingAssetKey] = useState<PwaAssetKey | null>(null);
  const [isGeneratingPack, setIsGeneratingPack] = useState<"minimum" | "full" | null>(null);
  const [baseAssetFile, setBaseAssetFile] = useState<File | null>(null);
  const [selectedAssetKey, setSelectedAssetKey] = useState<PwaAssetKey>("favicon_ico");
  const [manualAssetUrl, setManualAssetUrl] = useState("");
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);

  const icon192Ref = useRef<HTMLInputElement>(null);
  const icon512Ref = useRef<HTMLInputElement>(null);
  const maskableRef = useRef<HTMLInputElement>(null);
  const installImageRef = useRef<HTMLInputElement>(null);
  const baseAssetRef = useRef<HTMLInputElement>(null);
  const manualAssetRef = useRef<HTMLInputElement>(null);

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
      pwa_assets_json: normalizeAssetsMap(config.pwa_assets_json),
      pwa_screenshots_json: normalizeScreenshots(config.pwa_screenshots_json),
    });
  }, [config]);

  useEffect(() => {
    const fromMap =
      selectedAssetKey === "icon_192x192"
        ? formData.pwa_icon_192_url
        : selectedAssetKey === "icon_512x512"
        ? formData.pwa_icon_512_url
        : selectedAssetKey === "icon_512x512_maskable"
        ? formData.pwa_maskable_icon_url
        : formData.pwa_assets_json[selectedAssetKey] || "";
    setManualAssetUrl(fromMap);
  }, [formData.pwa_assets_json, formData.pwa_icon_192_url, formData.pwa_icon_512_url, formData.pwa_maskable_icon_url, selectedAssetKey]);

  const probePwaStructure = async () => {
    const { error } = await supabase
      .from("site_config")
      .select("id,pwa_app_name,pwa_short_name,pwa_icon_192_url,pwa_assets_json,pwa_screenshots_json")
      .eq("id", 1)
      .single();

    if (!error) return { ready: true, reason: "" };

    const reason = String(error.message || "");
    const missingColumn =
      /column .* does not exist/i.test(reason) ||
      /could not find the .* column/i.test(reason) ||
      /schema cache/i.test(reason);

    if (missingColumn) return { ready: false, reason };

    throw error;
  };

  const syncBaseStructure = async () => {
    setIsSyncing(true);
    let hadMissingColumnsBeforeCall = false;
    try {
      const beforeProbe = await probePwaStructure();
      if (beforeProbe.ready) {
        toast.success("Estrutura PWA ja sincronizada.");
        return;
      }
      hadMissingColumnsBeforeCall = true;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data: refreshed } = await supabase.auth.refreshSession();
      const accessToken = refreshed.session?.access_token || session?.access_token || "";

      if (!accessToken) {
        toast.error("Sessao expirada para sincronizacao.", {
          description: "Faca login novamente e tente de novo.",
        });
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/extend-site-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const payload = await response.json();
          const message = typeof payload?.error === "string" ? payload.error : "";
          const extra = typeof payload?.details === "string" ? payload.details : "";
          const text = [message, extra].filter(Boolean).join(" - ");
          if (text) detail = text;
        } catch {
          // noop: detail remains status code
        }
        const error = new Error(detail) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      toast.success("Estrutura PWA sincronizada com sucesso.");
    } catch (err: any) {
      const rawMessage = String(err?.message || "");
      console.error("[PWA] syncBaseStructure error:", err);
      const statusCode =
        Number(err?.status) ||
        Number(err?.context?.status) ||
        (/\b401\b/.test(rawMessage) ? 401 : undefined);

      if (statusCode === 401 || /unauthorized|jwt/i.test(rawMessage)) {
        if (!hadMissingColumnsBeforeCall) {
          try {
            const afterProbe = await probePwaStructure();
            if (afterProbe.ready) {
              await queryClient.invalidateQueries({ queryKey: ["site-config"] });
              toast.success("Estrutura PWA ja sincronizada.");
              return;
            }
          } catch {
            // noop: keep unauthorized message below
          }
        }

        toast.error("Nao autorizado para sincronizar estrutura PWA.", {
          description: "A funcao de sincronizacao esta bloqueada no backend (HTTP 401).",
        });
        return;
      }

      if (statusCode === 404 || /not found/i.test(rawMessage)) {
        toast.error("Funcao 'extend-site-config' nao encontrada.", {
          description: "Publique/deploy a edge function no Supabase e tente novamente.",
        });
        return;
      }

      const detail = rawMessage || "Erro desconhecido ao sincronizar.";
      toast.error("Nao foi possivel sincronizar a estrutura PWA.", {
        description: detail.slice(0, 180),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getAssetUrlByKey = (key: PwaAssetKey): string => {
    if (key === "icon_192x192") return formData.pwa_icon_192_url || "";
    if (key === "icon_512x512") return formData.pwa_icon_512_url || "";
    if (key === "icon_512x512_maskable") return formData.pwa_maskable_icon_url || "";
    return formData.pwa_assets_json[key] || "";
  };

  const applyAssetUrl = (key: PwaAssetKey, url: string) => {
    const clean = url.trim();
    setFormData((prev) => {
      const nextAssets = { ...prev.pwa_assets_json };
      if (clean) nextAssets[key] = clean;
      else delete nextAssets[key];

      const next = { ...prev, pwa_assets_json: nextAssets };
      if (key === "icon_192x192") next.pwa_icon_192_url = clean;
      if (key === "icon_512x512") next.pwa_icon_512_url = clean;
      if (key === "icon_512x512_maskable") next.pwa_maskable_icon_url = clean;
      return next;
    });
  };

  const uploadToStorage = async (filePath: string, file: Blob, contentType = "image/png") => {
    const { error: uploadError } = await supabase.storage.from("uploads").upload(filePath, file, {
      upsert: true,
      cacheControl: "31536000",
      contentType,
    });
    if (uploadError) throw uploadError;
    const {
      data: { publicUrl },
    } = supabase.storage.from("uploads").getPublicUrl(filePath);
    return publicUrl;
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>, field: ImageField) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingField(field);

    const ext = file.name.split(".").pop() || "png";
    const fileName = `${field}_${Date.now()}.${ext}`;
    const filePath = `pwa-assets/${fileName}`;

    try {
      const publicUrl = await uploadToStorage(filePath, file, file.type || "image/png");
      setFormData((prev) => ({ ...prev, [field]: publicUrl }));
      if (field === "pwa_icon_192_url") applyAssetUrl("icon_192x192", publicUrl);
      if (field === "pwa_icon_512_url") applyAssetUrl("icon_512x512", publicUrl);
      if (field === "pwa_maskable_icon_url") applyAssetUrl("icon_512x512_maskable", publicUrl);
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
      const image = await loadImageFromFile(file);
      const realSizes = `${image.naturalWidth}x${image.naturalHeight}`;
      const inferredFormFactor: ManifestScreenshot["form_factor"] =
        image.naturalWidth > image.naturalHeight ? "wide" : "narrow";
      const publicUrl = await uploadToStorage(filePath, file, file.type || "image/png");

      setFormData((prev) => ({
        ...prev,
        pwa_screenshots_json: prev.pwa_screenshots_json.map((item) =>
          item.id === screenshotId
            ? {
                ...item,
                src: publicUrl,
                type: file.type || item.type || "image/png",
                sizes: realSizes,
                form_factor: inferredFormFactor,
              }
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

  const handleAssetUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAssetKey(selectedAssetKey);
    const ext = file.name.split(".").pop() || "png";
    const filePath = `pwa-assets/manual/${selectedAssetKey}_${Date.now()}.${ext}`;

    try {
      const publicUrl = await uploadToStorage(filePath, file, file.type || "application/octet-stream");
      applyAssetUrl(selectedAssetKey, publicUrl);
      setManualAssetUrl(publicUrl);
      toast.success("Asset enviado com sucesso.");
    } catch {
      toast.error("Falha no upload do asset.");
    } finally {
      setUploadingAssetKey(null);
      event.target.value = "";
    }
  };

  const generateAssetPack = async (mode: "minimum" | "full") => {
    if (!baseAssetFile) {
      toast.error("Selecione uma imagem base para gerar os assets.");
      return;
    }

    setIsGeneratingPack(mode);
    try {
      const source = await loadImageFromFile(baseAssetFile);
      const batchStamp = Date.now();
      const targets = pwaAssetSpecs.filter((spec) => {
        if (!spec.auto || !spec.width || !spec.height) return false;
        return mode === "full" ? true : minimumRecommendedKeys.has(spec.key);
      });

      const newUrls: Partial<Record<PwaAssetKey, string>> = {};
      for (const spec of targets) {
        const blob =
          spec.kind === "splash"
            ? await drawImageAsset(source, spec.width!, spec.height!, { backgroundColor: formData.pwa_background_color })
            : await drawImageAsset(source, spec.width!, spec.height!, {
                paddingRatio: spec.kind === "maskable" ? 0.2 : 0,
              });
        const filePath = `pwa-assets/generated/${spec.fileName.replace(".png", "")}_${batchStamp}.png`;
        newUrls[spec.key] = await uploadToStorage(filePath, blob, "image/png");
      }

      setFormData((prev) => {
        const merged = { ...prev.pwa_assets_json, ...newUrls };
        return {
          ...prev,
          pwa_assets_json: merged,
          pwa_icon_192_url: newUrls.icon_192x192 || prev.pwa_icon_192_url,
          pwa_icon_512_url: newUrls.icon_512x512 || prev.pwa_icon_512_url,
          pwa_maskable_icon_url: newUrls.icon_512x512_maskable || prev.pwa_maskable_icon_url,
        };
      });

      toast.success(
        `Pacote ${mode === "full" ? "completo" : "minimo"} gerado (${Object.keys(newUrls).length} arquivos). favicon.ico continua manual.`,
      );
    } catch (err) {
      console.error("[PWA] Erro ao gerar pacote:", err);
      toast.error("Nao foi possivel gerar o pacote automaticamente.");
    } finally {
      setIsGeneratingPack(null);
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
    setScreenshotsOpen(true);
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

      const invalidSizesItem = screenshotsForManifest.find((item) => !parseScreenshotSizes(item.sizes));
      if (invalidSizesItem) {
        toast.error("Formato invalido em 'Sizes' das screenshots.", {
          description: "Use o padrao LARGURAxALTURA, por exemplo 1080x2400.",
        });
        return;
      }

      const mismatchedFactorItem = screenshotsForManifest.find((item) => {
        const parsed = parseScreenshotSizes(item.sizes);
        if (!parsed) return false;
        if (item.form_factor === "narrow") return parsed.width >= parsed.height;
        return parsed.width <= parsed.height;
      });

      if (mismatchedFactorItem) {
        toast.error("Form Factor nao corresponde ao tamanho informado.", {
          description: "narrow deve ser vertical (altura maior) e wide deve ser horizontal (largura maior).",
        });
        return;
      }

      const assetsMap = Object.entries(formData.pwa_assets_json).reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value === "string" && value.trim()) {
          acc[key] = value.trim();
        }
        return acc;
      }, {});

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
          pwa_assets_json: assetsMap,
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

  const imageButtons: Array<{
    label: string;
    field: ImageField;
    ref: RefObject<HTMLInputElement>;
    recommendedSize: string;
    description: string;
    instruction: string;
  }> = [
    {
      label: "Icone 192x192",
      field: "pwa_icon_192_url",
      ref: icon192Ref,
      recommendedSize: "192x192",
      description: "Icone principal para Android (atalho do app e instalacao do PWA).",
      instruction: "Use PNG quadrado, nitido e com pouco texto. Este campo alimenta `icon-192x192.png` no checklist.",
    },
    {
      label: "Icone 512x512",
      field: "pwa_icon_512_url",
      ref: icon512Ref,
      recommendedSize: "512x512",
      description: "Icone de alta resolucao usado no manifesto e na instalacao.",
      instruction: "Use PNG quadrado em alta qualidade. Este campo alimenta `icon-512x512.png` no checklist.",
    },
    {
      label: "Icone Maskable",
      field: "pwa_maskable_icon_url",
      ref: maskableRef,
      recommendedSize: "512x512 (maskable)",
      description: "Icone adaptavel para launchers que recortam a arte automaticamente.",
      instruction: "Mantenha margem segura interna (~20%) para evitar corte visual. Este campo alimenta `icon-512x512-maskable.png`.",
    },
    {
      label: "Imagem do Prompt",
      field: "pwa_install_image_url",
      ref: installImageRef,
      recommendedSize: "1200x900 (ou similar)",
      description: "Imagem exibida no card/modal interno de convite para instalacao do app.",
      instruction: "Use arte leve e horizontal. Nao entra no manifesto; e apenas visual do prompt dentro da plataforma.",
    },
  ];

  const requiredSpecs = useMemo(() => pwaAssetSpecs.filter((item) => item.required), []);
  const recommendedSpecs = useMemo(() => pwaAssetSpecs.filter((item) => item.recommended), []);
  const requiredReady = requiredSpecs.filter((item) => !!getAssetUrlByKey(item.key)).length;
  const recommendedReady = recommendedSpecs.filter((item) => !!getAssetUrlByKey(item.key)).length;

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
          <CardDescription>
            Campos principais do PWA com orientacoes de tamanho e uso. Preferencia: PNG para icones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            {imageButtons.map((item) => (
              <div key={item.field} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>{item.label}</Label>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground">{item.recommendedSize}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <p className="text-xs text-muted-foreground">{item.instruction}</p>
                {formData[item.field] ? (
                  <img src={formData[item.field]} alt={item.label} className="h-16 w-16 object-cover rounded border" />
                ) : (
                  <div className="h-16 w-16 rounded border bg-muted/40" />
                )}
                {formData[item.field] ? (
                  <a href={formData[item.field]} target="_blank" rel="noreferrer" className="text-xs text-primary underline break-all">
                    {formData[item.field]}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem arquivo enviado.</p>
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
          <CardTitle className="flex items-center gap-2">
            <WandSparkles className="h-5 w-5 text-primary" />
            Automacao de Assets
          </CardTitle>
          <CardDescription>
            Gere automaticamente pacote minimo ou completo a partir de uma imagem base (PNG quadrado recomendado).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => baseAssetRef.current?.click()}>
                Selecionar imagem base
              </Button>
              <input
                ref={baseAssetRef}
                type="file"
                accept="image/png,image/webp,image/jpeg"
                className="hidden"
                onChange={(e) => setBaseAssetFile(e.target.files?.[0] || null)}
              />
              <span className="text-sm text-muted-foreground">
                {baseAssetFile ? baseAssetFile.name : "Nenhuma imagem selecionada"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => generateAssetPack("minimum")}
                disabled={!baseAssetFile || isGeneratingPack !== null}
              >
                {isGeneratingPack === "minimum" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                Gerar pacote minimo recomendado
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => generateAssetPack("full")}
                disabled={!baseAssetFile || isGeneratingPack !== null}
              >
                {isGeneratingPack === "full" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                Gerar pacote completo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Observacao: `favicon.ico` continua manual.</p>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <Label>Upload/URL manual para item selecionado</Label>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Item</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedAssetKey}
                  onChange={(e) => setSelectedAssetKey(e.target.value as PwaAssetKey)}
                >
                  {pwaAssetSpecs.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Arquivo</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => manualAssetRef.current?.click()}
                  disabled={uploadingAssetKey !== null}
                >
                  {uploadingAssetKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Enviar arquivo
                </Button>
                <input
                  ref={manualAssetRef}
                  type="file"
                  accept={selectedAssetKey === "favicon_ico" ? ".ico,image/x-icon" : "image/png,image/webp,image/jpeg"}
                  className="hidden"
                  onChange={handleAssetUpload}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>URL manual</Label>
              <div className="flex gap-2">
                <Input value={manualAssetUrl} onChange={(e) => setManualAssetUrl(e.target.value)} placeholder="https://..." />
                <Button type="button" variant="outline" onClick={() => applyAssetUrl(selectedAssetKey, manualAssetUrl)}>
                  Aplicar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => {
                    applyAssetUrl(selectedAssetKey, "");
                    setManualAssetUrl("");
                  }}
                >
                  Limpar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Checklist Completo de Imagens PWA</span>
            <span className="text-sm font-normal text-muted-foreground">
              Obrigatorios: {requiredReady}/{requiredSpecs.length} | Minimo recomendado: {recommendedReady}/{recommendedSpecs.length}
            </span>
          </CardTitle>
          <CardDescription>
            Lista completa solicitada: icones, Apple Touch, favicons, tile e splash iOS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(["icons", "apple", "favicon", "windows", "splash"] as PwaAssetCategory[]).map((category) => (
            <div key={category} className="space-y-2">
              <h3 className="text-sm font-semibold">{categoryLabels[category]}</h3>
              <div className="space-y-2">
                {pwaAssetSpecs
                  .filter((item) => item.category === category)
                  .map((item) => {
                    const url = getAssetUrlByKey(item.key);
                    const done = !!url;
                    return (
                      <div key={item.key} className="rounded-lg border p-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-sm font-medium">{item.label}</span>
                            {item.width && item.height ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                {item.width}x{item.height}
                              </span>
                            ) : null}
                            <span className={`text-xs px-2 py-0.5 rounded ${item.required ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                              {item.required ? "Obrigatorio" : "Opcional"}
                            </span>
                            {item.recommended ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Minimo</span>
                            ) : null}
                            <span className={`text-xs px-2 py-0.5 rounded ${item.auto ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                              {item.auto ? "Auto" : "Manual"}
                            </span>
                          </div>
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline break-all">
                              {url}
                            </a>
                          ) : (
                            <p className="text-xs text-muted-foreground">Sem arquivo configurado.</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {done ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Faltando
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAssetKey(item.key);
                              setManualAssetUrl(url);
                            }}
                          >
                            Selecionar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Screenshots do Manifest</span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="gap-2" onClick={addScreenshot}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => setScreenshotsOpen((prev) => !prev)}
              >
                {screenshotsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {screenshotsOpen ? "Recolher" : "Expandir"}
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Vertical e permitido e recomendado para mobile. Exemplo: 1080x2400 (narrow/retrato) ou 1920x1080 (wide/paisagem).
          </CardDescription>
        </CardHeader>
        {screenshotsOpen ? (
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
                        <p className="text-xs text-muted-foreground">{screenshot.sizes || "1080x2400"}</p>
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
                        placeholder="1080x2400"
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
                        <option value="narrow">narrow (mobile/retrato)</option>
                        <option value="wide">wide (tablet/paisagem)</option>
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
        ) : (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Secao recolhida. Screenshots cadastradas: {formData.pwa_screenshots_json.length}.
            </p>
          </CardContent>
        )}
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

