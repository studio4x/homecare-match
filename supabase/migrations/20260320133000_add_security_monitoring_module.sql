CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.security_monitor_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  cadence_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (cadence_minutes BETWEEN 15 AND 10080),
  failed_notifications_threshold INTEGER NOT NULL DEFAULT 20 CHECK (failed_notifications_threshold >= 0),
  high_risk_admin_actions_threshold INTEGER NOT NULL DEFAULT 15 CHECK (high_risk_admin_actions_threshold >= 0),
  max_admin_accounts INTEGER NOT NULL DEFAULT 5 CHECK (max_admin_accounts >= 1),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_monitor_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_source TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('manual', 'cron', 'system')),
  overall_status TEXT NOT NULL DEFAULT 'ok' CHECK (overall_status IN ('ok', 'warning', 'critical', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_monitor_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.security_monitor_runs(id) ON DELETE CASCADE,
  check_key TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL CHECK (status IN ('pass', 'warn', 'fail')),
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT security_monitor_findings_run_key_unique UNIQUE (run_id, check_key)
);

CREATE INDEX IF NOT EXISTS idx_security_monitor_runs_created_at
  ON public.security_monitor_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_monitor_findings_run_id
  ON public.security_monitor_findings (run_id);

ALTER TABLE public.security_monitor_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_monitor_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_monitor_findings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'security_monitor_config'
      AND policyname = 'security_monitor_config_admin_read'
  ) THEN
    CREATE POLICY "security_monitor_config_admin_read"
    ON public.security_monitor_config
    FOR SELECT
    TO authenticated
    USING (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'security_monitor_config'
      AND policyname = 'security_monitor_config_admin_update'
  ) THEN
    CREATE POLICY "security_monitor_config_admin_update"
    ON public.security_monitor_config
    FOR UPDATE
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'security_monitor_runs'
      AND policyname = 'security_monitor_runs_admin_read'
  ) THEN
    CREATE POLICY "security_monitor_runs_admin_read"
    ON public.security_monitor_runs
    FOR SELECT
    TO authenticated
    USING (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'security_monitor_findings'
      AND policyname = 'security_monitor_findings_admin_read'
  ) THEN
    CREATE POLICY "security_monitor_findings_admin_read"
    ON public.security_monitor_findings
    FOR SELECT
    TO authenticated
    USING (check_is_admin());
  END IF;
END
$$;

INSERT INTO public.security_monitor_config (
  id,
  enabled,
  cadence_minutes,
  failed_notifications_threshold,
  high_risk_admin_actions_threshold,
  max_admin_accounts,
  next_run_at
)
VALUES (1, true, 1440, 20, 15, 5, now() + INTERVAL '24 hours')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.run_security_monitor(p_trigger text DEFAULT 'manual')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_run_id uuid;
  v_trigger text := lower(COALESCE(p_trigger, 'manual'));
  v_actor uuid := auth.uid();
  v_now timestamptz := now();

  v_failed_notifications_threshold integer := 20;
  v_high_risk_admin_actions_threshold integer := 15;
  v_max_admin_accounts integer := 5;
  v_cadence_minutes integer := 1440;
  v_enabled boolean := true;

  v_admin_count integer := 0;
  v_orphan_partner_count integer := 0;
  v_failed_deliveries_24h integer := 0;
  v_high_risk_actions_24h integer := 0;
  v_rls_off_count integer := 0;
  v_rls_off_tables text[] := ARRAY[]::text[];

  v_warning_count integer := 0;
  v_critical_count integer := 0;
  v_total_count integer := 0;
  v_overall_status text := 'ok';
