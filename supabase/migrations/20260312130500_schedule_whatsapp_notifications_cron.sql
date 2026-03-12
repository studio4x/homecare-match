CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-notificacoes-whatsapp') THEN
    PERFORM cron.unschedule('processar-notificacoes-whatsapp');
  END IF;
END
$$;

SELECT cron.schedule(
  'processar-notificacoes-whatsapp',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT current_setting('app.settings.supabase_url', true)) || '/functions/v1/process-whatsapp-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT current_setting('app.settings.service_role_key', true))
    ),
    body := '{}'::jsonb
  );
  $$
);
