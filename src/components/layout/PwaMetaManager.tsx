import { useEffect, useMemo } from "react";
import { useSiteConfig } from "@/hooks/use-site-config";

const FALLBACK_ICON = "/favicon.png";
type PwaManifestScreenshot = {
  src: string;
  sizes: string;
  type: string;
  label?: string;
  form_factor?: "narrow" | "wide";
};

const toScreenshots = (value: unknown): PwaManifestScreenshot[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => {
      const src = typeof item.src === "string" ? item.src.trim() : "";
      const sizes = typeof item.sizes === "string" ? item.sizes.trim() : "";
      const type = typeof item.type === "string" ? item.type.trim() : "image/png";
      const label = typeof item.label === "string" ? item.label.trim() : undefined;
      const formFactor =
        item.form_factor === "narrow" || item.form_factor === "wide" ? item.form_factor : undefined;

      return {
        src,
        sizes,
        type: type || "image/png",
        label: label || undefined,
        form_factor: formFactor,
      };
    })
    .filter((item) => item.src && item.sizes);
};

const ensureMeta = (name: string, attr: "name" | "property" = "name") => {
  const selector = `meta[${attr}="${name}"]`;
  const found = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (found) return found;

  const meta = document.createElement("meta");
  meta.setAttribute(attr, name);
  document.head.appendChild(meta);
  return meta;
};

const ensureLink = (rel: string) => {
  const found = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (found) return found;

  const link = document.createElement("link");
  link.rel = rel;
  document.head.appendChild(link);
  return link;
};

const PwaMetaManager = () => {
  const { data: config } = useSiteConfig();

  const manifestPayload = useMemo(() => {
    const name = config?.pwa_app_name || "HomeCare Match";
    const shortName = config?.pwa_short_name || "HomeCare";
    const description =
      config?.pwa_description || "Conectando profissionais de saúde às melhores oportunidades em Home Care.";
    const themeColor = config?.pwa_theme_color || "#0f172a";
    const backgroundColor = config?.pwa_background_color || "#ffffff";

    const icon192 = config?.pwa_icon_192_url || config?.favicon_url || FALLBACK_ICON;
    const icon512 = config?.pwa_icon_512_url || config?.favicon_url || FALLBACK_ICON;
    const maskable = config?.pwa_maskable_icon_url || icon512;
    const screenshots = toScreenshots(config?.pwa_screenshots_json);

    return {
      id: "/",
      name,
      short_name: shortName,
      description,
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      theme_color: themeColor,
      background_color: backgroundColor,
      lang: "pt-BR",
      icons: [
        { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: maskable, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      screenshots,
    };
  }, [
    config?.favicon_url,
    config?.pwa_app_name,
    config?.pwa_background_color,
    config?.pwa_description,
    config?.pwa_icon_192_url,
    config?.pwa_icon_512_url,
    config?.pwa_maskable_icon_url,
    config?.pwa_screenshots_json,
    config?.pwa_short_name,
    config?.pwa_theme_color,
  ]);

  useEffect(() => {
    const manifestBlob = new Blob([JSON.stringify(manifestPayload)], { type: "application/manifest+json" });
    const manifestUrl = URL.createObjectURL(manifestBlob);

    const manifestLink = ensureLink("manifest");
    manifestLink.href = manifestUrl;

    const themeMeta = ensureMeta("theme-color");
    themeMeta.content = manifestPayload.theme_color;

    const appNameMeta = ensureMeta("application-name");
    appNameMeta.content = manifestPayload.name;

    const appleTitleMeta = ensureMeta("apple-mobile-web-app-title");
    appleTitleMeta.content = manifestPayload.short_name;

    const appleCapableMeta = ensureMeta("apple-mobile-web-app-capable");
    appleCapableMeta.content = "yes";

    const appleStatusBarMeta = ensureMeta("apple-mobile-web-app-status-bar-style");
    appleStatusBarMeta.content = "default";

    const appleTouchIcon = ensureLink("apple-touch-icon");
    appleTouchIcon.href = manifestPayload.icons[0]?.src || FALLBACK_ICON;

    return () => {
      URL.revokeObjectURL(manifestUrl);
    };
  }, [manifestPayload]);

  return null;
};

export default PwaMetaManager;
