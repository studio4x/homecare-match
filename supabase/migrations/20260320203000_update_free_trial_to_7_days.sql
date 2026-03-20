-- Update default free-trial duration to 7 days.

UPDATE public.plans
SET
  period = '7 dias'
WHERE id = 'free_trial'
  AND COALESCE(TRIM(LOWER(period)), '') <> '7 dias';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'support_guides'
  ) THEN
    UPDATE public.support_guides
    SET content = '1) O cadastro padrao ativa periodo de teste gratis de 7 dias. 2) Durante o teste, o acesso e limitado em relacao aos planos pagos. 3) Se houver cupom valido no cadastro, prevalecem os dias configurados no cupom.'
    WHERE lower(trim(title)) = lower(trim('Teste gratis: duracao e limite de acesso'))
      AND lower(trim(module)) = 'trial';

    UPDATE public.support_guides
    SET content = replace(content, '30 dias de teste gratis', '7 dias de teste gratis')
    WHERE lower(trim(module)) = 'trial'
      AND content ILIKE '%30 dias de teste gratis%';
  END IF;
END
$$;
