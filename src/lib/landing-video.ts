import { supabase } from "@/integrations/supabase/client";

const VIDEO_BUCKET = "uploads";

export const resolveLandingVideoUrl = (
  storagePath: string | null | undefined,
  fallbackUrl: string | null | undefined,
) => {
  const safeFallback = String(fallbackUrl || "").trim();
  const rawPath = String(storagePath || "").trim();

  if (!rawPath) return safeFallback;
  if (/^https?:\/\//i.test(rawPath)) return rawPath;

  const normalizedPath = rawPath
    .replace(/^\/+/, "")
    .replace(/^uploads\//i, "");

  if (!normalizedPath) return safeFallback;

  const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(normalizedPath);
  return String(data?.publicUrl || "").trim() || safeFallback;
};

