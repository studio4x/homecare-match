-- Remove a função antiga para limpar, se possível
DROP FUNCTION IF EXISTS public.get_all_referrals_with_details();

-- Cria a nova função retornando JSON diretamente
CREATE OR REPLACE FUNCTION public.get_referrals_json()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(json_agg(t), '[]'::json)
  FROM (
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
      r.created_at DESC
  ) t;
$$;

-- Concede permissão de execução
GRANT EXECUTE ON FUNCTION public.get_referrals_json() TO authenticated;

-- Tenta forçar recarregamento do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';