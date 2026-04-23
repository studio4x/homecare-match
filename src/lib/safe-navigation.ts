const URL_SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:/i;

const DEFAULT_CHECKOUT_HOSTS = [
  "asaas.com",
  "sandbox.asaas.com",
  "www.asaas.com",
  "api.asaas.com",
  "api-sandbox.asaas.com",
];

const DEFAULT_LMS_HOSTS = [
  "cursos.homecarematch.com.br",
];

type NavigateSafelyOptions = {
  allowExternal?: boolean;
  allowedHosts?: string[];
};

const hasControlChars = (value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
};

const normalizeHost = (host: string) =>
  String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^\.+/, "")
    .replace(/\.+$/, "");

const isHostAllowed = (hostname: string, allowedHosts: string[]) => {
  const normalizedHostname = normalizeHost(hostname);
  if (!normalizedHostname) return false;

  return allowedHosts.some((host) => {
    const normalizedAllowed = normalizeHost(host);
    if (!normalizedAllowed) return false;
    return (
      normalizedHostname === normalizedAllowed ||
      normalizedHostname.endsWith(`.${normalizedAllowed}`)
    );
  });
};

const getHostFromUrl = (urlValue: string | null | undefined) => {
  const raw = String(urlValue || "").trim();
  if (!raw) return null;

  try {
    return new URL(raw).hostname || null;
  } catch {
    return null;
  }
};

const getEnvList = (envValue: string | null | undefined) =>
  String(envValue || "")
    .split(",")
    .map((entry) => normalizeHost(entry))
    .filter(Boolean);

export const getCheckoutAllowedHosts = () => {
  const envHosts = getEnvList(import.meta.env.VITE_CHECKOUT_ALLOWED_HOSTS);
  return Array.from(new Set([...DEFAULT_CHECKOUT_HOSTS, ...envHosts]));
};

export const getLmsAllowedHosts = () => {
  const envHosts = getEnvList(import.meta.env.VITE_LMS_ALLOWED_HOSTS);
  return Array.from(new Set([...DEFAULT_LMS_HOSTS, ...envHosts]));
};

export const getSupabaseAllowedHosts = () => {
  const supabaseHost = getHostFromUrl(import.meta.env.VITE_SUPABASE_URL);
  const envHosts = getEnvList(import.meta.env.VITE_SUPABASE_ALLOWED_HOSTS);
  return Array.from(new Set([supabaseHost, ...envHosts].filter(Boolean) as string[]));
};

export const resolveSafeNavigationTarget = (
  target: string | null | undefined,
  options?: NavigateSafelyOptions,
) => {
  if (typeof window === "undefined") return null;

  const rawTarget = String(target || "").trim();
  if (!rawTarget || hasControlChars(rawTarget)) return null;

  if (URL_SCHEME_REGEX.test(rawTarget) && !/^https?:/i.test(rawTarget)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawTarget, window.location.origin);
  } catch {
    return null;
  }

  if (!/^https?:$/.test(parsed.protocol)) return null;
  if (parsed.origin === window.location.origin) return parsed.toString();

  if (!options?.allowExternal) return null;

  const allowedHosts = (options?.allowedHosts || []).map(normalizeHost).filter(Boolean);
  if (allowedHosts.length === 0) return null;

  return isHostAllowed(parsed.hostname, allowedHosts) ? parsed.toString() : null;
};

export const navigateSafely = (
  target: string | null | undefined,
  options?: NavigateSafelyOptions,
) => {
  const safeTarget = resolveSafeNavigationTarget(target, options);
  if (!safeTarget) return false;
  window.location.assign(safeTarget);
  return true;
};
