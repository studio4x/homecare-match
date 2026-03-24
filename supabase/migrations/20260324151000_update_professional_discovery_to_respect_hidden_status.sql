-- Atualiza a view de descoberta profissional para ocultar usuários marcados como ocultos pelo admin
DROP VIEW IF EXISTS public.professional_discovery;

CREATE VIEW public.professional_discovery AS
SELECT
  id,
  full_name,
  avatar_url,
  specialty,
  city,
  state,
  neighborhood,
  experience,
  professional_experiences,
  bio,
  is_verified,
  subscription_tier,
  subscription_end_at,
  cancel_at_period_end,
  role,
  lat,
  lng,
  referral_count,
  updated_at,
  trial_started_at,
  is_hidden
FROM public.profiles
WHERE role = 'professional'
  AND full_name IS NOT NULL
  AND email_confirmed = true
  AND is_hidden = false; -- EXCLUSÃO DE USUÁRIOS OCULTOS

GRANT SELECT ON public.professional_discovery TO authenticated;
GRANT SELECT ON public.professional_discovery TO anon;
