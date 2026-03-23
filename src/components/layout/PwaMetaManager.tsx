import { useEffect, useMemo } from "react";
import { useSiteConfig } from "@/hooks/use-site-config";

const FALLBACK_ICON_192 = "/icon-192x192.png";
const FALLBACK_ICON_512 = "/icon-512x512.png";
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
        form_factor: formFactor as "narrow" | "wide",
      };
    })
    .filter((item) => item.src && item.sizes);
};

const toAbsoluteUrl = (value: string, origin: string): string => {
  const clean = value.trim();
  if (!clean) return "";

  try {
    if (origin) return new URL(clean, `${origin}/`).toString();
    return clean;
  } catch {
    return "";
  }
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

const ensureLinkWithSizes = (rel: string, sizes: string) => {
  const selector = `link[rel="${rel}"][sizes="${sizes}"]`;
  const found = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (found) return found;

  const link = document.createElement("link");
  link.rel = rel;
  link.sizes = sizes;
  document.head.appendChild(link);
  return link;
};

const ensureStartupLink = (media: string) => {
  const selector = `link[rel="apple-touch-startup-image"][media="${media}"]`;
  const found = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (found) return found;

  const link = document.createElement("link");
  link.rel = "apple-touch-startup-image";
  link.media = media;
  document.head.appendChild(link);
  return link;
};

const splashMediaByKey: Record<string, string> = {
  splash_640x1136: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  splash_750x1334: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  splash_828x1792: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  splash_1125x2436: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  splash_1170x2532: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  splash_1242x2208: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  splash_1242x2688: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  splash_1284x2778: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  splash_1536x2048: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  splash_1668x2224: "(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  splash_1668x2388: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  splash_2048x2732: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
};

const PwaMetaManager = () => {
  const { data: config } = useSiteConfig();

  const manifestPayload = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const appRoot = origin ? `${origin}/` : "/";
    const name = config?.pwa_app_name || "HomeCare Match";
    const shortName = config?.pwa_short_name || "HomeCare";
    const description =
      config?.pwa_description || "Conectando profissionais de saúde às melhores oportunidades em Home Care.";
    const themeColor = config?.pwa_theme_color || "#0f172a";
    const backgroundColor = config?.pwa_background_color || "#ffffff";

    const icon192 =
      toAbsoluteUrl(config?.pwa_icon_192_url || config?.favicon_url || FALLBACK_ICON_192, origin) ||
      (origin ? `${origin}${FALLBACK_ICON_192}` : FALLBACK_ICON_192);
    const icon512 =
      toAbsoluteUrl(config?.pwa_icon_512_url || config?.favicon_url || FALLBACK_ICON_512, origin) ||
      (origin ? `${origin}${FALLBACK_ICON_512}` : FALLBACK_ICON_512);
    const maskable = toAbsoluteUrl(config?.pwa_maskable_icon_url || icon512, origin) || icon512;
    const rawAssets =
      config?.pwa_assets_json && typeof config.pwa_assets_json === "object" && !Array.isArray(config.pwa_assets_json)
        ? config.pwa_assets_json
        : {};
    const assets = Object.entries(rawAssets).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value !== "string") return acc;
      const absolute = toAbsoluteUrl(value, origin);
      if (absolute) acc[key] = absolute;
      return acc;
    }, {});
    const screenshots = toScreenshots(config?.pwa_screenshots_json)
      .map((screenshot) => ({
        ...screenshot,
        src: toAbsoluteUrl(screenshot.src, origin),
      }))
      .filter((screenshot) => screenshot.src);

    return {
      id: appRoot,
      name,
      short_name: shortName,
      description,
      start_url: appRoot,
      scope: appRoot,
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
      assets,
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
    config?.pwa_assets_json,
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

    const mobileCapableMeta = ensureMeta("mobile-web-app-capable");
    mobileCapableMeta.content = "yes";

    const appleStatusBarMeta = ensureMeta("apple-mobile-web-app-status-bar-style");
    appleStatusBarMeta.content = "default";

    const assetMap = manifestPayload.assets as Record<string, string>;

    const apple180 = assetMap.apple_touch_icon_180x180 || manifestPayload.icons[0]?.src || FALLBACK_ICON_192;
    const apple167 = assetMap.apple_touch_icon_167x167;
    const apple152 = assetMap.apple_touch_icon_152x152;
    const favicon16 = assetMap.favicon_16x16;
    const favicon32 = assetMap.favicon_32x32;
    const faviconIco = assetMap.favicon_ico;
    const msTile = assetMap.mstile_144x144;

    const appleTouchDefault = ensureLink("apple-touch-icon");
    appleTouchDefault.href = apple180;

    const appleTouch180 = ensureLinkWithSizes("apple-touch-icon", "180x180");
    appleTouch180.href = apple180;
    if (apple167) {
      const appleTouch167 = ensureLinkWithSizes("apple-touch-icon", "167x167");
      appleTouch167.href = apple167;
    }
    if (apple152) {
      const appleTouch152 = ensureLinkWithSizes("apple-touch-icon", "152x152");
      appleTouch152.href = apple152;
    }

    if (favicon32) {
      const icon32 = ensureLinkWithSizes("icon", "32x32");
      icon32.href = favicon32;
      icon32.type = "image/png";
    }
    if (favicon16) {
      const icon16 = ensureLinkWithSizes("icon", "16x16");
      icon16.href = favicon16;
      icon16.type = "image/png";
    }
    if (faviconIco) {
      const shortcutIcon = ensureLink("shortcut icon");
      shortcutIcon.href = faviconIco;
      shortcutIcon.type = "image/x-icon";
    }

    if (msTile) {
      const tileImageMeta = ensureMeta("msapplication-TileImage");
      tileImageMeta.content = msTile;
    }
    const tileColorMeta = ensureMeta("msapplication-TileColor");
    tileColorMeta.content = manifestPayload.theme_color;

    Object.entries(splashMediaByKey).forEach(([key, media]) => {
      const url = assetMap[key];
      if (!url) return;
      const splashLink = ensureStartupLink(media);
      splashLink.href = url;
    });

    return () => {
      URL.revokeObjectURL(manifestUrl);
    };
  }, [manifestPayload]);

  return null;
};

export default PwaMetaManager;