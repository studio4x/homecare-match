-- Onboarding Phase 2: Professional Flow (11 Emails)

-- 1. Ensure the flow exists and get its ID
DO $$
DECLARE
  v_flow_id UUID;
BEGIN
  -- Get or create the flow
  SELECT id INTO v_flow_id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1;
  
  IF v_flow_id IS NULL THEN
    v_flow_id := gen_random_uuid();
    INSERT INTO public.onboarding_email_flows (id, name, audience_type, is_active)
    VALUES (v_flow_id, 'Onboarding Profissionais (Padrão)', 'professional', true);
  END IF;

  -- 2. Clean up existing steps for this flow to rebuild it
  DELETE FROM public.onboarding_email_steps WHERE flow_id = v_flow_id;

  -- 3. Upsert Templates and Insert Steps
  -- Template 1: Boas-vindas
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Boas-vindas à plataforma', 
    'onboarding-professional-welcome', 
    'professional', 
    'Bem-vindo(a) à HomeCare Match', 
    'Seu cadastro foi realizado. Agora é hora de começar da forma certa.',
    'Olá{{first_name ? '' '' + first_name : ''}},

Seja bem-vindo(a) à HomeCare Match.

Seu cadastro foi realizado com sucesso e, a partir de agora, você passa a fazer parte de uma plataforma criada para tornar mais organizada a conexão entre profissionais da saúde, empresas de home care e famílias.

A HomeCare Match nasceu com um propósito muito claro: ajudar a profissionalizar essa conexão.
Sabemos que, por muito tempo, muitas oportunidades e contatos no setor acabaram acontecendo de forma dispersa, informal e pouco estruturada. Nossa proposta é oferecer um ambiente mais confiável, mais organizado e mais profissional para que isso aconteça de forma melhor para todos os envolvidos.

Estar aqui não significa apenas “ter um cadastro”.
Significa construir uma presença profissional dentro de uma plataforma especializada no universo do home care.

Nos próximos dias, você vai receber algumas orientações importantes para aproveitar melhor sua conta, fortalecer seu perfil e entender como aumentar suas chances de gerar mais visibilidade e mais oportunidades dentro da plataforma.

Nosso conselho inicial é simples:
entre na sua conta, conheça o ambiente e comece pelos pontos mais importantes do seu perfil.

Quanto mais bem construída for sua presença na plataforma, maior tende a ser a percepção de confiança, organização e profissionalismo.

Conte com a HomeCare Match nessa jornada.

CTA:
Acessar minha conta',
    'Seja bem-vindo(a) à HomeCare Match...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    text_content = EXCLUDED.text_content,
    is_active = true;

  -- Step 1
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 1, 0, 'always'
  FROM public.email_templates WHERE slug = 'onboarding-professional-welcome';

  -- Template 2: Como a plataforma funciona
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Como a plataforma funciona na prática', 
    'onboarding-professional-how-platform-works', 
    'professional', 
    'Entenda como a HomeCare Match funciona na prática', 
    'Veja como seu perfil é exibido, como a busca funciona e como empresas e famílias podem entrar em contato com você.',
    'Olá{{first_name ? '' '' + first_name : ''}},

Uma das dúvidas mais importantes para quem entra na HomeCare Match é:
como a plataforma funciona, na prática, para o profissional?

A lógica começa pela forma como você constrói o seu perfil.
Quanto mais completo, claro, confiável e bem organizado ele estiver, melhor tende a ser a sua presença dentro da plataforma.

Empresas de home care e famílias têm acesso a uma área em que podem visualizar profissionais cadastrados.
Nessa página, os perfis são organizados considerando um conjunto de critérios que ajudam a tornar a busca mais útil, mais confiável e mais relevante.

Entre esses critérios, entram fatores como:
- consistência e qualidade geral do perfil
- validação de documentos e do perfil
- localização
- cursos
- pontuação de indicações
- sinais de relevância e contexto dentro da plataforma

Na prática, isso significa que a posição de um profissional na busca não depende de um único fator isolado.
Ella é construída pela combinação de elementos que ajudam a fortalecer confiança, clareza e adequação ao contexto da busca.

Por isso, estar na plataforma é importante, mas estar bem posicionado nela depende de como sua presença é construída ao longo do tempo.

