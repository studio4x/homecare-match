-- Phase 2 Cleanup: Deactivate legacy templates, ensure official templates are active,
-- fix html_content formatting and confirm step-to-template bindings.

BEGIN;

-- ============================================================
-- 1. DESATIVAR TEMPLATES LEGADOS (Fase 1 / seed inicial)
-- ============================================================
UPDATE public.email_templates
SET is_active = false
WHERE slug IN (
  'boas-vindas-prof',
  'complete-perfil-prof',
  'valide-email-prof',
  'envie-docs-prof',
  'aumentar-chances-prof',
  'veja-oportunidades-prof',
  'erros-perfil-prof',
  'outros-recursos-prof',
  'perfil-pronto-prof'
);

-- ============================================================
-- 2. GARANTIR QUE OS 11 TEMPLATES OFICIAIS ESTÃO ATIVOS
-- ============================================================
UPDATE public.email_templates
SET is_active = true
WHERE slug IN (
  'onboarding-professional-welcome',
  'onboarding-professional-how-platform-works',
  'onboarding-professional-complete-profile',
  'onboarding-professional-verify-email',
  'onboarding-professional-validate-profile',
  'onboarding-professional-increase-visibility',
  'onboarding-professional-platform-opportunities',
  'onboarding-professional-courses',
  'onboarding-professional-profile-mistakes',
  'onboarding-professional-platform-resources',
  'onboarding-professional-final-profile-review'
);

-- ============================================================
-- 3. CORRIGIR HTML_CONTENT DOS 11 TEMPLATES OFICIAIS
--    Cada template receberá HTML bem formado com <p> e CTA: separado.
--    O motor em index.ts extrai CTA: via regex e gera o botão.
-- ============================================================

-- Template 1: Boas-vindas
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>Seja bem-vindo(a) à <strong>HomeCare Match</strong>.</p>

<p>Seu cadastro foi realizado com sucesso e, a partir de agora, você faz parte de uma plataforma criada para tornar mais organizada a conexão entre profissionais da saúde, empresas de home care e famílias.</p>

<p>A HomeCare Match nasceu com um propósito claro: ajudar a <strong>profissionalizar essa conexão</strong>. Nossa proposta é oferecer um ambiente confiável, organizado e profissional para que isso aconteça da melhor forma para todos os envolvidos.</p>

<p>Estar aqui não significa apenas "ter um cadastro" — significa construir uma presença profissional dentro de uma plataforma especializada no universo do home care.</p>

<p>Nos próximos dias, você vai receber orientações importantes para aproveitar melhor sua conta, fortalecer seu perfil e entender como aumentar suas chances de gerar visibilidade e oportunidades na plataforma.</p>

<p><strong>Nosso conselho inicial:</strong> entre na sua conta, conheça o ambiente e comece pelos pontos mais importantes do seu perfil. Quanto mais bem construída sua presença, maior será a percepção de confiança e profissionalismo.</p>

<p>Conte com a HomeCare Match nessa jornada.</p>

CTA:
Acessar minha conta'
WHERE slug = 'onboarding-professional-welcome';

-- Template 2: Como a plataforma funciona
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>Uma das dúvidas mais importantes para quem entra na HomeCare Match é: <strong>como a plataforma funciona, na prática, para o profissional?</strong></p>

<p>A lógica começa pela forma como você constrói o seu perfil. Quanto mais completo, claro e bem organizado ele estiver, melhor tende a ser a sua presença dentro da plataforma.</p>

<p>Empresas de home care e famílias têm acesso a uma área onde podem visualizar profissionais cadastrados. Os perfis são organizados com base em um conjunto de critérios que tornam a busca mais útil e relevante:</p>

<ul>
  <li>Consistência e qualidade geral do perfil</li>
  <li>Validação de documentos e do perfil</li>
  <li>Localização</li>
  <li>Cursos e certificações</li>
  <li>Pontuação de indicações</li>
  <li>Sinais de relevância dentro da plataforma</li>
</ul>

<p>Na prática, isso significa que sua posição na busca é construída pela <strong>combinação de elementos</strong> que fortalecem confiança, clareza e adequação ao contexto da pesquisa.</p>

<p>Por isso, estar na plataforma é importante, mas estar bem posicionado depende de como você constrói sua presença ao longo do tempo.</p>

CTA:
Ver como funciona a busca'
WHERE slug = 'onboarding-professional-how-platform-works';

-- Template 3: Complete seu perfil
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>Seu cadastro está criado — mas ainda há espaço para fortalecer sua presença na plataforma.</p>

<p>Um perfil completo transmite mais confiança para empresas e famílias que estão buscando profissionais. Cada informação que você preenche é uma oportunidade de se apresentar melhor.</p>

<p>Se ainda não fez, vale dedicar alguns minutos para:</p>

