import { supabase } from "@/integrations/supabase/client";
import { getYouTubeThumbnailUrl } from "@/lib/video-utils";

const VIDEO_BUCKET = "uploads";
const POSTER_SUFFIX = "_poster.jpg";

export const normalizeLandingVideoStoragePath = (storagePath: string | null | undefined) =>
  String(storagePath || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^uploads\//i, "");

export const buildLandingVideoPosterPath = (storagePath: string | null | undefined) => {
  const normalizedPath = normalizeLandingVideoStoragePath(storagePath);
  if (!normalizedPath) return "";
  const dotIndex = normalizedPath.lastIndexOf(".");
  const basePath = dotIndex > 0 ? normalizedPath.slice(0, dotIndex) : normalizedPath;
  return `${basePath}${POSTER_SUFFIX}`;
};

export const getLandingVideoPublicUrl = (path: string | null | undefined) => {
  const normalizedPath = normalizeLandingVideoStoragePath(path);
  if (!normalizedPath) return "";
  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(normalizedPath);
  return String(data?.publicUrl || "").trim();
};

export const resolveLandingVideoAssets = (
  storagePath: string | null | undefined,
  fallbackUrl: string | null | undefined,
) => {
  const safeFallback = String(fallbackUrl || "").trim();
  const rawPath = String(storagePath || "").trim();

  if (!rawPath) {
    return {
      videoUrl: safeFallback,
      posterUrl: getYouTubeThumbnailUrl(safeFallback),
      storagePath: "",
      posterPath: "",
    };
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return {
      videoUrl: rawPath,
      posterUrl: getYouTubeThumbnailUrl(rawPath),
      storagePath: "",
      posterPath: "",
    };
  }

  const normalizedPath = normalizeLandingVideoStoragePath(rawPath);
  const posterPath = buildLandingVideoPosterPath(normalizedPath);

  return {
    videoUrl: getLandingVideoPublicUrl(normalizedPath) || safeFallback,
    posterUrl: getLandingVideoPublicUrl(posterPath),
    storagePath: normalizedPath,
    posterPath,
  };
};

export const resolveLandingVideoUrl = (
  storagePath: string | null | undefined,
  fallbackUrl: string | null | undefined,
) => {
  return resolveLandingVideoAssets(storagePath, fallbackUrl).videoUrl;
};
