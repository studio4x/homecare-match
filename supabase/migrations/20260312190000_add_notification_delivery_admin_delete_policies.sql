DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_notification_queue'
      AND policyname = 'whatsapp_queue_admin_delete'
  ) THEN
    CREATE POLICY "whatsapp_queue_admin_delete"
    ON public.whatsapp_notification_queue
    FOR DELETE TO authenticated
    USING (check_is_admin());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_delivery_logs'
      AND policyname = 'notification_delivery_logs_admin_delete'
  ) THEN
    CREATE POLICY "notification_delivery_logs_admin_delete"
    ON public.notification_delivery_logs
    FOR DELETE TO authenticated
    USING (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
