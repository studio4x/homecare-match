CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'widget', 'whatsapp')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'pending', 'retry', 'sent', 'failed', 'skipped')),
  recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('user', 'admin', 'external')),
  recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_contact TEXT,
  title TEXT,
  content TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_created
  ON public.notification_delivery_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_channel_status
  ON public.notification_delivery_logs (channel, status);

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_notification_queue'
      AND policyname = 'whatsapp_queue_admin_read'
  ) THEN
    CREATE POLICY "whatsapp_queue_admin_read"
    ON public.whatsapp_notification_queue
    FOR SELECT TO authenticated
    USING (check_is_admin());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_delivery_logs'
      AND policyname = 'notification_delivery_logs_admin_read'
  ) THEN
    CREATE POLICY "notification_delivery_logs_admin_read"
    ON public.notification_delivery_logs
    FOR SELECT TO authenticated
    USING (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
