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
          'Cadastro: como escolher o tipo de conta',
          'onboarding',
          ARRAY['professional','company','family']::text[],
          ARRAY['qual tipo de cadastro escolher','cadastro profissional empresa familia','como me cadastrar']::text[],
          '1) Se voce presta servico, escolha cadastro de profissional. 2) Se voce contrata para operacao, escolha empresa. 3) Se voce contrata para cuidado familiar, escolha familia. 4) Depois de criar a conta, complete seu perfil e siga para o painel.',
          710,
          true
        ),
        (
          'Cadastro com cupom promocional',
          'onboarding',
          ARRAY['professional']::text[],
          ARRAY['onde inserir cupom no cadastro','cupom no cadastro profissional','codigo promocional cadastro']::text[],
          '1) No formulario de cadastro, informe o codigo promocional no campo de cupom. 2) Se valido, os dias de beneficio sao aplicados automaticamente na conta. 3) Conclua o cadastro e acompanhe o periodo ativo no painel.',
          720,
          true
        ),
        (
          'Teste gratis: duracao e limite de acesso',
          'trial',
          ARRAY['professional']::text[],
          ARRAY['quanto dura teste gratis','teste gratis tem acesso total','periodo de teste plataforma']::text[],
          '1) O cadastro padrao ativa periodo de teste gratis de 30 dias. 2) Durante o teste, o acesso e limitado em relacao aos planos pagos. 3) Se houver cupom valido no cadastro, prevalecem os dias configurados no cupom.',
          730,
          true
        ),
        (
          'Teste gratis: acompanhar dias restantes',
          'trial',
          ARRAY['professional']::text[],
          ARRAY['onde ver dias restantes do teste','quantos dias faltam no teste','acompanhar teste gratis']::text[],
          '1) Abra o Dashboard e consulte o card do plano atual. 2) Verifique dias restantes, data de expiracao e orientacao de proximo passo. 3) Programe renovacao antes do fim para evitar perda de continuidade.',
          740,
          true
        ),
        (
          'Migracao do teste para plano mensal ou anual',
          'planos',
          ARRAY['professional']::text[],
          ARRAY['como sair do teste gratis','assinar plano mensal','assinar plano anual']::text[],
          '1) No Dashboard, acesse a area de Pagamentos. 2) Compare plano mensal e plano anual conforme seu horizonte de uso. 3) Finalize a assinatura para manter visibilidade e recursos ativos sem interrupcao.',
          750,
          true
        ),
        (
          'Indicacoes: como funciona o link de convite',
          'indicacoes',
          ARRAY['professional']::text[],
          ARRAY['link de convite indicacao','como compartilhar meu convite','cadastro por convite']::text[],
          '1) Gere e copie seu link de indicacao no painel de Indicacoes. 2) Compartilhe com colegas aderentes ao perfil da plataforma. 3) Quem entra pelo link segue para cadastro e fica vinculado ao seu acompanhamento de indicacoes.',
          760,
          true
        ),
        (
          'Dashboard inicial: leitura rapida diaria',
          'dashboard',
          ARRAY['professional','company','family']::text[],
          ARRAY['como usar painel inicial','o que ver no dashboard','rotina no dashboard']::text[],
          '1) Comece por alertas e avisos do dia. 2) Revise status de plano, contatos e pendencias. 3) Execute as tarefas do seu perfil (busca, perfil, pacientes, cursos ou suporte). 4) Finalize com backlog atualizado.',
          770,
          true
        ),
        (
          'Acesso logado x visitante',
          'conta',
          ARRAY['professional','company','family']::text[],
          ARRAY['sem login consigo acessar dashboard','diferenca visitante e logado','preciso entrar para usar painel']::text[],
          '1) Visitante pode navegar em paginas publicas e FAQ. 2) Para usar Dashboard, contatos, suporte e recursos pessoais, e necessario estar logado. 3) Se nao tiver conta, conclua o cadastro antes de acessar essas areas.',
          780,
          true
        ),
        (
          'Assinatura expirada: como reativar',
          'pagamentos',
          ARRAY['professional']::text[],
          ARRAY['assinatura expirou e agora','reativar plano','voltar a ter visibilidade']::text[],
          '1) Abra Pagamentos no Dashboard. 2) Confirme o status da assinatura e escolha renovacao mensal ou anual. 3) Regularize a cobranca para recuperar continuidade de uso e visibilidade do perfil.',
          790,
          true
        ),
        (
          'Cursos: diferenca entre catalogo publico e area do aluno',
          'cursos',
          ARRAY['professional']::text[],
          ARRAY['curso publico e curso no dashboard','onde acessar meus cursos','catalogo de cursos']::text[],
          '1) A pagina publica de cursos apresenta o catalogo e detalhes de cada conteudo. 2) A area do aluno no Dashboard concentra progresso, acesso liberado e historico. 3) Use o Dashboard para continuar exatamente de onde parou.',
          800,
          true
        ),
        (
          'Cursos pagos: checkout e liberacao de acesso',
          'cursos',
          ARRAY['professional']::text[],
          ARRAY['como comprar curso','pagamento curso cartao pix','curso pago nao liberou']::text[],
          '1) Escolha o curso e avance para checkout. 2) Conclua pagamento pelos metodos disponiveis no fluxo. 3) Com confirmacao, o curso e liberado no Dashboard. 4) Se houver atraso de liberacao, abra suporte com comprovante.',
          810,
          true
        ),
        (
          'Cursos gratuitos vinculados ao plano anual',
          'cursos',
          ARRAY['professional']::text[],
          ARRAY['curso gratis exige plano anual','por que curso gratuito bloqueado','acesso academy plano anual']::text[],
          '1) Alguns cursos gratuitos da Academy dependem de assinatura anual ativa. 2) Sem elegibilidade, o sistema orienta upgrade de plano. 3) Com plano anual ativo, o acesso e restabelecido automaticamente no curso.',
          820,
          true
        ),
        (
          'Certificado: compartilhar e validar autenticidade',
          'certificados',
          ARRAY['professional','company','family']::text[],
          ARRAY['como compartilhar certificado','como validar certificado','autenticidade de certificado']::text[],
          '1) Depois de concluir o curso, abra seu certificado na area de cursos. 2) Compartilhe o link de validacao quando precisar comprovar autenticidade. 3) A validacao confirma emissao legitima pela plataforma.',
          830,
          true
        ),
        (
          'Cadastro de empresa e familia: fluxo pratico',
          'onboarding',
          ARRAY['company','family']::text[],
          ARRAY['cadastro empresa passo a passo','cadastro familia passo a passo','como iniciar conta de contratante']::text[],
          '1) Crie a conta de contratante e preencha dados de contexto. 2) Entre no Dashboard para organizar demanda. 3) Estruture criterios do caso e parta para busca de profissionais. 4) Registre andamento dos contatos no painel.',
          840,
          true
        ),
        (
          'Quando abrir chamado em vez de usar apenas o chatbot',
          'suporte',
          ARRAY['professional','company','family']::text[],
          ARRAY['quando abrir chamado','chatbot nao resolveu','suporte humano']::text[],
          '1) Use chatbot para duvidas de uso e fluxo. 2) Abra chamado quando houver erro tecnico, bloqueio de conta, pagamento com falha persistente ou divergencia de dados. 3) Informe passos, horario e evidencias para acelerar a analise.',
          850,
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
