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
      ADD COLUMN IF NOT EXISTS chatbot_ai_first BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS chatbot_show_mode_badge BOOLEAN DEFAULT false,
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
        decision_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE IF EXISTS public.chatbot_messages
      ADD COLUMN IF NOT EXISTS decision_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

      ALTER TABLE IF EXISTS public.chatbot_sessions
      ADD COLUMN IF NOT EXISTS human_handoff_active BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS human_handoff_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS human_handoff_admin_name TEXT,
      ADD COLUMN IF NOT EXISTS human_handoff_started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS human_handoff_ended_at TIMESTAMPTZ;

      DO $chatbot_mode$
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
      $chatbot_mode$;

      ALTER TABLE IF EXISTS public.chatbot_messages
      ADD CONSTRAINT chatbot_messages_mode_check
      CHECK (mode IS NULL OR mode IN ('faq', 'ai', 'fallback', 'system', 'human'));

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
      CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_handoff_active ON public.chatbot_sessions(human_handoff_active, updated_at DESC);
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

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chatbot_sessions_admin_update') THEN
          CREATE POLICY "chatbot_sessions_admin_update" ON public.chatbot_sessions
          FOR UPDATE TO authenticated
          USING (check_is_admin())
          WITH CHECK (check_is_admin());
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

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chatbot_messages_admin_insert') THEN
          CREATE POLICY "chatbot_messages_admin_insert" ON public.chatbot_messages
          FOR INSERT TO authenticated
          WITH CHECK (check_is_admin());
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

      WITH guide_seed AS (
        SELECT *
        FROM (
          VALUES
            (
              'Fluxo de cadastro para profissional',
              'onboarding',
              ARRAY['professional']::text[],
              ARRAY['como me cadastrar profissional','criar conta profissional','primeiro acesso profissional']::text[],
              '1) Acesse /login e escolha criar conta. 2) Conclua os dados iniciais e confirme acesso. 3) Entre no painel em /dashboard. 4) Finalize /dashboard/perfil para melhorar visibilidade na busca.',
              200,
              true
            ),
            (
              'Fluxo de cadastro para empresa e familia',
              'onboarding',
              ARRAY['company','family']::text[],
              ARRAY['como cadastrar empresa','como cadastrar familia','criar conta recrutador']::text[],
              '1) Inicie cadastro em /cadastro-empresa. 2) Conclua informacoes de contato e contexto de contratacao. 3) Acesse /dashboard para organizar processo. 4) Use /buscar para iniciar selecao de profissionais.',
              210,
              true
            ),
            (
              'Fluxo de login e acesso ao painel',
              'conta',
              ARRAY['professional','company','family']::text[],
              ARRAY['como fazer login','entrar no painel','acessar dashboard']::text[],
              '1) Entre em /login e autentique sua conta. 2) Acesse /dashboard. 3) Use menu lateral para navegar por perfil, contatos, suporte, pagamentos e demais modulos do seu perfil.',
              220,
              true
            ),
            (
              'Fluxo de redefinicao de senha',
              'conta',
              ARRAY['professional','company','family']::text[],
              ARRAY['esqueci minha senha','redefinir senha','nao consigo entrar']::text[],
              '1) Em /login, selecione recuperar senha. 2) Abra o link recebido por e-mail. 3) Finalize redefinicao em /redefinir-senha. 4) Retorne ao /login e acesse normalmente.',
              230,
              true
            ),
            (
              'Fluxo de onboarding inicial apos login',
              'onboarding',
              ARRAY['professional','company','family']::text[],
              ARRAY['tutorial inicial','onboarding da plataforma','como comecar no painel']::text[],
              '1) No primeiro acesso, siga o onboarding. 2) Complete os dados principais do perfil. 3) Revise funcionalidades em /funcionalidades. 4) Execute o primeiro fluxo objetivo: buscar profissionais, ajustar perfil ou abrir suporte.',
              240,
              true
            ),
            (
              'Fluxo para instalar o app no celular (PWA)',
              'app',
              ARRAY['professional','company','family']::text[],
              ARRAY['instalar aplicativo','adicionar na tela inicial','pwa celular']::text[],
              '1) Abra o site no navegador mobile. 2) Aceite instalar/adicionar na tela inicial. 3) Use o atalho para abrir a plataforma como app e agilizar acessos recorrentes.',
              250,
              true
            ),
            (
              'Fluxo de busca inteligente com filtros',
              'busca',
              ARRAY['company','family']::text[],
              ARRAY['buscar profissional com filtros','filtrar por cidade e especialidade','encontrar cuidador']::text[],
              '1) Acesse /buscar. 2) Defina filtros de localizacao, especialidade e disponibilidade. 3) Compare perfis com calma. 4) Abra contato somente com os candidatos aderentes.',
              260,
              true
            ),
            (
              'Fluxo de busca por geolocalizacao no mapa',
              'busca',
              ARRAY['company','family']::text[],
              ARRAY['buscar no mapa','profissionais proximos','geolocalizacao']::text[],
              '1) Em /buscar, habilite visualizacao por mapa quando disponivel. 2) Ajuste regiao e filtros. 3) Priorize candidatos proximos para reduzir tempo de deslocamento.',
              270,
              true
            ),
            (
              'Fluxo de avaliacao de perfil profissional',
              'busca',
              ARRAY['company','family']::text[],
              ARRAY['como avaliar perfil','analisar curriculo profissional','validar candidato']::text[],
              '1) Abra o perfil em /profissional/:id. 2) Revise experiencia, formacoes, bio e sinais de confianca. 3) Cruce com necessidade do paciente. 4) Siga para contato com criterios objetivos.',
              280,
              true
            ),
            (
              'Fluxo de contato via WhatsApp sem perder historico',
              'contatos',
              ARRAY['company','family']::text[],
              ARRAY['contato whatsapp','falar com profissional','registrar retorno']::text[],
              '1) Inicie contato no resultado da busca/perfil. 2) Continue conversa via WhatsApp quando disponivel. 3) Registre contexto e retorno em /dashboard/contatos para manter rastreabilidade.',
              290,
              true
            ),
            (
              'Fluxo de gestao de contatos no painel',
              'contatos',
              ARRAY['professional','company','family']::text[],
              ARRAY['historico de contatos','organizar contatos','acompanhar conversas']::text[],
              '1) Acesse /dashboard/contatos. 2) Revise contatos recentes e status do andamento. 3) Atualize sua priorizacao de proximos passos para evitar perda de oportunidade.',
              300,
              true
            ),
            (
              'Fluxo para consultar perfil publico do recrutador',
              'recrutador',
              ARRAY['professional','company','family']::text[],
              ARRAY['perfil do recrutador','quem esta contratando','ver empresa ou familia']::text[],
              '1) Abra /recruiter/:id ao receber contato. 2) Verifique contexto e perfil de quem esta recrutando. 3) Use essas informacoes para alinhar proposta, disponibilidade e expectativas.',
              310,
              true
            ),
            (
              'Fluxo para completar perfil profissional estrategico',
              'perfil',
              ARRAY['professional']::text[],
              ARRAY['completar meu perfil','otimizar perfil profissional','aumentar visibilidade']::text[],
              '1) Entre em /dashboard/perfil. 2) Complete bio, experiencias, cursos e dados de contato. 3) Garanta consistencia entre informacoes e servicos oferecidos. 4) Atualize periodicamente.',
              320,
              true
            ),
            (
              'Fluxo de biografia com IA e revisao manual',
              'perfil',
              ARRAY['professional']::text[],
              ARRAY['gerar bio com ia','texto do perfil com ia','melhorar biografia']::text[],
              '1) No perfil, acione geracao de bio com IA. 2) Revise o texto para manter dados reais e linguagem profissional. 3) Ajuste pontos-chave e salve apenas versao validada.',
              330,
              true
            ),
            (
              'Fluxo de verificacao profissional e selo',
              'seguranca',
              ARRAY['professional']::text[],
              ARRAY['como obter selo','verificacao profissional','envio de documentos']::text[],
              '1) Siga o fluxo de verificacao documental quando solicitado. 2) Envie documentos legiveis e corretos. 3) Acompanhe retorno da analise. 4) Com aprovado, o selo reforca confianca no perfil.',
              340,
              true
            ),
            (
              'Fluxo para acompanhar avisos e comunicados',
              'avisos',
              ARRAY['professional','company','family']::text[],
              ARRAY['onde ver avisos','comunicados da plataforma','noticias no painel']::text[],
              '1) Acesse /dashboard/avisos. 2) Leia atualizacoes operacionais e novidades. 3) Aplique mudancas relevantes nos seus fluxos de uso para evitar retrabalho.',
              350,
              true
            ),
            (
              'Fluxo de notificacoes em tempo real',
              'notificacoes',
              ARRAY['professional','company','family']::text[],
              ARRAY['notificacao em tempo real','alertas da plataforma','receber avisos imediatos']::text[],
              '1) Mantenha sessoes ativas no painel. 2) Monitore alertas de interacoes e eventos. 3) Priorize respostas mais urgentes para acelerar decisoes.',
              360,
              true
            ),
            (
              'Fluxo de configuracao de notificacoes push',
              'notificacoes',
              ARRAY['professional','company','family']::text[],
              ARRAY['ativar notificacao push','permissao de notificacao','alerta no navegador']::text[],
              '1) Permita notificacoes no navegador/dispositivo. 2) Mantenha permissao ativa para alertas importantes. 3) Ajuste rotina para responder rapidamente sem depender de checagem manual.',
              370,
              true
            ),
            (
              'Fluxo de assinatura e planos para profissional',
              'assinatura',
              ARRAY['professional']::text[],
              ARRAY['assinatura profissional','planos da plataforma','upgrade de plano']::text[],
              '1) Consulte plano e status em /dashboard/pagamentos. 2) Compare beneficios do plano atual. 3) Mantenha assinatura regular para preservar alcance e previsibilidade de uso.',
              380,
              true
            ),
            (
              'Fluxo de acompanhamento de pagamentos e faturas',
              'pagamentos',
              ARRAY['professional']::text[],
              ARRAY['ver faturas','historico de pagamento','comprovante']::text[],
              '1) Em /dashboard/pagamentos, revise transacoes e status. 2) Verifique pendencias. 3) Regularize rapidamente para evitar impacto em visibilidade e operacao.',
              390,
              true
            ),
            (
              'Fluxo para resolver falha de cobranca',
              'pagamentos',
              ARRAY['professional']::text[],
              ARRAY['pagamento recusado','erro de cobranca','assinatura pendente']::text[],
              '1) Valide metodo de pagamento e dados de cobranca. 2) Tente novamente no fluxo indicado em /dashboard/pagamentos. 3) Se persistir, abra ticket em /dashboard/suporte.',
              400,
              true
            ),
            (
              'Fluxo Academy: iniciar e concluir cursos',
              'academy',
              ARRAY['professional']::text[],
              ARRAY['como fazer cursos','iniciar curso academy','concluir trilha']::text[],
              '1) Entre em /dashboard/cursos. 2) Escolha curso alinhado ao seu objetivo. 3) Avance pelos modulos ate conclusao. 4) Revise aprendizado para aplicar no perfil e na pratica.',
              410,
              true
            ),
            (
              'Fluxo Academy: progresso e retomada de estudo',
              'academy',
              ARRAY['professional']::text[],
              ARRAY['acompanhar progresso do curso','retomar curso','status de aprendizagem']::text[],
              '1) Consulte progresso em /dashboard/cursos. 2) Retome modulo pendente. 3) Conclua etapas restantes para liberar avancos e certificados quando aplicavel.',
              420,
              true
            ),
            (
              'Fluxo de certificado e validacao publica',
              'certificados',
              ARRAY['professional','company','family']::text[],
              ARRAY['emitir certificado','validar certificado','autenticidade de certificado']::text[],
              '1) Conclua o curso na Academy. 2) Acesse visualizacao de certificado quando disponivel. 3) Para terceiros, valide autenticidade em /validar.',
              430,
              true
            ),
            (
              'Fluxo de indicacoes para profissional',
              'indicacoes',
              ARRAY['professional']::text[],
              ARRAY['como indicar colegas','programa embaixador','link de indicacao']::text[],
              '1) Abra /dashboard/indicacoes. 2) Compartilhe o link de forma qualificada. 3) Monitore evolucao dos indicados e indicadores do programa.',
              440,
              true
            ),
            (
              'Fluxo de acompanhamento de desempenho das indicacoes',
              'indicacoes',
              ARRAY['professional']::text[],
              ARRAY['acompanhar indicados','resultado das indicacoes','status de indicacao']::text[],
              '1) Consulte painel de indicacoes periodicamente. 2) Identifique gargalos no funil de indicados. 3) Ajuste abordagem para aumentar aderencia e conversao.',
              450,
              true
            ),
            (
              'Fluxo de cadastro e gestao de pacientes para empresa',
              'pacientes',
              ARRAY['company']::text[],
              ARRAY['cadastrar paciente empresa','organizar pacientes','painel pacientes empresa']::text[],
              '1) Acesse /dashboard/pacientes. 2) Cadastre pacientes com dados essenciais do caso. 3) Mantenha registros atualizados para apoiar selecao de profissionais.',
              460,
              true
            ),
            (
              'Fluxo empresa: da demanda ao contato com profissional',
              'processos_empresa',
              ARRAY['company']::text[],
              ARRAY['fluxo de contratacao empresa','empresa buscar e contatar profissional','processo completo empresa']::text[],
              '1) Estruture demanda em /dashboard/pacientes. 2) Busque perfis em /buscar com filtros adequados. 3) Avalie candidatos e inicie contato. 4) Registre andamento em /dashboard/contatos.',
              470,
              true
            ),
            (
              'Fluxo familia: encontrar profissional com seguranca',
              'processos_familia',
              ARRAY['family']::text[],
              ARRAY['fluxo familia contratar profissional','como familia escolhe profissional','passo a passo familia']::text[],
              '1) Defina criterios do cuidado. 2) Use /buscar para encontrar perfis aderentes. 3) Valide experiencia, referencias e sinais de confianca. 4) Contate e acompanhe retorno.',
              480,
              true
            ),
            (
              'Fluxo profissional: aumentar chance de contratacao',
              'processos_profissional',
              ARRAY['professional']::text[],
              ARRAY['como conseguir mais oportunidades','aumentar contatos','melhorar conversao do perfil']::text[],
              '1) Otimize /dashboard/perfil. 2) Mantenha assinatura e dados em dia. 3) Evolua na Academy. 4) Use indicacoes e respostas rapidas aos contatos para melhorar conversao.',
              490,
              true
            ),
            (
              'Fluxo de suporte por ticket fim a fim',
              'suporte',
              ARRAY['professional','company','family']::text[],
              ARRAY['abrir ticket e acompanhar','suporte completo','chamado com historico']::text[],
              '1) Abra ticket em /dashboard/suporte. 2) Escreva descricao objetiva com passos e evidencias. 3) Acompanhe respostas no mesmo chamado. 4) Confirme resolucao antes de encerrar.',
              500,
              true
            ),
            (
              'Fluxo de triagem: chatbot, FAQ ou chamado',
              'suporte',
              ARRAY['professional','company','family']::text[],
              ARRAY['quando usar chatbot','quando abrir chamado','faq ou suporte']::text[],
              '1) Comece pelo chatbot para duvidas operacionais rapidas. 2) Consulte /suporte para base FAQ. 3) Se houver erro, bloqueio ou caso especifico, abra ticket em /dashboard/suporte.',
              510,
              true
            ),
            (
              'Fluxo de sugestoes de melhoria da plataforma',
              'sugestoes',
              ARRAY['professional','company','family']::text[],
              ARRAY['enviar sugestao','melhoria da plataforma','ideias para produto']::text[],
              '1) Use o canal de sugestoes no produto. 2) Escreva problema, impacto e proposta de melhoria. 3) Acompanhe retorno quando houver atualizacao da equipe.',
              520,
              true
            ),
            (
              'Fluxo de seguranca e denuncias',
              'seguranca',
              ARRAY['professional','company','family']::text[],
              ARRAY['como denunciar usuario','reportar comportamento inadequado','seguranca da comunidade']::text[],
              '1) Reuna fatos objetivos e evidencias. 2) Use o canal de denuncia/report no fluxo correspondente. 3) Para urgencia operacional, abra ticket em /dashboard/suporte.',
              530,
              true
            ),
            (
              'Fluxo de uso do concierge',
              'concierge',
              ARRAY['company','family']::text[],
              ARRAY['como solicitar concierge','busca manual assistida','caso urgente']::text[],
              '1) Acione concierge quando houver urgencia ou caso dificil. 2) Informe criterios essenciais do paciente/vaga. 3) Acompanhe orientacoes da equipe ate obter shortlist aderente.',
              540,
              true
            ),
            (
              'Fluxo de consulta da pagina de funcionalidades',
              'funcionalidades',
              ARRAY['professional','company','family']::text[],
              ARRAY['como conhecer recursos','pagina de funcionalidades','entender modulos da plataforma']::text[],
              '1) Acesse /funcionalidades para mapa dos recursos. 2) Filtre mentalmente pelo seu perfil de uso. 3) Priorize os fluxos que geram impacto imediato no seu objetivo.',
              550,
              true
            ),
            (
              'Fluxo de uso da central FAQ publica',
              'faq',
              ARRAY['professional','company','family']::text[],
              ARRAY['onde ver faq','duvidas frequentes','base de conhecimento publica']::text[],
              '1) Entre em /suporte. 2) Pesquise por termo-chave. 3) Revise respostas da categoria correta. 4) Sem solucao, avance para ticket.',
              560,
              true
            ),
            (
              'Fluxo de uso do blog para apoio operacional',
              'blog',
              ARRAY['professional','company','family']::text[],
              ARRAY['como usar blog da plataforma','artigos de apoio','conteudo especializado']::text[],
              '1) Acesse /blog e filtre por categoria/tag. 2) Use os artigos como referencia para decisoes operacionais. 3) Aplique boas praticas ao seu contexto no produto.',
              570,
              true
            ),
            (
              'Fluxo de recuperacao de contexto ao trocar de pagina',
              'navegacao',
              ARRAY['professional','company','family']::text[],
              ARRAY['troquei de pagina e perdi contexto','continuar fluxo no dashboard','retomar atividade']::text[],
              '1) Retorne ao modulo principal do fluxo (perfil, contatos, suporte, cursos ou pagamentos). 2) Relembre o ultimo passo executado. 3) Continue de forma incremental para evitar retrabalho.',
              580,
              true
            ),
            (
              'Fluxo de contratacao assistida para casos complexos',
              'processos_criticos',
              ARRAY['company','family']::text[],
              ARRAY['caso complexo de contratacao','processo critico','cenario sensivel home care']::text[],
              '1) Estruture criterios clinicos e operacionais do caso. 2) Filtre candidatos com rigor. 3) Valide experiencia especifica. 4) Em dificuldade, combine suporte + concierge.',
              590,
              true
            ),
            (
              'Fluxo de qualidade: contato, avaliacao e feedback',
              'qualidade',
              ARRAY['professional','company','family']::text[],
              ARRAY['deixar avaliacao','coletar feedback','melhorar qualidade de interacao']::text[],
              '1) Conclua a interacao principal. 2) Registre feedback no recurso de avaliacao quando aplicavel. 3) Use aprendizado para melhorar proximos contatos e decisoes.',
              600,
              true
            ),
            (
              'Fluxo de operacao diaria no dashboard',
              'rotina',
              ARRAY['professional','company','family']::text[],
              ARRAY['rotina diaria no painel','checklist diario dashboard','como operar todos os dias']::text[],
              '1) Verifique avisos/notificacoes. 2) Execute tarefas prioritarias do seu perfil (contatos, perfil, pacientes, cursos, pagamentos). 3) Resolva pendencias de suporte. 4) Feche o dia com backlog atualizado.',
              610,
              true
            )
        ) AS t(title, module, audience, question_variants, content, position, is_published)
      )
      INSERT INTO public.support_guides (title, module, audience, question_variants, content, position, is_published)
      SELECT
        seed.title,
        seed.module,
        seed.audience,
        seed.question_variants,
        seed.content,
        seed.position,
        seed.is_published
      FROM guide_seed seed
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.support_guides g
        WHERE lower(trim(g.title)) = lower(trim(seed.title))
          AND lower(trim(g.module)) = lower(trim(seed.module))
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
            'Planos: diferenca entre mensal e anual',
            'planos',
            ARRAY['professional']::text[],
            ARRAY['diferenca plano mensal anual','qual plano escolher','mensal ou anual']::text[],
            '1) Compare objetivos e horizonte de uso. 2) Plano mensal opera com renovacao automatica. 3) Plano anual concentra o ciclo em 12 meses e costuma trazer melhor custo-beneficio para uso continuo.',
            620,
            true
          ),
          (
            'Planos: formas de pagamento da assinatura',
            'planos',
            ARRAY['professional']::text[],
            ARRAY['formas de pagamento plano anual','como pagar assinatura','cartao ou pix no plano']::text[],
            '1) Assinaturas usam cartao de credito no checkout. 2) No plano anual, pode haver parcelamento conforme configuracao do plano/site. 3) PIX e direcionado ao fluxo de cursos, nao ao fluxo de assinatura.',
            630,
            true
          ),
          (
            'Planos: renovacao e continuidade da assinatura',
            'planos',
            ARRAY['professional']::text[],
            ARRAY['renovacao plano mensal','renovacao plano anual','quando renova assinatura']::text[],
            '1) Mensal: renovacao automatica para continuidade do acesso. 2) Anual: renovacao manual no fluxo de pagamentos. 3) Acompanhe vencimento para evitar interrupcao de visibilidade.',
            640,
            true
          ),
          (
            'Pagamentos: interpretar status de cobranca',
            'pagamentos',
            ARRAY['professional']::text[],
            ARRAY['status pago pendente estornado','o que significa status da fatura','como ler status de pagamento']::text[],
            '1) Pago: cobranca confirmada. 2) Pendente/Open: pagamento ainda em processamento ou aguardando acao. 3) Estorno pendente/estornado: cancelamento em andamento ou concluido. 4) Consulte historico em /dashboard/pagamentos.',
            650,
            true
          ),
          (
            'Pagamentos: cancelamento e prazo de 7 dias',
            'pagamentos',
            ARRAY['professional']::text[],
            ARRAY['cancelar assinatura em 7 dias','prazo cancelamento assinatura','como pedir estorno']::text[],
            '1) O cancelamento segue janela de ate 7 dias apos pagamento confirmado. 2) Inicie o fluxo em /dashboard/pagamentos. 3) Em caso de estorno pendente, acompanhe atualizacao ate a conclusao.',
            660,
            true
          ),
          (
            'Pagamentos: resolver falha de cobranca rapidamente',
            'pagamentos',
            ARRAY['professional']::text[],
            ARRAY['pagamento recusado assinatura','erro no cartao','cobranca nao aprovada']::text[],
            '1) Revise dados do cartao e limite. 2) Tente novamente no checkout indicado em pagamentos. 3) Se o erro persistir, abra ticket no suporte com horario, valor e mensagem exibida.',
            670,
            true
          ),
          (
            'Cursos: metodos de pagamento e parcelamento',
            'cursos',
            ARRAY['professional']::text[],
            ARRAY['como pagar curso','pix no curso','cartao curso academy']::text[],
            '1) Para cursos pagos, o checkout pode oferecer cartao e PIX conforme configuracao vigente. 2) Quando cartao estiver ativo, pode haver parcelamento ate o limite do curso. 3) Finalize compra e acompanhe liberacao em /dashboard/cursos.',
            680,
            true
          ),
          (
            'Cursos: regra de curso gratuito para plano anual',
            'cursos',
            ARRAY['professional']::text[],
            ARRAY['curso gratuito plano anual','por que curso bloqueado','acesso academy plano']::text[],
            '1) Cursos gratuitos da Academy sao vinculados ao plano anual. 2) Se nao houver plano anual ativo, siga para upgrade de assinatura. 3) Com plano elegivel, reabra o curso e continue normalmente.',
            690,
            true
          ),
          (
            'Cursos: progresso, certificado e validacao',
            'cursos',
            ARRAY['professional','company','family']::text[],
            ARRAY['acompanhar progresso curso','emitir certificado academy','validar certificado']::text[],
            '1) Avance pelos modulos em /dashboard/cursos. 2) Ao concluir, consulte certificado quando disponivel. 3) A validacao publica pode ser feita em /validar para confirmar autenticidade.',
            700,
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
