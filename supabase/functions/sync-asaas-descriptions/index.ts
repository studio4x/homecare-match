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

    const asaasEnv = asaasEnvFromConfig(config) as "sandbox" | "production";
    const asaasApiKey = getAsaasApiKey(asaasEnv);
    if (!asaasApiKey) {
      throw new Error("Chave Asaas nao encontrada para o ambiente configurado.");
    }

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

      try {
        const getRes = await fetch(
          `${getAsaasApiBaseUrl(asaasEnv)}/payments/${encodeURIComponent(String(paymentId))}`,
          {
            headers: {
              access_token: asaasApiKey,
              Authorization: `Bearer ${asaasApiKey}`,
            },
          },
        );

        const currentJson = await getRes.json().catch(() => ({}));
        const currentDescription = String(currentJson?.description || "").trim();

        if (!isAsaasGenericDescription(currentDescription) && currentDescription === desiredDescription) {
          summary.skipped += 1;
          continue;
        }

        const updateRes = await fetch(
          `${getAsaasApiBaseUrl(asaasEnv)}/payments/${encodeURIComponent(String(paymentId))}`,
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

        if (!updateRes.ok) {
          const updateJson = await updateRes.json().catch(() => ({}));
          summary.errors.push({
            payment_id: String(paymentId),
            message: updateJson?.message || "Falha ao atualizar descricao no Asaas.",
          });
          continue;
        }

        summary.updated += 1;
      } catch (error) {
        summary.errors.push({
          payment_id: String(paymentId),
          message: error instanceof Error ? error.message : String(error),
        });
      }
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