<ul>
  <li>Adicionar uma <strong>foto profissional</strong></li>
  <li>Preencher sua <strong>biografia</strong> de forma clara e objetiva</li>
  <li>Informar sua <strong>especialidade</strong> e áreas de atuação</li>
  <li>Indicar sua <strong>disponibilidade</strong> e valor por hora</li>
  <li>Adicionar sua <strong>localização</strong> completa</li>
</ul>

<p>Seu perfil atual está <strong>{{profile_completion}}</strong> completo. Quanto mais perto de 100%, melhor sua visibilidade na plataforma.</p>

CTA:
Completar meu perfil'
WHERE slug = 'onboarding-professional-complete-profile';

-- Template 4: Valide seu e-mail
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>Percebemos que o seu e-mail ainda não foi confirmado na plataforma.</p>

<p>A validação do e-mail é um passo importante: ela garante a segurança da sua conta e é necessária para que seu perfil fique visível nas buscas realizadas por empresas e famílias.</p>

<p>O processo é simples: basta acessar sua caixa de entrada, localizar o e-mail de confirmação da HomeCare Match e clicar no link de validação. Se não encontrar, verifique também a pasta de spam ou promoções.</p>

<p>Se precisar de um novo e-mail de confirmação, entre em contato com o nosso suporte.</p>

CTA:
Ir para minha conta'
WHERE slug = 'onboarding-professional-verify-email';

-- Template 5: Valide seu perfil
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>Você está no caminho certo — mas existe um passo que pode fazer diferença significativa na sua presença dentro da plataforma: <strong>a validação do seu perfil</strong>.</p>

<p>Perfis validados com documentação enviada transmitem mais segurança para empresas e famílias. Isso ajuda a construir um ambiente mais confiável para todos.</p>

<p>Para validar seu perfil, você precisará enviar:</p>

<ul>
  <li>Documento de identidade (RG ou CNH)</li>
  <li>Registro profissional (quando aplicável à sua área)</li>
</ul>

<p>O processo é rápido e toda a documentação é tratada com segurança e confidencialidade.</p>

CTA:
Validar meu perfil'
WHERE slug = 'onboarding-professional-validate-profile';

-- Template 6: Aumente sua visibilidade
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>Hoje queremos compartilhar algo prático: <strong>o que realmente influencia a visibilidade de um profissional dentro da HomeCare Match</strong>.</p>

<p>A plataforma considera uma série de fatores para organizar os perfis na busca. Em vez de uma fórmula única, o que importa é a construção consistente de uma presença sólida.</p>

<p>Alguns dos pontos que fazem diferença:</p>

<ul>
  <li><strong>Perfil completo e atualizado</strong> — foto, bio, especialidades, localização, disponibilidade</li>
  <li><strong>E-mail validado</strong> — sem isso, seu perfil não aparece nas buscas</li>
  <li><strong>Documentação enviada</strong> — requisito para o badge de perfil validado</li>
  <li><strong>Cursos realizados</strong> — demonstram atualização profissional</li>
  <li><strong>Indicações recebidas</strong> — constroem credibilidade ao longo do tempo</li>
</ul>

<p>Cada um desses elementos contribui de forma acumulativa. Não existe atalho, mas existe uma direção clara.</p>

CTA:
Fortalecer meu perfil'
WHERE slug = 'onboarding-professional-increase-visibility';

-- Template 7: Oportunidades na plataforma
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>A HomeCare Match não é apenas um cadastro. É um espaço onde <strong>empresas de home care e famílias buscam ativamente profissionais</strong> como você.</p>

<p>Todos os dias, pessoas que precisam de cuidados especializados acessam a plataforma procurando profissionais disponíveis na sua região, com o perfil adequado.</p>

<p>Para que você apareça nessas buscas, seu perfil precisa estar:</p>

<ul>
  <li>Completo e atualizado</li>
  <li>Com e-mail validado</li>
  <li>Com localização informada corretamente</li>
</ul>

<p>Se seu perfil já está em ordem, você pode estar perdendo oportunidades apenas por não saber que elas existem. Vale dar uma conferida no painel de buscas e ver o que está rolando.</p>

CTA:
Ver profissionais em destaque'
WHERE slug = 'onboarding-professional-platform-opportunities';

-- Template 8: Cursos e capacitação
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>Você sabia que a HomeCare Match oferece acesso a cursos e conteúdos de capacitação para profissionais da plataforma?</p>

<p>Os cursos disponíveis foram pensados para quem atua no universo do home care e quer se manter atualizado, qualificado e mais competitivo no mercado.</p>

<p>Alguns benefícios de concluir cursos na plataforma:</p>

<ul>
  <li>Demonstra atualização profissional para contratantes</li>
  <li>Fortalece seu perfil dentro da plataforma</li>
  <li>Amplia seu conhecimento em áreas práticas do home care</li>
</ul>

<p>Os cursos são acessíveis direto pelo seu painel, sem complicação.</p>

CTA:
Explorar cursos disponíveis'
WHERE slug = 'onboarding-professional-courses';

