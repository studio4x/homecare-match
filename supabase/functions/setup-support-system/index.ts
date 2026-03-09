import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let client: Client | null = null;
  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      throw new Error("A variavel de ambiente SUPABASE_DB_URL nao esta configurada.");
    }

    client = new Client(dbUrl);
    await client.connect();

    const sql = `
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
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.chatbot_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        visitor_hash TEXT,
        page_path TEXT,
        role_context TEXT,
        last_mode TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chatbot_sessions_actor_check CHECK (user_id IS NOT NULL OR visitor_hash IS NOT NULL)
      );

      CREATE TABLE IF NOT EXISTS public.chatbot_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES public.chatbot_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        mode TEXT CHECK (mode IN ('faq', 'ai', 'fallback', 'system')),
        sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.chatbot_usage_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_key TEXT NOT NULL,
        user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        visitor_hash TEXT,
        request_date DATE NOT NULL DEFAULT CURRENT_DATE,
        request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
        last_request_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chatbot_usage_logs_actor_date_key UNIQUE (actor_key, request_date)
      );

      CREATE TABLE IF NOT EXISTS public.chatbot_unanswered_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        normalized_question TEXT NOT NULL,
        question TEXT NOT NULL,
        occurrences INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'new',
        first_asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_asked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_reason TEXT,
        last_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        last_visitor_hash TEXT,
        last_session_id UUID REFERENCES public.chatbot_sessions(id) ON DELETE SET NULL,
        last_page_path TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_support_guides_position ON public.support_guides(position);
      CREATE INDEX IF NOT EXISTS idx_support_guides_published ON public.support_guides(is_published);
      CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_user ON public.chatbot_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_visitor_hash ON public.chatbot_sessions(visitor_hash);
      CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session_created ON public.chatbot_messages(session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chatbot_usage_logs_request_date ON public.chatbot_usage_logs(request_date DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chatbot_unanswered_questions_normalized_question ON public.chatbot_unanswered_questions(normalized_question);
      CREATE INDEX IF NOT EXISTS idx_chatbot_unanswered_questions_last_asked ON public.chatbot_unanswered_questions(last_asked_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chatbot_unanswered_questions_status ON public.chatbot_unanswered_questions(status);

      CREATE OR REPLACE FUNCTION public.set_support_guides_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $fn$;

      DROP TRIGGER IF EXISTS trg_support_guides_updated_at ON public.support_guides;
      CREATE TRIGGER trg_support_guides_updated_at
      BEFORE UPDATE ON public.support_guides
      FOR EACH ROW
      EXECUTE FUNCTION public.set_support_guides_updated_at();

      CREATE OR REPLACE FUNCTION public.set_chatbot_sessions_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $fn$;

      DROP TRIGGER IF EXISTS trg_chatbot_sessions_updated_at ON public.chatbot_sessions;
      CREATE TRIGGER trg_chatbot_sessions_updated_at
      BEFORE UPDATE ON public.chatbot_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_chatbot_sessions_updated_at();

      CREATE OR REPLACE FUNCTION public.set_chatbot_usage_logs_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $fn$;

      DROP TRIGGER IF EXISTS trg_chatbot_usage_logs_updated_at ON public.chatbot_usage_logs;
      CREATE TRIGGER trg_chatbot_usage_logs_updated_at
      BEFORE UPDATE ON public.chatbot_usage_logs
      FOR EACH ROW
      EXECUTE FUNCTION public.set_chatbot_usage_logs_updated_at();

      CREATE OR REPLACE FUNCTION public.set_chatbot_unanswered_questions_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $fn$;

      DROP TRIGGER IF EXISTS trg_chatbot_unanswered_questions_updated_at ON public.chatbot_unanswered_questions;
      CREATE TRIGGER trg_chatbot_unanswered_questions_updated_at
      BEFORE UPDATE ON public.chatbot_unanswered_questions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_chatbot_unanswered_questions_updated_at();

      ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.support_faqs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.support_guides ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chatbot_sessions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chatbot_usage_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chatbot_unanswered_questions ENABLE ROW LEVEL SECURITY;

      DO $pub$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;

        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
        EXCEPTION WHEN others THEN NULL;
        END;

        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
        EXCEPTION WHEN others THEN NULL;
        END;
      END
      $pub$;

      DO $policy$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_tickets_owner') THEN
          CREATE POLICY "support_tickets_owner" ON public.support_tickets
          FOR ALL TO authenticated
          USING (auth.uid() = user_id OR check_is_admin())
          WITH CHECK (auth.uid() = user_id OR check_is_admin());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_messages_owner') THEN
          CREATE POLICY "support_messages_owner" ON public.support_messages
          FOR ALL TO authenticated
          USING (
            EXISTS (
              SELECT 1
              FROM public.support_tickets t
              WHERE t.id = support_messages.ticket_id
                AND (t.user_id = auth.uid() OR check_is_admin())
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1
              FROM public.support_tickets t
              WHERE t.id = support_messages.ticket_id
                AND (t.user_id = auth.uid() OR check_is_admin())
            )
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_faqs_read') THEN
          CREATE POLICY "support_faqs_read" ON public.support_faqs
          FOR SELECT TO anon, authenticated
          USING (is_published = true OR check_is_admin());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_faqs_admin_all') THEN
          CREATE POLICY "support_faqs_admin_all" ON public.support_faqs
          FOR ALL TO authenticated
          USING (check_is_admin())
          WITH CHECK (check_is_admin());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_guides_public_read') THEN
          CREATE POLICY "support_guides_public_read" ON public.support_guides
          FOR SELECT TO anon, authenticated
          USING (is_published = true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_guides_admin_all') THEN
          CREATE POLICY "support_guides_admin_all" ON public.support_guides
          FOR ALL TO authenticated
          USING (check_is_admin())
          WITH CHECK (check_is_admin());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chatbot_sessions_user_read_own') THEN
          CREATE POLICY "chatbot_sessions_user_read_own" ON public.chatbot_sessions
          FOR SELECT TO authenticated
          USING (auth.uid() = user_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chatbot_sessions_admin_read') THEN
          CREATE POLICY "chatbot_sessions_admin_read" ON public.chatbot_sessions
          FOR SELECT TO authenticated
          USING (check_is_admin());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chatbot_messages_user_read_own') THEN
          CREATE POLICY "chatbot_messages_user_read_own" ON public.chatbot_messages
          FOR SELECT TO authenticated
          USING (
            EXISTS (
              SELECT 1
              FROM public.chatbot_sessions s
              WHERE s.id = chatbot_messages.session_id
                AND s.user_id = auth.uid()
            )
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chatbot_messages_admin_read') THEN
          CREATE POLICY "chatbot_messages_admin_read" ON public.chatbot_messages
          FOR SELECT TO authenticated
          USING (check_is_admin());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chatbot_usage_logs_admin_read') THEN
          CREATE POLICY "chatbot_usage_logs_admin_read" ON public.chatbot_usage_logs
          FOR SELECT TO authenticated
          USING (check_is_admin());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chatbot_unanswered_questions_admin_all') THEN
          CREATE POLICY "chatbot_unanswered_questions_admin_all" ON public.chatbot_unanswered_questions
          FOR ALL TO authenticated
          USING (check_is_admin())
          WITH CHECK (check_is_admin());
        END IF;
      END
      $policy$;

      INSERT INTO public.support_faqs (question, answer, category, position, is_published)
      SELECT
        seed.question,
        seed.answer,
        seed.category,
        seed.position,
        seed.is_published
      FROM (
        VALUES
          ('Como encontro profissionais na minha regiao?', 'Acesse /buscar e aplique filtros de cidade, bairro, especialidade e disponibilidade para encontrar perfis aderentes.', 'busca', 10, true),
          ('Como abrir um chamado de suporte?', 'Entre em /dashboard/suporte e clique em novo chamado. Descreva o problema com detalhes e, se possivel, anexe evidencias.', 'suporte', 20, true),
          ('Como acompanho um chamado aberto?', 'Acesse /dashboard/suporte e abra o ticket para acompanhar respostas e status. Continue no mesmo chamado para manter historico.', 'suporte', 30, true),
          ('Como atualizar meu perfil profissional?', 'Use /dashboard/perfil para editar biografia, experiencias, formacoes e dados de contato.', 'perfil', 40, true),
          ('Como funcionam os pagamentos e assinatura?', 'No painel em /dashboard/pagamentos, voce consulta status da assinatura e historico de cobranca.', 'assinatura', 50, true),
          ('Como usar os cursos da Academy?', 'Abra /dashboard/cursos, selecione o curso e conclua os modulos para avancar no progresso.', 'academy', 60, true),
          ('Como validar certificado pela pagina publica?', 'A validacao de certificado pode ser feita em /validar.', 'academy', 70, true),
          ('Sou empresa: como cadastro pacientes?', 'Empresas podem organizar pacientes em /dashboard/pacientes.', 'empresa', 80, true),
          ('Como funciona o programa de indicacoes?', 'Profissionais acompanham indicacoes em /dashboard/indicacoes, conforme regras vigentes.', 'indicacoes', 90, true),
          ('Como recuperar minha senha?', 'Na tela /login, use a opcao de recuperar senha para seguir ao fluxo de redefinicao.', 'conta', 100, true)
      ) AS seed(question, answer, category, position, is_published)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.support_faqs f
        WHERE lower(trim(f.question)) = lower(trim(seed.question))
      );

      INSERT INTO public.support_guides (title, module, audience, question_variants, content, position, is_published)
      SELECT
        seed.title,
        seed.module,
        seed.audience,
        seed.question_variants,
        seed.content,
        seed.position,
        seed.is_published
      FROM (
        VALUES
          (
            'Como abrir e acompanhar chamado',
            'suporte',
            ARRAY['professional','company','family']::text[],
            ARRAY['abrir chamado','criar ticket','acompanhar suporte']::text[],
            '1) Entre em /dashboard/suporte. 2) Crie o chamado com contexto e resultado esperado. 3) Anexe evidencias quando necessario. 4) Acompanhe o mesmo ticket ate a resolucao.',
            10,
            true
          ),
          (
            'Como buscar profissionais com filtros',
            'busca',
            ARRAY['company','family']::text[],
            ARRAY['buscar profissional','filtrar cidade','filtrar especialidade']::text[],
            '1) Acesse /buscar. 2) Aplique filtros de localizacao, especialidade e disponibilidade. 3) Compare perfis e inicie contato com os mais aderentes.',
            20,
            true
          ),
          (
            'Como otimizar o perfil profissional',
            'perfil',
            ARRAY['professional']::text[],
            ARRAY['editar perfil','melhorar visibilidade','completar perfil']::text[],
            '1) Acesse /dashboard/perfil. 2) Preencha bio, experiencias e formacoes. 3) Mantenha dados de contato atualizados.',
            30,
            true
          ),
          (
            'Como acompanhar pagamentos e assinatura',
            'assinatura',
            ARRAY['professional']::text[],
            ARRAY['status assinatura','faturas','historico de pagamento']::text[],
            '1) Abra /dashboard/pagamentos. 2) Verifique status da assinatura. 3) Resolva pendencias de cobranca para evitar impacto de visibilidade.',
            40,
            true
          ),
          (
            'Como estudar na Academy e validar certificado',
            'academy',
            ARRAY['professional','company','family']::text[],
            ARRAY['academy','curso','certificado','validar certificado']::text[],
            '1) Estude em /dashboard/cursos. 2) Conclua modulos para avancar progresso. 3) Valide certificados em /validar quando necessario.',
            50,
            true
          ),
          (
            'Como cadastrar pacientes para recrutamento',
            'empresa',
            ARRAY['company']::text[],
            ARRAY['cadastrar pacientes','painel pacientes','organizar demandas']::text[],
            '1) Acesse /dashboard/pacientes. 2) Cadastre os dados necessarios de cada caso. 3) Atualize informacoes para apoiar recrutamento.',
            60,
            true
          ),
          (
            'Como usar o programa de indicacoes',
            'indicacoes',
            ARRAY['professional']::text[],
            ARRAY['indicar colega','link indicacao','acompanhar indicacoes']::text[],
            '1) Entre em /dashboard/indicacoes. 2) Compartilhe seu link. 3) Acompanhe resultados conforme regras vigentes.',
            70,
            true
          ),
          (
            'Como recuperar acesso da conta',
            'conta',
            ARRAY['professional','company','family']::text[],
            ARRAY['esqueci senha','redefinir senha','nao consigo entrar']::text[],
            '1) Em /login, clique em recuperar senha. 2) Abra o link recebido por e-mail. 3) Defina nova senha e acesse novamente.',
            80,
            true
          )
      ) AS seed(title, module, audience, question_variants, content, position, is_published)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.support_guides g
        WHERE lower(trim(g.title)) = lower(trim(seed.title))
          AND lower(trim(g.module)) = lower(trim(seed.module))
      );

      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Sistema de suporte e chatbot sincronizado!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) {
      try {
        await client.end();
      } catch {
        // ignore
      }
    }

    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
