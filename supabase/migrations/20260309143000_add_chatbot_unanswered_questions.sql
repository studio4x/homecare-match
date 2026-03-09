CREATE TABLE IF NOT EXISTS public.chatbot_unanswered_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_question TEXT NOT NULL,
  question TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'new',
  first_asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_asked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reason TEXT,
  last_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_visitor_hash TEXT,
  last_session_id UUID REFERENCES public.chatbot_sessions(id) ON DELETE SET NULL,
  last_page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.chatbot_unanswered_questions
  ADD COLUMN IF NOT EXISTS normalized_question TEXT,
  ADD COLUMN IF NOT EXISTS question TEXT,
  ADD COLUMN IF NOT EXISTS occurrences INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS first_asked_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_asked_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_visitor_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_session_id UUID REFERENCES public.chatbot_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_page_path TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.chatbot_unanswered_questions
SET
  occurrences = COALESCE(occurrences, 1),
  status = COALESCE(NULLIF(status, ''), 'new'),
  first_asked_at = COALESCE(first_asked_at, created_at, now()),
  last_asked_at = COALESCE(last_asked_at, first_asked_at, now()),
  question = COALESCE(NULLIF(question, ''), normalized_question, 'pergunta sem conteudo'),
  normalized_question = COALESCE(NULLIF(normalized_question, ''), lower(regexp_replace(question, '\s+', ' ', 'g')));

ALTER TABLE public.chatbot_unanswered_questions
  ALTER COLUMN normalized_question SET NOT NULL,
  ALTER COLUMN question SET NOT NULL,
  ALTER COLUMN occurrences SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN first_asked_at SET NOT NULL,
  ALTER COLUMN last_asked_at SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chatbot_unanswered_questions_normalized_question
  ON public.chatbot_unanswered_questions(normalized_question);

CREATE INDEX IF NOT EXISTS idx_chatbot_unanswered_questions_last_asked_at
  ON public.chatbot_unanswered_questions(last_asked_at DESC);

CREATE INDEX IF NOT EXISTS idx_chatbot_unanswered_questions_status
  ON public.chatbot_unanswered_questions(status);

CREATE OR REPLACE FUNCTION public.set_chatbot_unanswered_questions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chatbot_unanswered_questions_updated_at ON public.chatbot_unanswered_questions;
CREATE TRIGGER trg_chatbot_unanswered_questions_updated_at
BEFORE UPDATE ON public.chatbot_unanswered_questions
FOR EACH ROW
EXECUTE FUNCTION public.set_chatbot_unanswered_questions_updated_at();

ALTER TABLE public.chatbot_unanswered_questions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chatbot_unanswered_questions'
      AND policyname = 'chatbot_unanswered_questions_admin_all'
  ) THEN
    CREATE POLICY "chatbot_unanswered_questions_admin_all"
    ON public.chatbot_unanswered_questions
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
