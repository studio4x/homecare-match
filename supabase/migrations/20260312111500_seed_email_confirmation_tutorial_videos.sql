DO $$
BEGIN
  IF to_regclass('public.feature_videos') IS NOT NULL THEN
    INSERT INTO public.feature_videos (feature_key, title)
    VALUES
      ('email-confirmed-professional-step-1', 'Profissional - Etapa 1'),
      ('email-confirmed-professional-step-2', 'Profissional - Etapa 2'),
      ('email-confirmed-professional-step-3', 'Profissional - Etapa 3'),
      ('email-confirmed-company-step-1', 'Empresa - Etapa 1'),
      ('email-confirmed-company-step-2', 'Empresa - Etapa 2'),
      ('email-confirmed-company-step-3', 'Empresa - Etapa 3'),
      ('email-confirmed-company-step-4', 'Empresa - Etapa 4'),
      ('email-confirmed-family-step-1', 'Familia - Etapa 1'),
      ('email-confirmed-family-step-2', 'Familia - Etapa 2'),
      ('email-confirmed-family-step-3', 'Familia - Etapa 3'),
      ('email-confirmed-family-step-4', 'Familia - Etapa 4')
    ON CONFLICT (feature_key) DO UPDATE
    SET
      title = EXCLUDED.title,
      updated_at = NOW();
  END IF;
END
$$;

