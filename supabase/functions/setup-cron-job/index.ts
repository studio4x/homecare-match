import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let client: Client | null = null;
  try {
    console.log("[setup-cron-job] Iniciando ativação de automação...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Ativar extensões necessárias
      CREATE EXTENSION IF NOT EXISTS pg_net;
      CREATE EXTENSION IF NOT EXISTS pg_cron;

      -- 2. Limpar agendamento anterior se existir (evita duplicatas)
      SELECT cron.unschedule('processar-notificacoes-push') 
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-notificacoes-push');

      -- 3. Agendar o novo job
      -- Ele vai chamar a função process-push-notifications a cada 1 minuto
      SELECT cron.schedule(
        'processar-notificacoes-push',
        '* * * * *',
        $$
        SELECT net.http_post(
          url := 'https://rkjvtnadqkbwomgzyswr.supabase.co/functions/v1/process-push-notifications',
          headers := '{"Content-Type": "application/json", "Authorization": "Bearer ${SERVICE_ROLE_KEY}"}'::jsonb,
          body := '{"action": "process_scheduled"}'::jsonb
        );
        $$
      );
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Automação (Cron Job) ativada com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    console.error("[setup-cron-job] Erro:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});