const MOJIBAKE_MARKERS = /[\u00C2\u00C3\uFFFD]/;

export const fixMojibake = (value: unknown): string => {
  if (typeof value !== "string") return String(value ?? "");
  if (!MOJIBAKE_MARKERS.test(value)) return value;

  try {
    const bytes = Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return decoded || value;
  } catch {
    return value;
  }
};

export const fixNullableMojibake = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  return fixMojibake(value);
};

