ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.whatsapp_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('user', 'admin')),
  recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_phone_e164 TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_params JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retry', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status_next_retry
  ON public.whatsapp_notification_queue (status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_created_at
  ON public.whatsapp_notification_queue (created_at DESC);

ALTER TABLE public.whatsapp_notification_queue ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
