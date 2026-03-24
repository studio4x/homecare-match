-- Seed Email Templates (Placeholders)
DO $$
DECLARE
  t1_id UUID := gen_random_uuid();
  t2_id UUID := gen_random_uuid();
  t3_id UUID := gen_random_uuid();
  t4_id UUID := gen_random_uuid();
  t5_id UUID := gen_random_uuid();
  t6_id UUID := gen_random_uuid();
  t7_id UUID := gen_random_uuid();
  t8_id UUID := gen_random_uuid();
  t9_id UUID := gen_random_uuid();
  flow_id UUID := gen_random_uuid();
BEGIN

INSERT INTO public.email_templates (id, name, slug, audience_type, subject, preview_text, html_content, text_content, email_type) VALUES
(t1_id, 'Boas-vindas', 'boas-vindas-prof', 'professional', 'Bem-vindo à HomeCare Match!', 'Tudo pronto para começar.', '<p>Olá! Bem-vindo à plataforma.</p>', 'Olá! Bem-vindo à plataforma.', 'onboarding'),
(t2_id, 'Complete seu perfil', 'complete-perfil-prof', 'professional', 'Seu perfil precisa de atenção', 'Aumente suas chances de contratação.', '<p>Preencha sua foto, bio e dados básicos.</p>', 'Preencha sua foto, bio e dados básicos.', 'onboarding'),
(t3_id, 'Valide seu e-mail', 'valide-email-prof', 'professional', 'Confirme seu endereço de e-mail', 'Apenas um clique para validar.', '<p>Por favor, valide o seu e-mail.</p>', 'Por favor, valide o seu e-mail.', 'onboarding'),
(t4_id, 'Envie documentos', 'envie-docs-prof', 'professional', 'Valide seu perfil enviando seus documentos', 'Segurança para você e para as famílias.', '<p>Envie sua documentação na plataforma.</p>', 'Envie sua documentação na plataforma.', 'onboarding'),
(t5_id, 'Como aumentar chances', 'aumentar-chances-prof', 'professional', 'Dicas para se destacar na HomeCare Match', 'Veja as melhores práticas.', '<p>Aqui estão dicas valiosas...</p>', 'Aqui estão dicas valiosas...', 'onboarding'),
(t6_id, 'Veja oportunidades', 'veja-oportunidades-prof', 'professional', 'Como a plataforma pode gerar oportunidades', 'Novas vagas diariamente.', '<p>Conheça o painel de oportunidades.</p>', 'Conheça o painel de oportunidades.', 'onboarding'),
(t7_id, 'Erros no perfil', 'erros-perfil-prof', 'professional', 'Evite estes erros comuns no seu perfil', 'Não perca contratos por bobeira.', '<p>Alguns erros afastam contratantes...</p>', 'Alguns erros afastam contratantes...', 'onboarding'),
(t8_id, 'Outros recursos', 'outros-recursos-prof', 'professional', 'Conheça outros recursos da plataforma', 'Muito mais que vagas.', '<p>Explore nossos cursos e fóruns.</p>', 'Explore nossos cursos e fóruns.', 'onboarding'),
(t9_id, 'Perfil pronto?', 'perfil-pronto-prof', 'professional', 'Seu perfil está pronto para gerar resultados?', 'Faça uma revisão final.', '<p>Revise suas informações para brilhar.</p>', 'Revise suas informações para brilhar.', 'onboarding');

-- Seed Flow
INSERT INTO public.onboarding_email_flows (id, name, audience_type, is_active) VALUES
(flow_id, 'Onboarding Profissionais (Padrão)', 'professional', true);

-- Seed Steps
INSERT INTO public.onboarding_email_steps (flow_id, template_id, step_order, wait_after_previous_hours, send_type, condition_type) VALUES
(flow_id, t1_id, 1, 0,  'always', null),
(flow_id, t2_id, 2, 24, 'conditional', 'profile_incomplete'),
(flow_id, t3_id, 3, 24, 'conditional', 'email_not_verified'),
(flow_id, t4_id, 4, 48, 'conditional', 'profile_not_validated'),
(flow_id, t5_id, 5, 48, 'always', null),
(flow_id, t6_id, 6, 48, 'always', null),
(flow_id, t7_id, 7, 48, 'conditional', 'professional_profile_not_ready'),
(flow_id, t8_id, 8, 72, 'always', null),
(flow_id, t9_id, 9, 72, 'conditional', 'professional_profile_not_ready');

END $$;
