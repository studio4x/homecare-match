-- Include subscription activity fields in the public discovery view so search can
-- filter out professionals without an active plan.

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
  trial_started_at
FROM public.profiles
WHERE role = 'professional'
  AND full_name IS NOT NULL
  AND email_confirmed = true;

GRANT SELECT ON public.professional_discovery TO authenticated;
GRANT SELECT ON public.professional_discovery TO anon;