Quando uma empresa ou família acessa o seu perfil, ela pode visualizar as informações que você cadastrou.
Se o seu perfil gerar interesse, você pode ser adicionado aos contatos.

Quando isso acontece, você recebe uma notificação informando que foi adicionado aos contatos de uma empresa ou família.

A partir daí, o contato entre as partes pode acontecer diretamente pelo WhatsApp:
- a empresa ou família pode enviar mensagem para você
- e você também pode iniciar uma conversa com a empresa ou família

Ou seja, a HomeCare Match ajuda a organizar e facilitar a conexão, enquanto a conversa acontece de forma direta no WhatsApp.

Esse é um dos motivos pelos quais vale a pena cuidar bem do seu perfil:
quanto mais forte for sua apresentação, maior tende a ser a qualidade da sua presença dentro da dinâmica da plataforma.

Nos próximos e-mails, vamos te mostrar como fortalecer exatamente esses pontos.

CTA:
Fortalecer meu perfil',
    'Entenda como a HomeCare Match funciona...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    is_active = true;

  -- Step 2
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 2, 24, 'always'
  FROM public.email_templates WHERE slug = 'onboarding-professional-how-platform-works';

  -- Template 3: Complete seu perfil
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Complete seu perfil profissional', 
    'onboarding-professional-complete-profile', 
    'professional', 
    'Complete seu perfil e fortaleça sua presença profissional', 
    'Um perfil bem preenchido transmite mais confiança e pode aumentar sua visibilidade na plataforma.',
    'Olá{{first_name ? '' '' + first_name : ''}},

Um dos pontos mais importantes dentro da HomeCare Match é a qualidade do seu perfil profissional.

Muitas vezes, quando um profissional cria uma conta em uma plataforma, ele acaba preenchendo apenas o básico e deixa os detalhes para depois. O problema é que, na prática, essas informações fazem diferença na forma como seu perfil é percebido.

Um perfil mais completo ajuda a transmitir:
- mais profissionalismo
- mais clareza sobre quem você é
- mais confiança para quem avalia seu perfil
- mais organização na sua apresentação

Na HomeCare Match, seu perfil não é apenas um cadastro técnico.
Ele funciona como uma vitrine profissional dentro de um ambiente especializado.

Por isso, vale dedicar alguns minutos para revisar e completar informações importantes, como sua apresentação, área de atuação, especialidades, localização e outros dados relevantes do seu perfil.

Quando essas informações estão bem organizadas, sua presença na plataforma fica mais forte e mais confiável.

Mais do que “preencher campos”, trata-se de mostrar melhor seu valor profissional.

Se ainda existir alguma pendência no seu perfil, este é um ótimo momento para concluir essa etapa.

CTA:
Completar meu perfil',
    'Complete seu perfil e fortaleça sua presença...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    is_active = true;

  -- Step 3
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type, condition_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 3, 24, 'conditional', 'profile_incomplete'
  FROM public.email_templates WHERE slug = 'onboarding-professional-complete-profile';

  -- Template 4: Valide seu e-mail
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Valide seu e-mail', 
    'onboarding-professional-verify-email', 
    'professional', 
    'Valide seu e-mail para manter sua conta segura', 
    'Essa etapa ajuda a proteger seu acesso e garante o recebimento de comunicações importantes.',
    'Olá{{first_name ? '' '' + first_name : ''}},

Percebemos que seu e-mail ainda não foi validado.

Essa pode parecer uma etapa simples, mas ela é muito importante para a segurança e para o bom funcionamento da sua conta dentro da HomeCare Match.

A validação do e-mail ajuda a:
- confirmar que o endereço informado está correto
- proteger melhor seu acesso
- permitir o recebimento de comunicações importantes da plataforma
- facilitar processos futuros, como recuperação de acesso e confirmações de segurança

Além disso, contas com informações devidamente confirmadas transmitem mais consistência dentro do ecossistema da plataforma.

Na prática, validar o e-mail é uma ação rápida que ajuda a manter sua conta mais segura, mais confiável e pronta para receber nossos comunicados sempre que necessário.

Se você ainda não concluiu essa etapa, recomendamos fazer isso agora.

