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
          'Pagamentos: como solicitar reembolso do pagamento',
          'pagamentos',
          ARRAY['professional']::text[],
          ARRAY['como pedir reembolso','solicitar estorno pagamento','quero reembolso da assinatura']::text[],
          '1) Abra /dashboard/pagamentos e localize a cobranca. 2) Inicie o fluxo de cancelamento/reembolso dentro da janela elegivel (ate 7 dias apos pagamento confirmado). 3) Registre motivo objetivo para acelerar analise. 4) Acompanhe o status ate conclusao.',
          710,
          true
        ),
        (
          'Pagamentos: evidencias para analise de reembolso',
          'pagamentos',
          ARRAY['professional']::text[],
          ARRAY['documentos para reembolso','o que enviar no estorno','comprovante para suporte de pagamento']::text[],
          '1) Tenha em maos horario da tentativa, valor e identificador da cobranca. 2) Inclua print da mensagem exibida quando houver erro. 3) Se abrir ticket, descreva o passo a passo executado em /dashboard/pagamentos. 4) Isso reduz retrabalho e acelera retorno.',
          720,
          true
        ),
        (
          'Pagamentos: acompanhar status de estorno e reembolso',
          'pagamentos',
          ARRAY['professional']::text[],
          ARRAY['status do reembolso','estorno pendente quanto tempo','acompanhar devolucao pagamento']::text[],
          '1) Consulte o historico em /dashboard/pagamentos. 2) Status comuns: estorno pendente (em processamento) e estornado (concluido). 3) Se ficar sem atualizacao por periodo prolongado, abra ticket em /dashboard/suporte com os dados da cobranca.',
          730,
          true
        ),
        (
          'Pagamentos: reembolso aprovado e valor ainda nao visivel',
          'pagamentos',
          ARRAY['professional']::text[],
          ARRAY['reembolso aprovado nao caiu','estorno nao apareceu na fatura','valor devolvido nao apareceu']::text[],
          '1) Confirmado como estornado na plataforma, o prazo de exibicao pode variar pelo emissor do cartao. 2) Aguarde o fechamento/atualizacao da fatura conforme operadora. 3) Persistindo divergencia, abra chamado com comprovante e dados da transacao para conferencia.',
          740,
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
