ALTER TABLE IF EXISTS public.site_config
ADD COLUMN IF NOT EXISTS chatbot_show_mode_badge BOOLEAN DEFAULT false;

UPDATE public.site_config
SET chatbot_show_mode_badge = COALESCE(chatbot_show_mode_badge, false);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'support_guides'
  ) THEN
    WITH seed(title, module, audience, question_variants, content, position, is_published) AS (
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
    FROM seed
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.support_guides g
      WHERE lower(trim(g.title)) = lower(trim(seed.title))
        AND lower(trim(g.module)) = lower(trim(seed.module))
    );
  END IF;
END;
$$;
