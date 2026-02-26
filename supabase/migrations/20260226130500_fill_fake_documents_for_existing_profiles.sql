CREATE OR REPLACE FUNCTION public._generate_fake_cpf(seed bigint)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_num bigint;
  base text;
  i int;
  sum_value int;
  digit int;
  d1 int;
  d2 int;
BEGIN
  base_num := abs(seed) % 1000000000;
  base := lpad(base_num::text, 9, '0');

  WHILE base ~ '^([0-9])\1+$' LOOP
    base_num := (base_num + 1234567) % 1000000000;
    base := lpad(base_num::text, 9, '0');
  END LOOP;

  sum_value := 0;
  FOR i IN 1..9 LOOP
    digit := substr(base, i, 1)::int;
    sum_value := sum_value + (digit * (11 - i));
  END LOOP;

  d1 := 11 - (sum_value % 11);
  IF d1 >= 10 THEN d1 := 0; END IF;

  sum_value := 0;
  FOR i IN 1..9 LOOP
    digit := substr(base, i, 1)::int;
    sum_value := sum_value + (digit * (12 - i));
  END LOOP;
  sum_value := sum_value + (d1 * 2);

  d2 := 11 - (sum_value % 11);
  IF d2 >= 10 THEN d2 := 0; END IF;

  RETURN base || d1::text || d2::text;
END;
$$;

CREATE OR REPLACE FUNCTION public._generate_fake_cnpj(seed bigint)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_num bigint;
  base text;
  i int;
  sum_value int;
  digit int;
  d1 int;
  d2 int;
  weights1 int[] := ARRAY[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  weights2 int[] := ARRAY[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
BEGIN
  base_num := abs(seed) % 1000000000000;
  base := lpad(base_num::text, 12, '0');

  WHILE base ~ '^([0-9])\1+$' LOOP
    base_num := (base_num + 7654321) % 1000000000000;
    base := lpad(base_num::text, 12, '0');
  END LOOP;

  sum_value := 0;
  FOR i IN 1..12 LOOP
    digit := substr(base, i, 1)::int;
    sum_value := sum_value + (digit * weights1[i]);
  END LOOP;

  d1 := 11 - (sum_value % 11);
  IF d1 >= 10 THEN d1 := 0; END IF;

  sum_value := 0;
  FOR i IN 1..12 LOOP
    digit := substr(base, i, 1)::int;
    sum_value := sum_value + (digit * weights2[i]);
  END LOOP;
  sum_value := sum_value + (d1 * weights2[13]);

  d2 := 11 - (sum_value % 11);
  IF d2 >= 10 THEN d2 := 0; END IF;

  RETURN base || d1::text || d2::text;
END;
$$;

WITH cpf_candidates AS (
  SELECT
    id,
    abs(hashtextextended(id::text || ':cpf', 0))::bigint
      + (row_number() OVER (ORDER BY id) * 10007)::bigint AS seed
  FROM public.profiles
  WHERE coalesce(trim(role), '') <> 'company'
    AND coalesce(trim(cpf), '') = ''
),
cpf_generated AS (
  SELECT id, public._generate_fake_cpf(seed) AS cpf
  FROM cpf_candidates
)
UPDATE public.profiles p
SET cpf = g.cpf,
    updated_at = now()
FROM cpf_generated g
WHERE p.id = g.id;

WITH cnpj_candidates AS (
  SELECT
    id,
    abs(hashtextextended(id::text || ':cnpj', 0))::bigint
      + (row_number() OVER (ORDER BY id) * 10009)::bigint AS seed
  FROM public.profiles
  WHERE coalesce(trim(role), '') = 'company'
    AND coalesce(trim(cnpj), '') = ''
),
cnpj_generated AS (
  SELECT id, public._generate_fake_cnpj(seed) AS cnpj
  FROM cnpj_candidates
)
UPDATE public.profiles p
SET cnpj = g.cnpj,
    updated_at = now()
FROM cnpj_generated g
WHERE p.id = g.id;

DROP FUNCTION IF EXISTS public._generate_fake_cpf(bigint);
DROP FUNCTION IF EXISTS public._generate_fake_cnpj(bigint);

NOTIFY pgrst, 'reload schema';