CTA:
Validar meu e-mail',
    'Valide seu e-mail para manter sua conta segura...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    is_active = true;

  -- Step 4
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type, condition_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 4, 24, 'conditional', 'email_not_verified'
  FROM public.email_templates WHERE slug = 'onboarding-professional-verify-email';

  -- Template 5: Valide com documentos
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Valide seu perfil com documentos', 
    'onboarding-professional-validate-profile', 
    'professional', 
    'Valide seu perfil e transmita mais confiança na plataforma', 
    'Perfis validados fortalecem sua credibilidade e ajudam a gerar mais confiança.',
    'Olá{{first_name ? '' '' + first_name : ''}},

Na HomeCare Match, a confiança é uma parte essencial da experiência.

Por isso, a validação do perfil profissional tem um papel importante dentro da plataforma.

Quando um profissional envia seus documentos e conclui essa etapa de validação, ele fortalece a credibilidade do próprio perfil e ajuda a construir um ambiente mais seguro e mais confiável para todos.

Isso é importante porque, dentro do setor de home care, confiança, clareza e segurança fazem muita diferença.
Tanto empresas quanto famílias tendem a se sentir mais seguras quando percebem que existe um cuidado maior com a qualidade e a validação das informações.

A validação do perfil não é apenas uma exigência operacional.
Ella é uma forma de reforçar a sua presença profissional dentro da plataforma e mostrar que seu perfil está mais preparado para gerar conexões com mais credibilidade.

Se essa etapa ainda estiver pendente, recomendamos concluí-la assim que possível.

Quanto mais completo e validado estiver seu perfil, mais forte tende a ser a percepção de confiança sobre ele.

CTA:
Enviar documentos',
    'Valide seu perfil e transmita mais confiança...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    is_active = true;

  -- Step 5
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type, condition_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 5, 48, 'conditional', 'profile_not_validated'
  FROM public.email_templates WHERE slug = 'onboarding-professional-validate-profile';

  -- Template 6: Como aumentar chances
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Como aumentar suas chances de ser encontrado', 
    'onboarding-professional-increase-visibility', 
    'professional', 
    'Como aumentar suas chances de ser encontrado na HomeCare Match', 
    'Alguns ajustes simples podem fortalecer muito a forma como seu perfil é percebido.',
    'Olá{{first_name ? '' '' + first_name : ''}},

Ter um perfil na plataforma é um ótimo começo.
Mas, para gerar uma presença realmente forte, alguns detalhes fazem diferença.

Na prática, perfis mais bem organizados costumam transmitir mais confiança e mais clareza.
E isso influencia diretamente a forma como empresas e famílias percebem o profissional.

Aqui vão alguns pontos que ajudam bastante:

1. Mantenha suas informações completas e atualizadas  
Dados claros e atualizados tornam seu perfil mais confiável e mais fácil de entender.

2. Cuide da sua apresentação profissional  
Uma descrição objetiva, bem escrita e coerente ajuda a mostrar melhor sua experiência e seu posicionamento.

3. Destaque suas especialidades e áreas de atuação  
Ella facilita a identificação do seu perfil dentro do contexto certo.

4. Evite deixar campos importantes em branco  
Perfis incompletos passam uma sensação de desorganização, mesmo quando o profissional é qualificado.

5. Revise seu perfil com olhar estratégico  
Pergunte a si mesmo: “se eu estivesse vendo este perfil pela primeira vez, ele me transmitiria confiança?”

Na HomeCare Match, a forma como você se apresenta importa.
Porque seu perfil é, na prática, uma representação profissional sua dentro da plataforma.

Se quiser fortalecer essa presença, este é um bom momento para revisar seu perfil com mais atenção.

CTA:
Melhorar meu perfil',
    'Como aumentar suas chances de ser encontrado...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    is_active = true;

  -- Step 6
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 6, 48, 'always'
  FROM public.email_templates WHERE slug = 'onboarding-professional-increase-visibility';

  -- Template 7: Como a plataforma pode gerar oportunidades
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Como a plataforma pode gerar oportunidades', 
    'onboarding-professional-platform-opportunities', 
    'professional', 
    'Veja como a HomeCare Match pode gerar oportunidades para você', 
    'Entenda melhor o papel da plataforma e por que vale a pena construir sua presença aqui.',
    'Olá{{first_name ? '' '' + first_name : ''}},

