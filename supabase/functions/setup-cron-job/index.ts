import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SCHEDULED_JOB_SECRET = Deno.env.get("SCHEDULED_JOB_SECRET") || "";
const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let client: Client | null = null;
  try {
    if (!SUPABASE_DB_URL) throw new Error("SUPABASE_DB_URL ausente.");
    if (!SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
    if (!SCHEDULED_JOB_SECRET) throw new Error("SCHEDULED_JOB_SECRET ausente.");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL ausente.");

    const authHeader = req.headers.get("authorization");
    const jwtToken = authHeader?.replace("Bearer ", "").trim() || "";
    if (!jwtToken) {
      return new Response(JSON.stringify({ error: "Autenticacao ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(jwtToken);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuario nao autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = !!profile?.is_admin || profile?.role === "admin";
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: onboardingCronSetting } = await supabaseAdmin
      .from("onboarding_system_settings")
      .select("setting_value")
      .eq("setting_key", "cron_secret")
      .maybeSingle();

    const onboardingCronSecret = String((onboardingCronSetting?.setting_value as any)?.secret || "").trim();
    if (!onboardingCronSecret) {
      throw new Error("onboarding_system_settings.cron_secret ausente.");
    }

    const escapedServiceRole = SERVICE_ROLE_KEY.replace(/'/g, "''");
    const escapedScheduledJobSecret = SCHEDULED_JOB_SECRET.replace(/'/g, "''");
    const escapedSupabaseUrl = SUPABASE_URL.replace(/'/g, "''");
    const escapedOnboardingCronSecret = onboardingCronSecret.replace(/'/g, "''");

    console.log("[setup-cron-job] Iniciando ativacao de automacao...");

    client = new Client(SUPABASE_DB_URL);
    await client.connect();

    const sql = `
      CREATE EXTENSION IF NOT EXISTS pg_net;
      CREATE EXTENSION IF NOT EXISTS pg_cron;

      SELECT cron.unschedule('processar-notificacoes-push')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-notificacoes-push');

      SELECT cron.unschedule('processar-estornos-pendentes')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-estornos-pendentes');

      SELECT cron.unschedule('processar-alertas-assinatura')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-alertas-assinatura');

      SELECT cron.unschedule('processar-notificacoes-whatsapp')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-notificacoes-whatsapp');

      SELECT cron.unschedule('reconciliar-afiliados')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconciliar-afiliados');

      SELECT cron.unschedule('monitorar-automacao-assinaturas')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitorar-automacao-assinaturas');

      SELECT cron.schedule(
        'processar-notificacoes-push',
        '* * * * *',
        $$
        SELECT net.http_post(
          url := '${escapedSupabaseUrl}/functions/v1/process-push-notifications',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${escapedServiceRole}"}'::jsonb,
          body := '{"action": "process_scheduled"}'::jsonb
        );
        $$
      );

      SELECT cron.schedule(
        'processar-estornos-pendentes',
        '*/15 * * * *',
        $$
        SELECT net.http_post(
          url := '${escapedSupabaseUrl}/functions/v1/process-pending-refunds',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${escapedServiceRole}"}'::jsonb,
          body := '{}'::jsonb
        );
        $$
      );

      SELECT cron.schedule(
        'processar-alertas-assinatura',
        '0 */6 * * *',
        $$
        SELECT net.http_post(
          url := '${escapedSupabaseUrl}/functions/v1/process-subscription-expiry-alerts',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${escapedScheduledJobSecret}"}'::jsonb,
          body := '{}'::jsonb,
          timeout_milliseconds := 30000
        );
        $$
      );

      SELECT cron.schedule(
        'monitorar-automacao-assinaturas',
        '20 * * * *',
        $$
        SELECT net.http_post(
          url := '${escapedSupabaseUrl}/functions/v1/process-subscription-expiry-alerts',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${escapedScheduledJobSecret}"}'::jsonb,
          body := '{"action": "health_check"}'::jsonb,
          timeout_milliseconds := 30000
        );
        $$
      );

      SELECT cron.schedule(
        'processar-notificacoes-whatsapp',
        '* * * * *',
        $$
        SELECT net.http_post(
          url := '${escapedSupabaseUrl}/functions/v1/process-whatsapp-notifications',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${escapedServiceRole}"}'::jsonb,
          body := '{}'::jsonb
        );
        $$
      );

      SELECT cron.unschedule('processar-onboarding-emails')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-onboarding-emails');

      SELECT cron.schedule(
        'processar-onboarding-emails',
        '*/15 * * * *',
        $$
        SELECT net.http_post(
          url := '${escapedSupabaseUrl}/functions/v1/process-onboarding-emails-scheduled',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := '{}'::jsonb
        );
        $$
      );

      SELECT cron.schedule(
        'reconciliar-afiliados',
        '15 2 * * *',
        $$
        SELECT net.http_post(
          url := '${escapedSupabaseUrl}/functions/v1/affiliate-reconcile-events',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${escapedServiceRole}"}'::jsonb,
          body := '{"limit": 2000}'::jsonb
        );
        $$
      );
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Automacao ativada com sucesso (push + estornos + alertas de assinatura + whatsapp + reconciliacao de afiliados).",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (client) {
      try {
        await client.end();
      } catch {
        // ignore close errors
      }
    }

    console.error("[setup-cron-job] Erro:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
