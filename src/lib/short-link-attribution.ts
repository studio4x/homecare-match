import { supabase } from "@/integrations/supabase/client";

const ATTRIBUTION_STORAGE_KEY = "hcm_short_link_attribution";
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type StoredAttribution = {
  slug: string;
  captured_at: string;
  target_url?: string | null;
};

const normalizeSlug = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

export const persistShortLinkAttribution = (slug: string, targetUrl?: string | null) => {
  if (!canUseStorage()) return;
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return;

  const payload: StoredAttribution = {
    slug: normalizedSlug,
    captured_at: new Date().toISOString(),
    target_url: targetUrl || null,
  };

  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(payload));
  } catch (_err) {
    // ignore storage issues
  }
};

export const readShortLinkAttribution = (): StoredAttribution | null => {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttribution;
    const normalizedSlug = normalizeSlug(parsed?.slug || "");
    if (!normalizedSlug) return null;

    const capturedAtTs = new Date(String(parsed?.captured_at || "")).getTime();
    if (!Number.isFinite(capturedAtTs)) return null;
    if (Date.now() - capturedAtTs > ATTRIBUTION_TTL_MS) {
      window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      return null;
    }

    return {
      slug: normalizedSlug,
      captured_at: new Date(capturedAtTs).toISOString(),
      target_url: parsed?.target_url || null,
    };
  } catch (_err) {
    return null;
  }
};

export const clearShortLinkAttribution = () => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
  } catch (_err) {
    // ignore storage issues
  }
};

export const trackShortLinkSignupConversion = async (userId?: string | null) => {
  const attribution = readShortLinkAttribution();
  if (!attribution?.slug) return false;

  try {
    const { data, error } = await supabase.rpc("track_marketing_short_link_signup", {
      p_slug: attribution.slug,
      p_user_id: userId || null,
    });

    if (error) {
      console.warn("[short-link-attribution] signup tracking error:", error);
      return false;
    }

    if (data === true) {
      clearShortLinkAttribution();
      return true;
    }

    return false;
  } catch (error) {
    console.warn("[short-link-attribution] signup tracking exception:", error);
    return false;
  }
};