A HomeCare Match foi criada para ajudar a tornar mais eficiente, organizada e profissional a conexão entre quem busca e quem oferece cuidado no contexto do home care.

Isso significa que a plataforma não foi pensada apenas como um cadastro isolado.
Ella foi pensada como um ambiente especializado, no qual profissionais da saúde podem construir presença, visibilidade e credibilidade dentro de um ecossistema voltado a esse setor.

Ao participar da HomeCare Match, você passa a estar em uma plataforma que busca aproximar:
- profissionais da saúde
- empresas de home care
- famílias que buscam atendimento domiciliar

Esse modelo ajuda a dar mais estrutura para conexões que, em muitos casos, historicamente aconteceram de forma mais dispersa e menos organizada.

Estar presente desde cedo, com um perfil bem construído, é uma forma de se posicionar melhor dentro desse ambiente.

Nosso papel é oferecer uma plataforma séria, especializada e preparada para fortalecer essa conexão.
O seu papel é aproveitar esse espaço da melhor forma possível, construindo uma presença profissional consistente.

Quanto mais bem preparada estiver sua conta, maior tende a ser o valor da sua presença dentro da HomeCare Match.

CTA:
Explorar a plataforma',
    'Veja como a HomeCare Match pode gerar oportunidades...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    is_active = true;

  -- Step 7
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 7, 48, 'always'
  FROM public.email_templates WHERE slug = 'onboarding-professional-platform-opportunities';

  -- Template 8: Cursos
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Conheça os cursos disponíveis na plataforma', 
    'onboarding-professional-courses', 
    'professional', 
    'Conheça os cursos disponíveis na HomeCare Match', 
    'A plataforma também oferece cursos que podem apoiar sua jornada profissional.',
    'Olá{{first_name ? '' '' + first_name : ''}},

Além de ajudar a organizar a conexão entre profissionais, empresas e famílias, a HomeCare Match também busca gerar valor por meio de recursos que apoiam sua jornada profissional.

Entre esses recursos, os cursos disponíveis na plataforma têm um papel importante.

A proposta aqui não é apenas reunir cadastros.
É construir um ambiente que também contribua para o desenvolvimento, a qualificação e o fortalecimento da presença profissional dentro do setor de home care.

Dependendo da sua fase profissional, ter acesso a conteúdos e cursos relevantes pode ajudar você a:
- ampliar repertório
- fortalecer sua atuação
- evoluir profissionalmente
- se posicionar melhor
- aproveitar melhor os recursos da própria plataforma

Esse é um ponto importante porque profissionais que enxergam a plataforma de forma mais ampla tendem a aproveitar melhor tudo o que ella pode oferecer.

Por isso, vale a pena conhecer os cursos já disponíveis e acompanhar esse lado da HomeCare Match com atenção.

Mais do que uma plataforma de presença profissional, queremos construir um ambiente cada vez mais útil para quem atua ou deseja crescer no universo do home care.

CTA:
Ver cursos disponíveis',
    'Conheça os cursos disponíveis na HomeCare Match...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    is_active = true;

  -- Step 8
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 8, 48, 'always'
  FROM public.email_templates WHERE slug = 'onboarding-professional-courses';

  -- Template 9: Erros no perfil
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Erros que podem enfraquecer seu perfil', 
    'onboarding-professional-profile-mistakes', 
    'professional', 
    'Alguns detalhes podem estar enfraquecendo seu perfil', 
    'Pequenas pendências podem impactar a forma como seu perfil transmite confiança e profissionalismo.',
    'Olá{{first_name ? '' '' + first_name : ''}},

Nem sempre um perfil deixa de gerar boa percepção por falta de qualificação.
Muitas vezes, isso acontece por detalhes simples que enfraquecem a apresentação.

Entre os pontos mais comuns, estão:
- informações incompletas
- ausência de foto ou apresentação profissional
- campos importantes em branco
- dados pouco claros
- pendências de validação
- falta de organização na forma como o perfil é apresentado

O problema desses detalhes é que eles podem reduzir a força da sua presença dentro da plataforma, mesmo quando você tem experiência e capacidade profissional.

Em outras palavras:
às vezes, o que está faltando não é competência.
É apenas uma apresentação mais completa, mais clara e mais confiável.

Por isso, vale fazer uma revisão com calma e identificar o que ainda pode ser melhorado.

