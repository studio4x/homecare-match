ALTER TABLE IF EXISTS public.chatbot_sessions
  ADD COLUMN IF NOT EXISTS user_closed_session BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_closed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_user_closed
  ON public.chatbot_sessions(user_closed_session, updated_at DESC);

NOTIFY pgrst, 'reload schema';
