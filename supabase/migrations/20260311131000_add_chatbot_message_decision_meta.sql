ALTER TABLE IF EXISTS public.chatbot_messages
  ADD COLUMN IF NOT EXISTS decision_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.chatbot_messages
SET decision_meta = '{}'::jsonb
WHERE decision_meta IS NULL;

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_decision_path
  ON public.chatbot_messages ((decision_meta->>'decision_path'));

NOTIFY pgrst, 'reload schema';
