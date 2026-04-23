// @ts-nocheck
const encoder = new TextEncoder();

export type LmsReleaseSource = "purchase" | "free_enrollment" | "integration";
export type LmsAccessStatus = "active" | "revoked" | "expired" | "pending";
export type LmsRevokeReason = "plan_inactive" | "refunded" | "cancelled" | "admin_revoked" | "revoked_by_hcm";

export const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJson(entryValue)}`)
    .join(",")}}`;
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const hmacSha256Hex = async (message: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(signature);
};

const base64Url = (input: string | Uint8Array) => {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const createHs256Jwt = async (claims: Record<string, unknown>, secret: string) => {
  const header = { alg: "HS256", typ: "JWT" };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned)));
  return `${unsigned}.${base64Url(signature)}`;
};

export const buildSignedLmsRequest = async (
  body: Record<string, unknown>,
  secret: string,
  timestamp = new Date().toISOString(),
) => {
  const stableBody = stableJson(body);
  const signature = await hmacSha256Hex(`${timestamp}.${stableBody}`, secret);
  return { stableBody, timestamp, signature };
};

export const sanitizePayload = (payload: unknown): unknown => {
  if (payload === null || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) return payload.map(sanitizePayload);

  const sensitiveKeys = new Set(["token", "signature", "secret", "password", "authorization"]);
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).map(([key, value]) => [
      key,
      sensitiveKeys.has(key.toLowerCase()) ? "[redacted]" : sanitizePayload(value),
    ]),
  );
};

export const getEnv = (name: string, fallback?: string) => {
  const value = Deno.env.get(name);
  if (value && value.trim()) return value.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
};

export const getOutboundSigningSecret = () =>
  Deno.env.get("HCM_OUTBOUND_SIGNING_SECRET") ||
  Deno.env.get("hcm_outbound_signing_secret") ||
  "";

export const logLmsIntegration = async (supabaseAdmin: any, row: Record<string, unknown>) => {
  try {
    await supabaseAdmin.from("lms_integration_logs").upsert(
      {
        ...row,
        payload: sanitizePayload(row.payload || {}),
        response_payload: sanitizePayload(row.response_payload || null),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "request_id,direction" },
    );
  } catch (error) {
    console.warn("[lms-integration] Falha ao registrar log:", error?.message || error);
  }
};

const postSignedLmsJson = async (
  supabaseAdmin: any,
  url: string,
  body: Record<string, unknown>,
  eventType: string,
) => {
  const requestId = String(body.request_id || crypto.randomUUID());
  const secret = getEnv("HCM_INBOUND_HMAC_SECRET");
  const { stableBody, timestamp, signature } = await buildSignedLmsRequest(body, secret);

  let httpStatus: number | null = null;
  let responsePayload: unknown = null;
  let status = "processed";
  let errorMessage: string | null = null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HCM-Timestamp": timestamp,
        "X-HCM-Signature": signature,
        "X-Request-Id": requestId,
      },
      body: stableBody,
    });

    httpStatus = response.status;
    responsePayload = await response.json().catch(() => null);

    if (!response.ok) {
      status = "failed";
      errorMessage =
        typeof responsePayload?.error === "string"
          ? responsePayload.error
          : `LMS respondeu com HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return responsePayload;
  } catch (error) {
    status = "failed";
    errorMessage = error?.message || "Falha ao chamar LMS";
    throw error;
  } finally {
    await logLmsIntegration(supabaseAdmin, {
      request_id: requestId,
      direction: "outbound",
      event_type: eventType,
      external_user_id: body?.user?.external_user_id || null,
      external_course_id: body?.course?.external_course_id || null,
      http_status: httpStatus,
      status,
      payload: body,
      response_payload: responsePayload,
      error_message: errorMessage,
    });
  }
};

export const syncLmsRelease = async (
  supabaseAdmin: any,
  payload: {
    request_id: string;
    source_system: "homecare_match";
    release_source: LmsReleaseSource;
    external_reference_id: string;
    user: { external_user_id: string; email: string; full_name: string };
    course: { external_course_id: string };
    access: {
      status: LmsAccessStatus;
      starts_at: string | null;
      ends_at: string | null;
      revoked_reason: string | null;
    };
  },
) => postSignedLmsJson(supabaseAdmin, getEnv("LMS_HCM_RELEASE_UPSERT_URL"), payload, "release.upsert");

export const revokeLmsRelease = async (
  supabaseAdmin: any,
  payload: {
    request_id: string;
    source_system: "homecare_match";
    external_reference_id: string;
    user: { external_user_id: string };
    course: { external_course_id: string };
    reason: LmsRevokeReason;
  },
) => postSignedLmsJson(supabaseAdmin, getEnv("LMS_HCM_RELEASE_REVOKE_URL"), payload, "release.revoke");

export const requireMappedExternalCourseId = (course: any) => {
  const externalCourseId = String(course?.external_course_id || "").trim();
  if (!externalCourseId) {
    throw new Error("Curso sem external_course_id. Configure o ID do Curso na HomeCare Match antes de integrar com o LMS.");
  }
  return externalCourseId;
};
