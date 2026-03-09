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