Na HomeCare Match, um perfil mais bem construído tende a transmitir mais segurança, mais profissionalismo e mais consistência.

Se ainda existir alguma pendência, este é um bom momento para corrigir e fortalecer sua presença na plataforma.

CTA:
Corrigir meu perfil',
    'Alguns detalhes podem estar enfraquecendo seu perfil...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    is_active = true;

  -- Step 9
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type, condition_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 9, 48, 'conditional', 'professional_profile_not_ready'
  FROM public.email_templates WHERE slug = 'onboarding-professional-profile-mistakes';

  -- Template 10: Outros recursos
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Conheça outros recursos da plataforma', 
    'onboarding-professional-platform-resources', 
    'professional', 
    'Conheça outros recursos da HomeCare Match', 
    'A plataforma vai além do cadastro profissional e reúne recursos que podem apoiar sua jornada.',
    'Olá{{first_name ? '' '' + first_name : ''}},

A HomeCare Match não foi pensada apenas para reunir perfis.

Nosso objetivo é construir uma plataforma cada vez mais útil, especializada e relevante para o setor de home care.
Por isso, além do seu perfil profissional, você também pode encontrar outros recursos que fortalecem sua experiência dentro da plataforma.

Entre esses recursos, podem estar funcionalidades, conteúdos e materiais pensados para apoiar sua jornada e ampliar o valor da sua presença aqui.

Também trabalhamos para que a plataforma se torne, cada vez mais, um ambiente que combine:
- visibilidade profissional
- organização
- praticidade
- especialização no nicho de home care
- recursos complementares relevantes para o profissional

Quanto mais você conhece a plataforma, mais você entende seu potencial.

Nosso convite é simples:
não veja a HomeCare Match apenas como um cadastro.
Veja como um ambiente em desenvolvimento, criado para fortalecer conexões e construir um ecossistema mais profissional dentro do home care.

CTA:
Conhecer recursos',
    'Conheça outros recursos da HomeCare Match...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    is_active = true;

  -- Step 10
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 10, 72, 'always'
  FROM public.email_templates WHERE slug = 'onboarding-professional-platform-resources';

  -- Template 11: Revisão final
  INSERT INTO public.email_templates (name, slug, audience_type, subject, preview_text, html_content, text_content, is_active, email_type)
  VALUES (
    'Seu perfil está pronto para gerar mais resultados', 
    'onboarding-professional-final-profile-review', 
    'professional', 
    'Seu perfil está pronto para gerar mais resultados?', 
    'Talvez este seja o momento certo para fazer uma última revisão e fortalecer sua presença na plataforma.',
    'Olá{{first_name ? '' '' + first_name : ''}},

Ao longo dos últimos dias, compartilhamos com você alguns pontos importantes para ajudar a construir uma presença mais forte dentro da HomeCare Match.

Agora vale fazer uma pergunta simples:
seu perfil já transmite, de forma clara, a qualidade e o profissionalismo que você deseja comunicar?

Essa revisão final é importante porque, muitas vezes, pequenas melhorias fazem uma diferença grande na forma como seu perfil é percebido.

Vale observar, por exemplo:
- se seus dados principais estão completos
- se sua apresentação está clara
- se suas especialidades estão bem informadas
- se seu perfil já transmite confiança
- se as validações importantes já foram concluídas

A ideia não é apenas “finalizar cadastro”.
A ideia é deixar seu perfil realmente pronto para representar você bem dentro da plataforma.

Na HomeCare Match, acreditamos que presença profissional bem construída gera mais confiança, mais clareza e mais potencial de conexão.

Se ainda existir algo para ajustar, este pode ser o melhor momento para fazer isso.

CTA:
Revisar meu perfil agora',
    'Seu perfil está pronto para gerar mais resultados?...',
    true,
    'onboarding'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    preview_text = EXCLUDED.preview_text,
    html_content = EXCLUDED.html_content,
    is_active = true;

  -- Step 11
  INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type, condition_type)
  SELECT (SELECT id FROM public.onboarding_email_flows WHERE audience_type = 'professional' LIMIT 1), id, 11, 72, 'conditional', 'professional_profile_not_ready'
  FROM public.email_templates WHERE slug = 'onboarding-professional-final-profile-review';

END $$;
