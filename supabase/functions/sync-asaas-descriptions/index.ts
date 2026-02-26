// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const asaasEnvFromConfig = (config: any) => {
  if (config?.asaas_environment === "production") return "production";
  return "sandbox";
};

const asaasEnvFromBody = (body: any): "sandbox" | "production" | null => {
  const env = String(body?.env || "").toLowerCase();
  if (env === "sandbox" || env === "production") return env;
  return null;
};

const getAsaasApiBaseUrl = (env: "sandbox" | "production") => {
  return env === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
};

const getAsaasApiKey = (env: "sandbox" | "production") => {
  if (env === "production") {
    return (
      Deno.env.get("ASAAS_API_KEY_PRODUCTION") ||
      Deno.env.get("ASAAS_API_KEY_LIVE") ||
      Deno.env.get("ASAAS_API_KEY")
    );
  }

  return (
    Deno.env.get("ASAAS_API_KEY_SANDBOX") ||
    Deno.env.get("ASAAS_API_KEY_TEST") ||
    Deno.env.get("ASAAS_API_KEY")
  );
};

const truncateText = (value: unknown, maxLength: number, fallback: string) => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
};

const parseAsaasErrorMessage = (payload: any, fallback: string) => {
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const first = payload.errors[0];
    if (typeof first?.description === "string" && first.description.trim()) return first.description;
  }
  return fallback;
};

const isAsaasGenericDescription = (value?: string | null) => {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return true;

  return (
    text.includes("sem descricao informada") ||
    text.includes("sem descri") ||
    text.includes("description not informed") ||
    text.includes("description not provided") ||
    text === "-"
  );
};

const resolveDescription = async (supabaseAdmin: any, courseSlug?: string | null, planId?: string | null) => {
  if (courseSlug) {
    const { data: course } = await supabaseAdmin
      .from("academy_courses")
      .select("title")
      .eq("slug", courseSlug)
      .maybeSingle();
    return truncateText(`Curso: ${course?.title || courseSlug}`, 120, `Curso: ${courseSlug}`);
  }

  if (planId) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("name")
      .eq("id", planId)
      .maybeSingle();
    return truncateText(`Plano: ${plan?.name || planId}`, 120, `Plano: ${planId}`);
  }

  return "Pagamento HomeCare Match";
};

const buildEnvCandidates = (requested: "sandbox" | "production" | null, configEnv: "sandbox" | "production") => {
  const candidates: ("sandbox" | "production")[] = [];
  if (requested) candidates.push(requested);
  if (!candidates.includes(configEnv)) candidates.push(configEnv);
  if (!candidates.includes("production")) candidates.push("production");
  if (!candidates.includes("sandbox")) candidates.push("sandbox");
  return candidates;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo nao permitido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Autenticacao ausente.");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) throw new Error("Usuario nao autenticado.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Permissao negada." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body?.limit || 50), 200));
    const days = Math.max(1, Math.min(Number(body?.days || 60), 365));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: config } = await supabaseAdmin
      .from("site_config")
      .select("asaas_environment")
      .eq("id", 1)
      .maybeSingle();

    const configEnv = asaasEnvFromConfig(config) as "sandbox" | "production";
    const requestedEnv = asaasEnvFromBody(body);
    const envCandidates = buildEnvCandidates(requestedEnv, configEnv);

    const { data: payments } = await supabaseAdmin
      .from("payment_transactions")
      .select("payment_id, plan_id, course_slug, description, created_at")
      .eq("provider", "asaas")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    const summary = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ payment_id: string; message: string }>,
    };

    for (const payment of payments || []) {
      const paymentId = payment?.payment_id;
      if (!paymentId) {
        summary.skipped += 1;
        continue;
      }

      summary.processed += 1;
      const desiredDescription = await resolveDescription(supabaseAdmin, payment.course_slug, payment.plan_id);

      let updated = false;
      let skipped = false;
      let lastError: { message: string; env?: string; status?: number } | null = null;

      for (const envCandidate of envCandidates) {
        const asaasApiKey = getAsaasApiKey(envCandidate);
        if (!asaasApiKey) {
          lastError = {
            message: "Chave Asaas nao encontrada para este ambiente.",
            env: envCandidate,
          };
          continue;
        }

        try {
          const getRes = await fetch(
            `${getAsaasApiBaseUrl(envCandidate)}/payments/${encodeURIComponent(String(paymentId))}`,
            {
              headers: {
                access_token: asaasApiKey,
                Authorization: `Bearer ${asaasApiKey}`,
              },
            },
          );

          const currentJson = await getRes.json().catch(() => ({}));
          if (!getRes.ok) {
            const message = parseAsaasErrorMessage(currentJson, "Falha ao consultar pagamento no Asaas.");
            lastError = { message, env: envCandidate, status: getRes.status };
            const shouldTryNext = [401, 403, 404].includes(getRes.status);
            if (shouldTryNext) continue;
            break;
          }

          const currentDescription = String(currentJson?.description || "").trim();
          if (!isAsaasGenericDescription(currentDescription) && currentDescription === desiredDescription) {
            skipped = true;
            break;
          }

          const updateRes = await fetch(
            `${getAsaasApiBaseUrl(envCandidate)}/payments/${encodeURIComponent(String(paymentId))}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                access_token: asaasApiKey,
                Authorization: `Bearer ${asaasApiKey}`,
              },
              body: JSON.stringify({ description: desiredDescription }),
            },
          );

          const updateJson = await updateRes.json().catch(() => ({}));
          if (!updateRes.ok) {
            const message = parseAsaasErrorMessage(updateJson, "Falha ao atualizar descricao no Asaas.");
            lastError = { message, env: envCandidate, status: updateRes.status };
            const shouldTryNext = [401, 403, 404].includes(updateRes.status);
            if (shouldTryNext) continue;
            break;
          }

          updated = true;
          break;
        } catch (error) {
          lastError = {
            message: error instanceof Error ? error.message : String(error),
            env: envCandidate,
          };
        }
      }

      if (updated) {
        summary.updated += 1;
        continue;
      }

      if (skipped) {
        summary.skipped += 1;
        continue;
      }

      summary.errors.push({
        payment_id: String(paymentId),
        message: lastError?.message || "Falha ao atualizar descricao no Asaas.",
        env: lastError?.env,
        status: lastError?.status,
      });
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
