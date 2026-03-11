ALTER TABLE IF EXISTS public.chatbot_sessions
  ADD COLUMN IF NOT EXISTS last_user_interaction_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inactivity_warning_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_closed_session BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_closed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_last_user_interaction
  ON public.chatbot_sessions(last_user_interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_auto_closed
  ON public.chatbot_sessions(auto_closed_session, updated_at DESC);

NOTIFY pgrst, 'reload schema';
