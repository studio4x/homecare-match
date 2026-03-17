type SupabaseImageOptions = {
  width?: number;
  quality?: number;
  format?: "origin" | "webp";
};

const OBJECT_PUBLIC_MARKER = "/storage/v1/object/public/";
const RENDER_PUBLIC_MARKER = "/storage/v1/render/image/public/";

export const optimizeSupabasePublicImageUrl = (
  rawUrl: string | null | undefined,
  options: SupabaseImageOptions = {},
) => {
  const url = String(rawUrl || "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const markerIndex = parsed.pathname.indexOf(OBJECT_PUBLIC_MARKER);

    if (markerIndex === -1) {
      return url;
    }

    const objectPath = parsed.pathname.slice(markerIndex + OBJECT_PUBLIC_MARKER.length);
    if (!objectPath) return url;

    parsed.pathname = `${RENDER_PUBLIC_MARKER}${objectPath}`;

    if (typeof options.width === "number" && options.width > 0) {
      parsed.searchParams.set("width", String(Math.round(options.width)));
    }

    if (typeof options.quality === "number" && options.quality > 0) {
      parsed.searchParams.set("quality", String(Math.round(options.quality)));
    }

    if (options.format && options.format !== "origin") {
      parsed.searchParams.set("format", options.format);
    }

    return parsed.toString();
  } catch {
    return url;
  }
};
