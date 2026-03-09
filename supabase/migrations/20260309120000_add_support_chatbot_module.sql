ALTER TABLE IF EXISTS public.site_config
ADD COLUMN IF NOT EXISTS chatbot_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS chatbot_use_ai BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS chatbot_welcome_message TEXT DEFAULT 'Ola! Sou o assistente da plataforma. Posso ajudar com funcionalidades e como usar cada recurso.',
ADD COLUMN IF NOT EXISTS chatbot_out_of_scope_message TEXT DEFAULT 'Posso responder apenas sobre funcionalidades da plataforma e como usa-las. Se precisar, posso te direcionar para o suporte.',
ADD COLUMN IF NOT EXISTS chatbot_error_message TEXT DEFAULT 'Nao consegui responder agora. Tente novamente em instantes ou abra um chamado no suporte.',
ADD COLUMN IF NOT EXISTS chatbot_max_requests_anon_per_day INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS chatbot_max_requests_auth_per_day INTEGER DEFAULT 80,
ADD COLUMN IF NOT EXISTS chatbot_history_window INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS chatbot_retention_days INTEGER DEFAULT 30;

UPDATE public.site_config
SET
  chatbot_enabled = COALESCE(chatbot_enabled, true),
  chatbot_use_ai = COALESCE(chatbot_use_ai, true),
  chatbot_welcome_message = COALESCE(chatbot_welcome_message, 'Ola! Sou o assistente da plataforma. Posso ajudar com funcionalidades e como usar cada recurso.'),
  chatbot_out_of_scope_message = COALESCE(chatbot_out_of_scope_message, 'Posso responder apenas sobre funcionalidades da plataforma e como usa-las. Se precisar, posso te direcionar para o suporte.'),
  chatbot_error_message = COALESCE(chatbot_error_message, 'Nao consegui responder agora. Tente novamente em instantes ou abra um chamado no suporte.'),
  chatbot_max_requests_anon_per_day = COALESCE(chatbot_max_requests_anon_per_day, 20),
  chatbot_max_requests_auth_per_day = COALESCE(chatbot_max_requests_auth_per_day, 80),
  chatbot_history_window = COALESCE(chatbot_history_window, 12),
  chatbot_retention_days = COALESCE(chatbot_retention_days, 30);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  position INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  module TEXT NOT NULL DEFAULT 'geral',
  audience TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  question_variants TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  content TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_guides_position ON public.support_guides(position);
CREATE INDEX IF NOT EXISTS idx_support_guides_module ON public.support_guides(module);
CREATE INDEX IF NOT EXISTS idx_support_guides_published ON public.support_guides(is_published);

CREATE OR REPLACE FUNCTION public.set_support_guides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_guides_updated_at ON public.support_guides;
CREATE TRIGGER trg_support_guides_updated_at
BEFORE UPDATE ON public.support_guides
FOR EACH ROW
EXECUTE FUNCTION public.set_support_guides_updated_at();

CREATE TABLE IF NOT EXISTS public.chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  visitor_hash TEXT,
  page_path TEXT,
  role_context TEXT,
  last_mode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chatbot_sessions_actor_check CHECK (user_id IS NOT NULL OR visitor_hash IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_user ON public.chatbot_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_visitor_hash ON public.chatbot_sessions(visitor_hash);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_updated_at ON public.chatbot_sessions(updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_chatbot_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chatbot_sessions_updated_at ON public.chatbot_sessions;
CREATE TRIGGER trg_chatbot_sessions_updated_at
BEFORE UPDATE ON public.chatbot_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_chatbot_sessions_updated_at();

CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chatbot_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  mode TEXT CHECK (mode IN ('faq', 'ai', 'fallback', 'system')),
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session_created ON public.chatbot_messages(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chatbot_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_key TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  visitor_hash TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chatbot_usage_logs_actor_date_key UNIQUE (actor_key, request_date)
);

CREATE INDEX IF NOT EXISTS idx_chatbot_usage_logs_request_date ON public.chatbot_usage_logs(request_date DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_usage_logs_user ON public.chatbot_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_usage_logs_visitor_hash ON public.chatbot_usage_logs(visitor_hash);

CREATE OR REPLACE FUNCTION public.set_chatbot_usage_logs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chatbot_usage_logs_updated_at ON public.chatbot_usage_logs;
CREATE TRIGGER trg_chatbot_usage_logs_updated_at
BEFORE UPDATE ON public.chatbot_usage_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_chatbot_usage_logs_updated_at();

ALTER TABLE public.support_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_usage_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_faqs' AND policyname = 'support_faqs_read'
  ) THEN
    CREATE POLICY "support_faqs_read"
    ON public.support_faqs
    FOR SELECT
    TO anon, authenticated
    USING (is_published = true OR check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_faqs' AND policyname = 'support_faqs_admin_all'
  ) THEN
    CREATE POLICY "support_faqs_admin_all"
    ON public.support_faqs
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_guides' AND policyname = 'support_guides_public_read'
  ) THEN
    CREATE POLICY "support_guides_public_read"
    ON public.support_guides
    FOR SELECT
    TO anon, authenticated
    USING (is_published = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_guides' AND policyname = 'support_guides_admin_all'
  ) THEN
    CREATE POLICY "support_guides_admin_all"
    ON public.support_guides
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chatbot_sessions' AND policyname = 'chatbot_sessions_user_read_own'
  ) THEN
    CREATE POLICY "chatbot_sessions_user_read_own"
    ON public.chatbot_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chatbot_sessions' AND policyname = 'chatbot_sessions_admin_read'
  ) THEN
    CREATE POLICY "chatbot_sessions_admin_read"
    ON public.chatbot_sessions
    FOR SELECT
    TO authenticated
    USING (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chatbot_messages' AND policyname = 'chatbot_messages_user_read_own'
  ) THEN
    CREATE POLICY "chatbot_messages_user_read_own"
    ON public.chatbot_messages
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.chatbot_sessions s
        WHERE s.id = chatbot_messages.session_id
          AND s.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chatbot_messages' AND policyname = 'chatbot_messages_admin_read'
  ) THEN
    CREATE POLICY "chatbot_messages_admin_read"
    ON public.chatbot_messages
    FOR SELECT
    TO authenticated
    USING (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chatbot_usage_logs' AND policyname = 'chatbot_usage_logs_admin_read'
  ) THEN
    CREATE POLICY "chatbot_usage_logs_admin_read"
    ON public.chatbot_usage_logs
    FOR SELECT
    TO authenticated
    USING (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
