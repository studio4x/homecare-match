const PROTOCOL_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;

const toSafePathError = () => new Error("Caminho de arquivo inválido.");

const normalizeSeparators = (value: string) => value.replace(/\\/g, "/");

const stripBucketPrefix = (value: string, bucket?: string) => {
  if (!bucket) return value;
  const normalizedBucket = String(bucket || "").trim().replace(/^\/+|\/+$/g, "");
  if (!normalizedBucket) return value;
  const regex = new RegExp(`^${normalizedBucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\/`, "i");
  return value.replace(regex, "");
};

export const sanitizeStoragePath = (
  input: string | null | undefined,
  options?: { bucket?: string; allowEmpty?: boolean },
) => {
  const allowEmpty = options?.allowEmpty === true;
  const raw = String(input || "").trim();
  if (!raw) {
    if (allowEmpty) return "";
    throw toSafePathError();
  }

  if (PROTOCOL_REGEX.test(raw) || raw.includes("\0") || raw.includes("\r") || raw.includes("\n")) {
    throw toSafePathError();
  }

  let normalized = normalizeSeparators(raw).replace(/^\/+/, "");
  normalized = stripBucketPrefix(normalized, options?.bucket);
  normalized = normalized.replace(/^\/+/, "");

  if (!normalized) {
    if (allowEmpty) return "";
    throw toSafePathError();
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) throw toSafePathError();
  if (segments.some((segment) => segment === "." || segment === "..")) throw toSafePathError();

  return segments.join("/");
};

export const sanitizeStorageFileName = (input: string | null | undefined, fallback = "arquivo") => {
  const raw = String(input || "").trim();
  const base = normalizeSeparators(raw).split("/").filter(Boolean).pop() || "";
  const cleaned = base
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!cleaned || cleaned === "." || cleaned === "..") {
    return fallback;
  }

  return cleaned.slice(0, 160);
};

