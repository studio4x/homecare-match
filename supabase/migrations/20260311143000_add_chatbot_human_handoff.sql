ALTER TABLE IF EXISTS public.chatbot_sessions
  ADD COLUMN IF NOT EXISTS human_handoff_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_handoff_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS human_handoff_admin_name TEXT,
  ADD COLUMN IF NOT EXISTS human_handoff_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS human_handoff_ended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_handoff_active
  ON public.chatbot_sessions(human_handoff_active, updated_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chatbot_messages_mode_check'
      AND conrelid = 'public.chatbot_messages'::regclass
  ) THEN
    ALTER TABLE public.chatbot_messages
      DROP CONSTRAINT chatbot_messages_mode_check;
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.chatbot_messages
  ADD CONSTRAINT chatbot_messages_mode_check
  CHECK (mode IS NULL OR mode IN ('faq', 'ai', 'fallback', 'system', 'human'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chatbot_sessions'
      AND policyname = 'chatbot_sessions_admin_update'
  ) THEN
    CREATE POLICY "chatbot_sessions_admin_update"
    ON public.chatbot_sessions
    FOR UPDATE
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chatbot_messages'
      AND policyname = 'chatbot_messages_admin_insert'
  ) THEN
    CREATE POLICY "chatbot_messages_admin_insert"
    ON public.chatbot_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
