WITH target_faq AS (
  SELECT id
  FROM public.support_faqs
  WHERE lower(trim(question)) = lower(trim('Como realizar o cadastro na plataforma e validar meu e-mail?'))
  ORDER BY created_at ASC
  LIMIT 1
),
updated AS (
  UPDATE public.support_faqs
  SET
    answer = 'Confira o tutorial correspondente ao seu perfil para concluir cadastro e validacao de e-mail.',
    category = 'Cadastro e Acesso',
    is_published = true
  WHERE id IN (SELECT id FROM target_faq)
  RETURNING id
)
INSERT INTO public.support_faqs (question, answer, category, position, is_published)
SELECT
  'Como realizar o cadastro na plataforma e validar meu e-mail?',
  'Confira o tutorial correspondente ao seu perfil para concluir cadastro e validacao de e-mail.',
  'Cadastro e Acesso',
  COALESCE((SELECT MAX(position) FROM public.support_faqs), 0) + 10,
  true
WHERE NOT EXISTS (SELECT 1 FROM updated);
