CREATE OR REPLACE FUNCTION get_all_referrals_with_details()
RETURNS TABLE (
  id uuid,
  referrer_id uuid,
  referred_name text,
  referred_phone text,
  status text,
  created_at timestamptz,
  referrer_full_name text,
  referrer_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Usar a função de verificação de admin mais abrangente
  IF NOT check_is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: Apenas administradores podem executar esta função.';
  END IF;

  -- Se for admin, retorna os dados com o join.
  RETURN QUERY
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
    public.referrals AS r
  LEFT JOIN
    public.profiles AS p ON r.referrer_id = p.id
  ORDER BY
    r.created_at DESC;
END;
$$;