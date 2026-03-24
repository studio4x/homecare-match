-- Schedule Onboarding Emails Processing Cron (Runs every 15 minutes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    CREATE EXTENSION pg_net;
  END IF;

  -- Remove existing job if it exists to avoid duplicates
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processar-emails-onboarding') THEN
    PERFORM cron.unschedule('processar-emails-onboarding');
  END IF;
END
$$;

SELECT cron.schedule(
  'processar-emails-onboarding',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT current_setting('app.settings.supabase_url', true)) || '/functions/v1/process-onboarding-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT current_setting('app.settings.service_role_key', true))
    ),
    body := '{}'::jsonb
  );
  $$
);
