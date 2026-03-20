CREATE OR REPLACE FUNCTION public.notify_security_monitor_critical_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_title text := 'Alerta critico no monitoramento de seguranca';
  v_content text;
  v_link text := '/admin/seguranca';
  v_notification_id uuid := NULL;
BEGIN
  IF NEW.overall_status <> 'critical' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.overall_status IS NOT DISTINCT FROM NEW.overall_status THEN
    RETURN NEW;
  END IF;

  v_content := format(
    'A varredura %s encontrou risco critico. Revise os achados na pagina de monitoramento de seguranca.',
    NEW.id::text
  );

  IF to_regclass('public.admin_notifications') IS NOT NULL THEN
    INSERT INTO public.admin_notifications (
      title,
      content,
      link,
      type,
      is_read,
      is_completed
    )
    VALUES (
      v_title,
      v_content,
      v_link,
      'error',
      false,
      false
    )
    RETURNING id INTO v_notification_id;
  END IF;

  IF to_regclass('public.notification_delivery_logs') IS NOT NULL THEN
    INSERT INTO public.notification_delivery_logs (
      event_type,
      channel,
      status,
      recipient_kind,
      recipient_contact,
      title,
      content,
      metadata
    )
    VALUES (
      'security_monitor_critical_admin',
      'widget',
      'sent',
      'admin',
      'admin_notifications',
      v_title,
      v_content,
      jsonb_build_object(
        'run_id', NEW.id,
        'trigger_source', NEW.trigger_source,
        'summary', COALESCE(NEW.summary, '{}'::jsonb),
        'admin_notification_id', v_notification_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_security_monitor_critical_admin_notify ON public.security_monitor_runs;

CREATE TRIGGER trg_security_monitor_critical_admin_notify
AFTER INSERT OR UPDATE OF overall_status ON public.security_monitor_runs
FOR EACH ROW
WHEN (NEW.overall_status = 'critical')
EXECUTE FUNCTION public.notify_security_monitor_critical_admin();

NOTIFY pgrst, 'reload schema';
