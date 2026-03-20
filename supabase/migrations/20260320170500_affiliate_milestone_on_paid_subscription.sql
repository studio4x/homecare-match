-- Affiliate milestone bonus must be validated by paid plan subscriptions,
-- not by profile verification only.

CREATE OR REPLACE FUNCTION public.generate_affiliate_signup_commission(
  p_referred_user_id UUID,
  p_event_source TEXT DEFAULT 'profile_verification',
  p_event_source_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attr RECORD;
  v_referred RECORD;
  v_partner_profile RECORD;
BEGIN
  IF p_referred_user_id IS NULL OR COALESCE(public.is_affiliate_collection_enabled(), false) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT aa.*, ap.user_id AS partner_user_id
    INTO v_attr
  FROM public.affiliate_attributions aa
  JOIN public.affiliate_partners ap ON ap.id = aa.affiliate_partner_id
  WHERE aa.referred_user_id = p_referred_user_id
    AND ap.status = 'active'
  LIMIT 1;

  IF v_attr.id IS NULL OR COALESCE(v_attr.is_valid, true) <> true THEN
    RETURN NULL;
  END IF;

  SELECT id, role, is_verified, email, cpf
    INTO v_referred
  FROM public.profiles
  WHERE id = p_referred_user_id
  LIMIT 1;

  IF v_referred.id IS NULL
     OR COALESCE(LOWER(v_referred.role), '') <> 'professional'
     OR COALESCE(v_referred.is_verified, false) <> true THEN
    RETURN NULL;
  END IF;

  IF v_attr.partner_user_id IS NOT NULL THEN
    IF v_attr.partner_user_id = p_referred_user_id THEN
      UPDATE public.affiliate_attributions
      SET is_valid = false, invalid_reason = 'self_referral'
      WHERE id = v_attr.id;
      RETURN NULL;
    END IF;

    SELECT id, email, cpf
      INTO v_partner_profile
    FROM public.profiles
    WHERE id = v_attr.partner_user_id
    LIMIT 1;

    IF v_partner_profile.id IS NOT NULL
       AND public.is_affiliate_duplicate_identity(
         v_partner_profile.email,
         v_referred.email,
         v_partner_profile.cpf,
         v_referred.cpf
       ) THEN
      UPDATE public.affiliate_attributions
      SET is_valid = false, invalid_reason = 'duplicate_identity'
      WHERE id = v_attr.id;
      RETURN NULL;
    END IF;
  END IF;

  -- Milestone bonus is now awarded only by paid plan subscription events.
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_affiliate_recurring_commission(
  p_payment_transaction_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx RECORD;
  v_attr RECORD;
  v_referred RECORD;
  v_partner_profile RECORD;
  v_percent NUMERIC(5,2);
  v_amount NUMERIC(12,2);
  v_entry_status TEXT;
  v_event_id TEXT;
  v_new_id UUID;
  v_commission_policy TEXT := 'monthly_each_charge_yearly_hire_and_renewal';

  v_milestone_amount NUMERIC(12,2);
  v_total_paid_plan_signups INTEGER;
  v_existing_bonus_blocks INTEGER;
  v_target_blocks INTEGER;
  v_block INTEGER;
BEGIN
  IF p_payment_transaction_id IS NULL OR COALESCE(public.is_affiliate_collection_enabled(), false) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT *
    INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  LIMIT 1;

  IF v_tx.id IS NULL OR COALESCE(LOWER(v_tx.transaction_type), '') <> 'plan' THEN
    RETURN NULL;
  END IF;

  IF UPPER(COALESCE(v_tx.status, '')) NOT IN ('RECEIVED', 'CONFIRMED', 'PAID', 'SUCCEEDED') THEN
    RETURN NULL;
  END IF;

  SELECT aa.*, ap.user_id AS partner_user_id
    INTO v_attr
  FROM public.affiliate_attributions aa
  JOIN public.affiliate_partners ap ON ap.id = aa.affiliate_partner_id
  WHERE aa.referred_user_id = v_tx.user_id
    AND ap.status = 'active'
  LIMIT 1;

  IF v_attr.id IS NULL OR COALESCE(v_attr.is_valid, true) <> true THEN
    RETURN NULL;
  END IF;

  SELECT id, role, email, cpf
    INTO v_referred
  FROM public.profiles
  WHERE id = v_tx.user_id
  LIMIT 1;

  IF v_referred.id IS NULL OR COALESCE(LOWER(v_referred.role), '') <> 'professional' THEN
    RETURN NULL;
  END IF;

  IF v_attr.partner_user_id IS NOT NULL THEN
    IF v_attr.partner_user_id = v_tx.user_id THEN
      UPDATE public.affiliate_attributions
      SET is_valid = false, invalid_reason = 'self_referral'
      WHERE id = v_attr.id;
      RETURN NULL;
    END IF;

    SELECT id, email, cpf
      INTO v_partner_profile
    FROM public.profiles
    WHERE id = v_attr.partner_user_id
    LIMIT 1;

    IF v_partner_profile.id IS NOT NULL
       AND public.is_affiliate_duplicate_identity(
         v_partner_profile.email,
         v_referred.email,
         v_partner_profile.cpf,
         v_referred.cpf
       ) THEN
      UPDATE public.affiliate_attributions
      SET is_valid = false, invalid_reason = 'duplicate_identity'
      WHERE id = v_attr.id;
      RETURN NULL;
    END IF;
  END IF;

  SELECT recurring_commission_percent
    INTO v_percent
  FROM public.affiliate_program_config
  WHERE id = 1;

  IF COALESCE(v_percent, 0) <= 0 OR COALESCE(v_tx.amount, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  v_amount := ROUND((COALESCE(v_tx.amount, 0) * v_percent / 100.0)::NUMERIC, 2);
  IF COALESCE(v_amount, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  v_entry_status := COALESCE(public.get_affiliate_entry_initial_status(), 'shadow');
  v_event_id := COALESCE(NULLIF(v_tx.payment_id, ''), v_tx.id::TEXT);

  INSERT INTO public.affiliate_commission_ledger (
    affiliate_partner_id,
    referred_user_id,
    attribution_id,
    payment_transaction_id,
    payment_id,
    entry_type,
    direction,
    amount,
    currency,
    description,
    event_source,
    event_source_id,
    entry_status,
    metadata
  )
  VALUES (
    v_attr.affiliate_partner_id,
    v_tx.user_id,
    v_attr.id,
    v_tx.id,
    v_tx.payment_id,
    'recurring_credit',
    'credit',
    v_amount,
    COALESCE(v_tx.currency, 'BRL'),
    'Comissao recorrente por pagamento valido do plano (mensal: cada cobranca; anual: contratacao e renovacao)',
    'payment',
    v_event_id,
    v_entry_status,
    jsonb_build_object(
      'rule', 'recurring_percent',
      'percent', v_percent,
      'transaction_amount', v_tx.amount,
      'plan_id', v_tx.plan_id,
      'commission_policy', v_commission_policy
    )
  )
  ON CONFLICT (affiliate_partner_id, entry_type, event_source, event_source_id) DO NOTHING
  RETURNING id INTO v_new_id;

  SELECT signup_commission_amount
    INTO v_milestone_amount
  FROM public.affiliate_program_config
  WHERE id = 1;

  IF COALESCE(v_milestone_amount, 0) <= 0 THEN
    RETURN v_new_id;
  END IF;

  SELECT COUNT(DISTINCT l.referred_user_id)::INTEGER
    INTO v_total_paid_plan_signups
  FROM public.affiliate_commission_ledger l
  WHERE l.affiliate_partner_id = v_attr.affiliate_partner_id
    AND l.entry_type = 'recurring_credit'
    AND l.direction = 'credit'
    AND l.event_source = 'payment';

  IF COALESCE(v_total_paid_plan_signups, 0) < 10 THEN
    RETURN v_new_id;
  END IF;

  v_target_blocks := (v_total_paid_plan_signups / 10);

  SELECT COUNT(*)::INTEGER
    INTO v_existing_bonus_blocks
  FROM public.affiliate_commission_ledger l
  WHERE l.affiliate_partner_id = v_attr.affiliate_partner_id
    AND l.entry_type = 'signup_credit'
    AND l.event_source = 'signup_milestone';

  IF COALESCE(v_existing_bonus_blocks, 0) >= v_target_blocks THEN
    RETURN v_new_id;
  END IF;

  v_block := COALESCE(v_existing_bonus_blocks, 0) + 1;

  WHILE v_block <= v_target_blocks LOOP
    INSERT INTO public.affiliate_commission_ledger (
      affiliate_partner_id,
      referred_user_id,
      attribution_id,
      entry_type,
      direction,
      amount,
      currency,
      description,
      event_source,
      event_source_id,
      entry_status,
      metadata
    )
    VALUES (
      v_attr.affiliate_partner_id,
      v_tx.user_id,
      v_attr.id,
      'signup_credit',
      'credit',
      v_milestone_amount,
      'BRL',
      format('Bonus por %s assinaturas de plano efetivadas', v_block * 10),
      'signup_milestone',
      format('milestone_%s', v_block),
      v_entry_status,
      jsonb_build_object(
        'rule', 'paid_plan_milestone_bonus',
        'fixed_amount', v_milestone_amount,
        'milestone_block', v_block,
        'required_paid_plan_signups_per_block', 10,
        'threshold_total_paid_plan_signups', v_block * 10,
        'trigger_referred_user_id', v_tx.user_id
      )
    )
    ON CONFLICT (affiliate_partner_id, entry_type, event_source, event_source_id) DO NOTHING;

    v_block := v_block + 1;
  END LOOP;

  RETURN v_new_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
