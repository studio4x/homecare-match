UPDATE public.support_faqs
SET category = CASE lower(trim(category))
  WHEN 'academy' THEN 'CAPACITAÇÃO E ACADEMY'
  WHEN 'app' THEN 'CADASTRO E ACESSO À CONTA'
  WHEN 'assinatura' THEN 'ASSINATURAS E PAGAMENTOS'
  WHEN 'busca' THEN 'CONTATOS E INTERAÇÕES'
  WHEN 'cadastro e acesso' THEN 'CADASTRO E ACESSO À CONTA'
  WHEN 'concierge' THEN 'SEGURANÇA E SUPORTE'
  WHEN 'conta' THEN 'CADASTRO E ACESSO À CONTA'
  WHEN 'empresa' THEN 'PARA EMPRESAS DE HOME CARE'
  WHEN 'indicacoes' THEN 'PARA PROFISSIONAIS DE SAÚDE'
  WHEN 'perfil' THEN 'PARA PROFISSIONAIS DE SAÚDE'
  WHEN 'qualidade' THEN 'SEGURANÇA E SUPORTE'
  WHEN 'seguranca' THEN 'VERIFICAÇÃO DE PERFIL E SEGURANÇA'
  WHEN 'suporte' THEN 'SEGURANÇA E SUPORTE'
  ELSE category
END
WHERE lower(trim(category)) IN (
  'academy',
  'app',
  'assinatura',
  'busca',
  'cadastro e acesso',
  'concierge',
  'conta',
  'empresa',
  'indicacoes',
  'perfil',
  'qualidade',
  'seguranca',
  'suporte'
);