-- Template 9: Erros comuns no perfil
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>Alguns erros comuns no perfil podem reduzir — ou até eliminar — a visibilidade de um profissional dentro da plataforma. Vale conferir se algum deles se aplica ao seu caso.</p>

<p><strong>Os erros mais frequentes:</strong></p>

<ul>
  <li><strong>Foto ausente ou inadequada</strong> — perfis sem foto recebem menos atenção de contratantes</li>
  <li><strong>Bio genérica ou vazia</strong> — uma apresentação objetiva e clara faz diferença</li>
  <li><strong>Especialidade não informada</strong> — sem isso, seu perfil não aparece nas buscas filtradas</li>
  <li><strong>Localização incompleta</strong> — empresas e famílias buscam por região</li>
  <li><strong>E-mail não validado</strong> — seu perfil fica oculto até a validação</li>
  <li><strong>Documentação não enviada</strong> — sem o badge de validado, a confiança diminui</li>
</ul>

<p>Seu perfil está <strong>{{profile_completion}}</strong> completo. Se ainda há espaço para melhorar, agora é o momento.</p>

CTA:
Revisar e corrigir meu perfil'
WHERE slug = 'onboarding-professional-profile-mistakes';

-- Template 10: Recursos da plataforma
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>Além do perfil e das oportunidades de busca, a HomeCare Match oferece outros recursos que podem ser úteis para sua jornada como profissional.</p>

<p>Conheça algumas funcionalidades disponíveis no seu painel:</p>

<ul>
  <li><strong>Cursos e capacitações</strong> — conteúdo especializado em home care</li>
  <li><strong>Indicações</strong> — construa sua reputação por meio de avaliações de contratantes</li>
  <li><strong>Suporte</strong> — entre em contato com a equipe HomeCare Match sempre que precisar</li>
  <li><strong>Notificações</strong> — fique por dentro de novidades e atualizações da plataforma</li>
</ul>

<p>Explorar esses recursos pode contribuir para uma presença mais completa e ativa dentro da plataforma.</p>

CTA:
Acessar meu painel'
WHERE slug = 'onboarding-professional-platform-resources';

-- Template 11: Revisão final do perfil
UPDATE public.email_templates SET html_content =
'<p>Olá{{first_name ? '' '' + first_name : ''}},</p>

<p>Você chegou ao final da nossa sequência de orientações de onboarding. Este é um bom momento para fazer uma <strong>revisão final do seu perfil</strong> e garantir que tudo está em ordem.</p>

<p>Considere verificar os seguintes pontos:</p>

<ul>
  <li>Foto profissional adicionada</li>
  <li>Biografia clara e objetiva</li>
  <li>Especialidade e áreas de atuação informadas</li>
  <li>Localização completa e correta</li>
  <li>E-mail validado</li>
  <li>Documentação enviada para validação</li>
  <li>Disponibilidade e valor/hora preenchidos</li>
</ul>

<p>Seu perfil está <strong>{{profile_completion}}</strong> completo. Se ainda há itens em aberto, vale a pena dedicar alguns minutos para finalizá-los.</p>

<p>A HomeCare Match continua aqui para apoiar sua jornada. Em caso de dúvidas, entre em contato com nosso suporte.</p>

CTA:
Fazer revisão final do meu perfil'
WHERE slug = 'onboarding-professional-final-profile-review';

-- ============================================================
-- 4. VALIDAR QUE OS 11 PASSOS APONTAM PARA OS SLUGS CORRETOS
--    (Nenhuma action necessária — os steps foram recriados na migration da Fase 2
--     usando ON CONFLICT DO UPDATE, garantindo que apontam para os IDs corretos.
--     Esta query confirma o estado — se retornar 11 linhas, tudo está correto.)
-- ============================================================
DO $$
DECLARE
  step_count INT;
BEGIN
  SELECT COUNT(*) INTO step_count
  FROM public.onboarding_email_steps s
  JOIN public.email_templates t ON s.template_id = t.id
  JOIN public.onboarding_email_flows f ON s.flow_id = f.id
  WHERE f.audience_type = 'professional'
    AND f.is_active = true
    AND t.slug IN (
      'onboarding-professional-welcome',
      'onboarding-professional-how-platform-works',
      'onboarding-professional-complete-profile',
      'onboarding-professional-verify-email',
      'onboarding-professional-validate-profile',
      'onboarding-professional-increase-visibility',
      'onboarding-professional-platform-opportunities',
      'onboarding-professional-courses',
      'onboarding-professional-profile-mistakes',
      'onboarding-professional-platform-resources',
      'onboarding-professional-final-profile-review'
    )
    AND s.is_active = true;

  IF step_count < 11 THEN
    RAISE WARNING 'ATENCAO: apenas % dos 11 passos oficiais estão vinculados corretamente.', step_count;
  ELSE
    RAISE NOTICE 'OK: todos os 11 passos do fluxo oficial estão vinculados aos templates corretos.';
  END IF;
END $$;

COMMIT;
