WITH faq_seed AS (
  SELECT *
  FROM (
    VALUES
      (
        'Como encontro profissionais na minha regiao?',
        'Acesse /buscar e use os filtros de cidade, bairro, especialidade e disponibilidade. Depois abra o perfil do profissional para validar experiencia, formacoes e historico.',
        'busca',
        10,
        true
      ),
      (
        'Como falo com um profissional?',
        'Quando um perfil estiver adequado, use o botao de contato no resultado da busca. O contato segue para WhatsApp quando disponivel e fica registrado em /dashboard/contatos para acompanhamento.',
        'busca',
        20,
        true
      ),
      (
        'O que significa o selo de verificacao profissional?',
        'O selo indica que os documentos enviados passaram por analise manual da plataforma. Ainda assim, recomendamos entrevista e validacao final pela empresa ou familia contratante.',
        'seguranca',
        30,
        true
      ),
      (
        'Como atualizo meu perfil profissional?',
        'No painel, entre em /dashboard/perfil e atualize bio, experiencias, formacoes e dados de contato. Perfil completo melhora relevancia na busca.',
        'perfil',
        40,
        true
      ),
      (
        'Como gerar biografia com IA?',
        'No perfil profissional, use a acao de gerar bio com IA e revise o texto antes de salvar. Ajuste para manter tom profissional e informacoes reais.',
        'perfil',
        50,
        true
      ),
      (
        'Como funcionam planos e destaque premium?',
        'Planos ativos podem melhorar prioridade de exibicao na busca. Verifique opcoes, status e historico de cobranca em /dashboard/pagamentos.',
        'assinatura',
        60,
        true
      ),
      (
        'Onde vejo faturas e pagamentos?',
        'Acesse /dashboard/pagamentos para acompanhar status de cobranca, historico e detalhes da assinatura.',
        'assinatura',
        70,
        true
      ),
      (
        'Como recuperar minha senha?',
        'Na tela /login, escolha a opcao de recuperar senha. Voce recebera o link para redefinicao em /redefinir-senha.',
        'conta',
        80,
        true
      ),
      (
        'Como abrir chamado de suporte?',
        'Usuario logado: abra /dashboard/suporte e clique em Novo chamado. Descreva o problema com contexto, prints e objetivo esperado.',
        'suporte',
        90,
        true
      ),
      (
        'Como acompanho um chamado de suporte?',
        'No painel em /dashboard/suporte, abra o ticket para ver mensagens, status e atualizacoes. Responda no mesmo chamado para manter historico.',
        'suporte',
        100,
        true
      ),
      (
        'Como funcionam cursos da Academy?',
        'No painel em /dashboard/cursos, selecione um curso, conclua os modulos e acompanhe progresso. Quando aplicavel, o certificado fica disponivel ao final.',
        'academy',
        110,
        true
      ),
      (
        'Como validar um certificado publico?',
        'Use a pagina /validar para conferir autenticidade de certificados emitidos pela plataforma.',
        'academy',
        120,
        true
      ),
      (
        'Como funciona o programa de indicacoes?',
        'Profissionais podem indicar colegas e acompanhar resultados em /dashboard/indicacoes. O impacto depende das regras vigentes de visibilidade e campanha.',
        'indicacoes',
        130,
        true
      ),
      (
        'Sou empresa: como cadastro pacientes?',
        'Empresas podem organizar pacientes em /dashboard/pacientes para estruturar demandas e facilitar recrutamento.',
        'empresa',
        140,
        true
      ),
      (
        'Como usar avaliacoes da plataforma?',
        'Avaliacoes ajudam na tomada de decisao e aparecem no contexto de perfil/interacoes. Use junto com analise de experiencia e entrevista.',
        'qualidade',
        150,
        true
      ),
      (
        'Como instalar o app da plataforma no celular?',
        'Abra o site no navegador mobile e use a opcao de instalar app (PWA). O acesso rapido fica disponivel na tela inicial do aparelho.',
        'app',
        160,
        true
      ),
      (
        'Como denunciar comportamento inadequado?',
        'Use os recursos de report/denuncia disponiveis no fluxo da plataforma e informe detalhes objetivos. Casos sensiveis podem ser acompanhados pelo suporte.',
        'seguranca',
        170,
        true
      ),
      (
        'Quando devo usar concierge?',
        'Use o concierge para cenario urgente ou quando precisar de apoio manual para encontrar profissional aderente ao perfil buscado.',
        'concierge',
        180,
        true
      )
  ) AS t(question, answer, category, position, is_published)
),
faq_insert AS (
  INSERT INTO public.support_faqs (question, answer, category, position, is_published)
  SELECT s.question, s.answer, s.category, s.position, s.is_published
  FROM faq_seed s
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.support_faqs f
    WHERE lower(trim(f.question)) = lower(trim(s.question))
  )
  RETURNING id
),
guide_seed AS (
  SELECT *
  FROM (
    VALUES
      (
        'Como abrir e acompanhar chamado de suporte',
        'suporte',
        ARRAY['professional','company','family']::text[],
        ARRAY['como abrir chamado','como criar ticket','como falar com suporte','acompanhar ticket']::text[],
        '1) Acesse /dashboard/suporte. 2) Clique em novo chamado e descreva o problema com contexto, passos e resultado esperado. 3) Envie anexos quando necessario. 4) Monitore respostas no mesmo ticket para manter historico unico.',
        10,
        true
      ),
      (
        'Como buscar profissionais com filtros',
        'busca',
        ARRAY['company','family']::text[],
        ARRAY['buscar profissional','filtrar por cidade','filtrar por especialidade','encontrar cuidador']::text[],
        '1) Entre em /buscar. 2) Aplique filtros de localizacao, especialidade e disponibilidade. 3) Abra os perfis mais aderentes para comparar experiencia e formacao. 4) Inicie contato com os melhores candidatos.',
        20,
        true
      ),
      (
        'Como iniciar contato e organizar retornos',
        'contatos',
        ARRAY['company','family']::text[],
        ARRAY['falar no whatsapp','iniciar contato','historico de contatos']::text[],
        '1) No resultado da busca, clique em contato. 2) Siga para WhatsApp quando disponivel. 3) Registre andamento e retorno em /dashboard/contatos para nao perder contexto.',
        30,
        true
      ),
      (
        'Como completar perfil profissional para ganhar relevancia',
        'perfil',
        ARRAY['professional']::text[],
        ARRAY['melhorar perfil','aumentar visibilidade','editar perfil profissional']::text[],
        '1) Acesse /dashboard/perfil. 2) Preencha bio, experiencias, cursos e dados de contato. 3) Revise clareza e coerencia das informacoes. 4) Atualize periodicamente para manter perfil competitivo.',
        40,
        true
      ),
      (
        'Como gerar e revisar biografia com IA',
        'perfil',
        ARRAY['professional']::text[],
        ARRAY['gerar bio com ia','biografia automatica','texto do perfil']::text[],
        '1) No perfil, use a opcao de gerar biografia com IA. 2) Revise o texto para refletir experiencia real. 3) Ajuste termos tecnicos e tom de comunicacao. 4) Salve a versao final.',
        50,
        true
      ),
      (
        'Como gerenciar assinatura e pagamentos',
        'assinatura',
        ARRAY['professional']::text[],
        ARRAY['status da assinatura','faturas','pagamentos','plano premium']::text[],
        '1) Abra /dashboard/pagamentos. 2) Confira status da assinatura e historico de cobranca. 3) Corrija pendencias rapidamente para evitar impacto de visibilidade.',
        60,
        true
      ),
      (
        'Como fazer cursos na Academy e emitir certificado',
        'academy',
        ARRAY['professional']::text[],
        ARRAY['academy','curso','certificado','progresso do curso']::text[],
        '1) Acesse /dashboard/cursos. 2) Escolha o curso e conclua os modulos. 3) Acompanhe progresso. 4) Ao finalizar, consulte o certificado quando disponivel.',
        70,
        true
      ),
      (
        'Como validar certificado pela pagina publica',
        'academy',
        ARRAY['professional','company','family']::text[],
        ARRAY['validar certificado','autenticidade certificado','confirmar curso']::text[],
        '1) Entre em /validar. 2) Informe os dados solicitados no certificado. 3) Confira o resultado de autenticidade exibido pela plataforma.',
        80,
        true
      ),
      (
        'Como cadastrar pacientes no painel de empresa',
        'empresa',
        ARRAY['company']::text[],
        ARRAY['cadastro de pacientes','painel de pacientes','organizar demandas']::text[],
        '1) Acesse /dashboard/pacientes. 2) Cadastre os dados necessarios de cada caso. 3) Mantenha informacoes atualizadas para agilizar recrutamento e acompanhamento.',
        90,
        true
      ),
      (
        'Como operar o programa de indicacoes',
        'indicacoes',
        ARRAY['professional']::text[],
        ARRAY['indicar colega','link de indicacao','acompanhar indicacoes']::text[],
        '1) Abra /dashboard/indicacoes. 2) Compartilhe seu link conforme regras vigentes. 3) Acompanhe evolucao dos indicados e resultados da campanha.',
        100,
        true
      ),
      (
        'Como instalar o app (PWA) no celular',
        'app',
        ARRAY['professional','company','family']::text[],
        ARRAY['instalar app','adicionar na tela inicial','pwa']::text[],
        '1) Acesse o site pelo navegador do celular. 2) Use a opcao de instalar/adicionar a tela inicial. 3) Abra pelo icone para acesso rapido.',
        110,
        true
      ),
      (
        'Como recuperar acesso da conta',
        'conta',
        ARRAY['professional','company','family']::text[],
        ARRAY['esqueci senha','redefinir senha','nao consigo entrar']::text[],
        '1) Va para /login e use recuperar senha. 2) Abra o link enviado para seu e-mail. 3) Defina nova senha e volte ao painel.',
        120,
        true
      )
  ) AS t(title, module, audience, question_variants, content, position, is_published)
)
INSERT INTO public.support_guides (title, module, audience, question_variants, content, position, is_published)
SELECT s.title, s.module, s.audience, s.question_variants, s.content, s.position, s.is_published
FROM guide_seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.support_guides g
  WHERE lower(trim(g.title)) = lower(trim(s.title))
    AND lower(trim(g.module)) = lower(trim(s.module))
);
