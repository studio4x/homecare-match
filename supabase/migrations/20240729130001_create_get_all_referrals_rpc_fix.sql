CREATE OR REPLACE FUNCTION public.get_all_referrals_with_details()
RETURNS TABLE (
    id UUID,
    referrer_id UUID,
    referred_name TEXT,
    referred_phone TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    referrer_full_name TEXT,
    referrer_email TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    r.id,
    r.referrer_id,
    r.referred_name,
    r.referred_phone,
    r.status,
    r.created_at,
    p.full_name AS referrer_full_name,
    p.email AS referrer_email
  FROM
    public.referrals r
  JOIN
    public.profiles p ON r.referrer_id = p.id
  ORDER BY
    r.created_at DESC;
$$;