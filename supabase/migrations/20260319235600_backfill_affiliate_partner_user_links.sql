-- Backfill existing approved affiliate accounts created before role/link fixes.

WITH link_candidates AS (
  SELECT
    ap.id AS partner_id,
    p.id AS profile_id
  FROM public.affiliate_partners ap
  JOIN public.profiles p
    ON lower(btrim(COALESCE(ap.email, ''))) = lower(btrim(COALESCE(p.email, '')))
  WHERE ap.user_id IS NULL
    AND COALESCE(ap.email, '') <> ''
    AND COALESCE(p.is_admin, false) = false
)
UPDATE public.affiliate_partners ap
SET
  user_id = lc.profile_id,
  is_external = false,
  updated_at = now()
FROM link_candidates lc
WHERE ap.id = lc.partner_id;

UPDATE public.profiles p
SET
  role = 'affiliate',
  is_admin = false,
  subscription_tier = NULL,
  subscription_end_at = NULL,
  trial_started_at = NULL,
  coupon_days = NULL,
  cancel_at_period_end = false
FROM public.affiliate_partners ap
WHERE ap.user_id = p.id
  AND COALESCE(p.is_admin, false) = false;

NOTIFY pgrst, 'reload schema';