BEGIN
  IF v_trigger NOT IN ('manual', 'cron', 'system') THEN
    RAISE EXCEPTION 'trigger_source inválido: %', v_trigger;
  END IF;

  IF v_actor IS NOT NULL THEN
    IF NOT check_is_admin() THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
  ELSIF v_trigger <> 'cron' THEN
    RAISE EXCEPTION 'Sessão inválida para executar monitoramento manual';
  END IF;

  INSERT INTO public.security_monitor_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

  SELECT
    enabled,
    cadence_minutes,
    failed_notifications_threshold,
    high_risk_admin_actions_threshold,
    max_admin_accounts
  INTO
    v_enabled,
    v_cadence_minutes,
    v_failed_notifications_threshold,
    v_high_risk_admin_actions_threshold,
    v_max_admin_accounts
  FROM public.security_monitor_config
  WHERE id = 1;

  INSERT INTO public.security_monitor_runs (
    trigger_source,
    overall_status,
    started_at,
    created_by
  )
  VALUES (v_trigger, 'ok', v_now, v_actor)
  RETURNING id INTO v_run_id;

  SELECT
    COALESCE(array_agg(expected.table_name ORDER BY expected.table_name), ARRAY[]::text[]),
    COUNT(*)
  INTO
    v_rls_off_tables,
    v_rls_off_count
  FROM (
    VALUES
      ('profiles'),
      ('notifications'),
      ('admin_notifications'),
      ('affiliate_partners'),
      ('affiliate_applications'),
      ('affiliate_commission_ledger'),
      ('affiliate_payout_batches'),
      ('affiliate_payout_items'),
      ('notification_delivery_logs'),
      ('whatsapp_notification_queue')
  ) AS expected(table_name)
  JOIN pg_class c ON c.relname = expected.table_name
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.relkind = 'r'
    AND COALESCE(c.relrowsecurity, false) = false;

  INSERT INTO public.security_monitor_findings (run_id, check_key, severity, status, message, details)
  VALUES (
    v_run_id,
    'rls_sensitive_tables',
    CASE WHEN v_rls_off_count > 0 THEN 'critical' ELSE 'info' END,
    CASE WHEN v_rls_off_count > 0 THEN 'fail' ELSE 'pass' END,
    CASE
      WHEN v_rls_off_count > 0 THEN 'Foram encontradas tabelas sensíveis com RLS desativado.'
      ELSE 'RLS está ativo nas tabelas sensíveis monitoradas.'
    END,
    jsonb_build_object(
      'rls_off_count', v_rls_off_count,
      'tables', v_rls_off_tables
    )
  );

  IF v_rls_off_count > 0 THEN
    v_critical_count := v_critical_count + 1;
  END IF;

  SELECT COUNT(*)
  INTO v_admin_count
  FROM public.profiles
  WHERE COALESCE(is_admin, false) = true OR role = 'admin';

  INSERT INTO public.security_monitor_findings (run_id, check_key, severity, status, message, details)
  VALUES (
    v_run_id,
    'admin_accounts_volume',
    CASE
      WHEN v_admin_count = 0 THEN 'critical'
      WHEN v_admin_count > v_max_admin_accounts THEN 'warning'
      ELSE 'info'
    END,
    CASE
      WHEN v_admin_count = 0 THEN 'fail'
      WHEN v_admin_count > v_max_admin_accounts THEN 'warn'
      ELSE 'pass'
    END,
    CASE
      WHEN v_admin_count = 0 THEN 'Nenhuma conta admin foi encontrada.'
      WHEN v_admin_count > v_max_admin_accounts THEN 'Quantidade de contas admin acima do limite configurado.'
      ELSE 'Quantidade de contas admin dentro do limite configurado.'
    END,
    jsonb_build_object(
      'admin_count', v_admin_count,
      'max_admin_accounts', v_max_admin_accounts
    )
  );

  IF v_admin_count = 0 THEN
    v_critical_count := v_critical_count + 1;
  ELSIF v_admin_count > v_max_admin_accounts THEN
    v_warning_count := v_warning_count + 1;
  END IF;

  IF to_regclass('public.affiliate_partners') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_orphan_partner_count
    FROM public.affiliate_partners
    WHERE user_id IS NULL
      AND COALESCE(is_external, false) = false;
  ELSE
    v_orphan_partner_count := 0;
  END IF;

  INSERT INTO public.security_monitor_findings (run_id, check_key, severity, status, message, details)
  VALUES (
    v_run_id,
    'affiliate_orphan_internal_accounts',
    CASE WHEN v_orphan_partner_count > 0 THEN 'warning' ELSE 'info' END,
    CASE WHEN v_orphan_partner_count > 0 THEN 'warn' ELSE 'pass' END,
    CASE
      WHEN v_orphan_partner_count > 0 THEN 'Existem afiliados internos sem vínculo de usuário.'
      ELSE 'Nenhum afiliado interno órfão encontrado.'
    END,
    jsonb_build_object('orphan_partner_count', v_orphan_partner_count)
  );

  IF v_orphan_partner_count > 0 THEN
    v_warning_count := v_warning_count + 1;
  END IF;

  IF to_regclass('public.notification_delivery_logs') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_failed_deliveries_24h
    FROM public.notification_delivery_logs
    WHERE status = 'failed'
      AND created_at >= now() - INTERVAL '24 hours';
  ELSE
    v_failed_deliveries_24h := 0;
  END IF;

  INSERT INTO public.security_monitor_findings (run_id, check_key, severity, status, message, details)
  VALUES (
    v_run_id,
    'failed_notification_deliveries_24h',
    CASE WHEN v_failed_deliveries_24h > v_failed_notifications_threshold THEN 'warning' ELSE 'info' END,
    CASE WHEN v_failed_deliveries_24h > v_failed_notifications_threshold THEN 'warn' ELSE 'pass' END,
    CASE
      WHEN v_failed_deliveries_24h > v_failed_notifications_threshold THEN 'Falhas de entrega acima do limite nas últimas 24h.'
      ELSE 'Falhas de entrega dentro do limite nas últimas 24h.'
    END,
    jsonb_build_object(
      'failed_deliveries_24h', v_failed_deliveries_24h,
      'threshold', v_failed_notifications_threshold
    )
  );

  IF v_failed_deliveries_24h > v_failed_notifications_threshold THEN
    v_warning_count := v_warning_count + 1;
  END IF;

  IF to_regclass('public.admin_logs') IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_high_risk_actions_24h
    FROM public.admin_logs
    WHERE created_at >= now() - INTERVAL '24 hours'
      AND (
        upper(COALESCE(action_type, '')) LIKE '%DELETE%'
        OR upper(COALESCE(action_type, '')) LIKE '%ROLE%'
        OR upper(COALESCE(action_type, '')) LIKE '%SECURITY%'
        OR upper(COALESCE(action_type, '')) LIKE '%PRIV%'
      );
  ELSE
    v_high_risk_actions_24h := 0;
  END IF;

  INSERT INTO public.security_monitor_findings (run_id, check_key, severity, status, message, details)
  VALUES (
    v_run_id,
    'high_risk_admin_actions_24h',
    CASE WHEN v_high_risk_actions_24h > v_high_risk_admin_actions_threshold THEN 'warning' ELSE 'info' END,
    CASE WHEN v_high_risk_actions_24h > v_high_risk_admin_actions_threshold THEN 'warn' ELSE 'pass' END,
    CASE
      WHEN v_high_risk_actions_24h > v_high_risk_admin_actions_threshold THEN 'Ações administrativas de alto risco acima do limite nas últimas 24h.'
      ELSE 'Ações administrativas de alto risco dentro do limite nas últimas 24h.'
    END,
    jsonb_build_object(
      'high_risk_actions_24h', v_high_risk_actions_24h,
      'threshold', v_high_risk_admin_actions_threshold
    )
  );

  IF v_high_risk_actions_24h > v_high_risk_admin_actions_threshold THEN
    v_warning_count := v_warning_count + 1;
  END IF;

  SELECT COUNT(*)
  INTO v_total_count
  FROM public.security_monitor_findings
  WHERE run_id = v_run_id;

  IF v_critical_count > 0 THEN
    v_overall_status := 'critical';
  ELSIF v_warning_count > 0 THEN
    v_overall_status := 'warning';
  ELSE
    v_overall_status := 'ok';
  END IF;

  UPDATE public.security_monitor_runs
  SET
    overall_status = v_overall_status,
    finished_at = now(),
    summary = jsonb_build_object(
      'total_checks', v_total_count,
      'warning_checks', v_warning_count,
      'critical_checks', v_critical_count
    )
  WHERE id = v_run_id;

  UPDATE public.security_monitor_config
  SET
    last_run_at = now(),
    next_run_at = CASE
      WHEN enabled THEN now() + make_interval(mins => cadence_minutes)
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = 1;

  RETURN v_run_id;
EXCEPTION
  WHEN OTHERS THEN
    IF v_run_id IS NOT NULL THEN
      UPDATE public.security_monitor_runs
      SET
        overall_status = 'error',
        finished_at = now(),
        summary = jsonb_build_object('error', SQLERRM)
      WHERE id = v_run_id;
    END IF;
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.security_monitor_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_enabled boolean := true;
  v_next_run_at timestamptz;
BEGIN
  INSERT INTO public.security_monitor_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

  SELECT enabled, next_run_at
  INTO v_enabled, v_next_run_at
  FROM public.security_monitor_config
  WHERE id = 1;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN;
  END IF;

  IF v_next_run_at IS NULL OR v_next_run_at <= now() THEN
    PERFORM public.run_security_monitor('cron');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.run_security_monitor(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_security_monitor(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_monitor(text) TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'security-monitor-tick'
  ) THEN
    PERFORM cron.unschedule('security-monitor-tick');
  END IF;
END
$$;

SELECT cron.schedule(
  'security-monitor-tick',
  '*/30 * * * *',
  $$SELECT public.security_monitor_tick();$$
);

NOTIFY pgrst, 'reload schema';
