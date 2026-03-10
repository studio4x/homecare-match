-- Add behavior controls for coupons (where applies + target tier).

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS apply_mode TEXT,
  ADD COLUMN IF NOT EXISTS target_tier TEXT;

UPDATE public.coupons
SET apply_mode = CASE WHEN only_new_users THEN 'signup_only' ELSE 'dashboard_only' END
WHERE apply_mode IS NULL OR btrim(apply_mode) = '';

UPDATE public.coupons
SET target_tier = COALESCE(NULLIF(lower(target_tier), ''), 'monthly')
WHERE target_tier IS NULL OR btrim(target_tier) = '';

ALTER TABLE public.coupons ALTER COLUMN apply_mode SET DEFAULT 'signup_only';
ALTER TABLE public.coupons ALTER COLUMN apply_mode SET NOT NULL;
ALTER TABLE public.coupons ALTER COLUMN target_tier SET DEFAULT 'monthly';
ALTER TABLE public.coupons ALTER COLUMN target_tier SET NOT NULL;

DO $coupon_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coupons_apply_mode_check'
      AND conrelid = 'public.coupons'::regclass
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_apply_mode_check
      CHECK (apply_mode IN ('signup_only', 'dashboard_only', 'signup_and_dashboard'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coupons_target_tier_check'
      AND conrelid = 'public.coupons'::regclass
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_target_tier_check
      CHECK (target_tier IN ('monthly', 'yearly'));
  END IF;
END
$coupon_constraints$;

-- Keep signup logic aligned with coupon behavior.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_count INTEGER;
  user_role TEXT;
  meta_coupon TEXT;
  coupon_id_found UUID;
  coupon_days_found INTEGER;
  coupon_apply_mode_found TEXT;
  coupon_target_tier_found TEXT;
  final_tier TEXT;
  final_end_at TIMESTAMP WITH TIME ZONE;
  final_coupon_days INTEGER;
BEGIN
  user_role := new.raw_user_meta_data ->> 'role';
  meta_coupon := new.raw_user_meta_data ->> 'coupon_code';

  SELECT count(*) INTO admin_count FROM public.profiles WHERE is_admin = true;

  IF admin_count = 0 THEN
    user_role := 'admin';
  ELSE
    IF user_role IS NULL OR user_role NOT IN ('company', 'family', 'professional') THEN
      user_role := 'professional';
    END IF;
  END IF;

  final_tier := CASE WHEN user_role = 'professional' THEN 'free_trial' ELSE NULL END;
  final_end_at := NULL;
  final_coupon_days := NULL;

  IF meta_coupon IS NOT NULL AND user_role = 'professional' THEN
    SELECT
      id,
      free_days,
      COALESCE(NULLIF(lower(apply_mode), ''), CASE WHEN only_new_users THEN 'signup_only' ELSE 'dashboard_only' END),
      COALESCE(NULLIF(lower(target_tier), ''), 'monthly')
    INTO coupon_id_found, coupon_days_found, coupon_apply_mode_found, coupon_target_tier_found
    FROM public.coupons
    WHERE upper(code) = upper(meta_coupon)
      AND is_active = true
      AND current_uses < max_uses
      AND COALESCE(NULLIF(lower(apply_mode), ''), CASE WHEN only_new_users THEN 'signup_only' ELSE 'dashboard_only' END)
        IN ('signup_only', 'signup_and_dashboard')
    LIMIT 1;

    IF coupon_id_found IS NOT NULL THEN
      final_tier := CASE WHEN coupon_target_tier_found = 'yearly' THEN 'yearly' ELSE 'monthly' END;
      final_end_at := NOW() + (coupon_days_found || ' days')::interval;
      final_coupon_days := coupon_days_found;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    is_admin,
    role,
    subscription_tier,
    subscription_end_at,
    trial_started_at,
    coupon_days,
    cancel_at_period_end,
    cpf,
    company_name,
    cnpj,
    ans_registration
  )
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    (user_role = 'admin'),
    user_role,
    final_tier,
    final_end_at,
    CASE WHEN user_role = 'professional' AND final_coupon_days IS NULL THEN NOW() ELSE NULL END,
    final_coupon_days,
    (final_coupon_days IS NOT NULL),
    new.raw_user_meta_data ->> 'cpf',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'cnpj',
    new.raw_user_meta_data ->> 'ans_registration'
  );

  IF coupon_id_found IS NOT NULL THEN
    INSERT INTO public.coupon_usages (coupon_id, user_id)
    VALUES (coupon_id_found, new.id)
    ON CONFLICT DO NOTHING;

    UPDATE public.coupons
    SET current_uses = current_uses + 1
    WHERE id = coupon_id_found;
  END IF;

  RETURN new;
END;
$function$;

NOTIFY pgrst, 'reload schema';
