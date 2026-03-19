-- Affiliate Program v1 - business logic and triggers

CREATE OR REPLACE FUNCTION public.set_affiliate_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_program_config_updated_at ON public.affiliate_program_config;
CREATE TRIGGER trg_affiliate_program_config_updated_at
BEFORE UPDATE ON public.affiliate_program_config
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_updated_at();

DROP TRIGGER IF EXISTS trg_affiliate_partners_updated_at ON public.affiliate_partners;
CREATE TRIGGER trg_affiliate_partners_updated_at
BEFORE UPDATE ON public.affiliate_partners
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_updated_at();

DROP TRIGGER IF EXISTS trg_affiliate_attributions_updated_at ON public.affiliate_attributions;
CREATE TRIGGER trg_affiliate_attributions_updated_at
BEFORE UPDATE ON public.affiliate_attributions
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_updated_at();

DROP TRIGGER IF EXISTS trg_affiliate_payout_batches_updated_at ON public.affiliate_payout_batches;
CREATE TRIGGER trg_affiliate_payout_batches_updated_at
BEFORE UPDATE ON public.affiliate_payout_batches
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_updated_at();

DROP TRIGGER IF EXISTS trg_affiliate_payout_items_updated_at ON public.affiliate_payout_items;
CREATE TRIGGER trg_affiliate_payout_items_updated_at
BEFORE UPDATE ON public.affiliate_payout_items
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_updated_at();

DROP TRIGGER IF EXISTS trg_affiliate_commission_ledger_updated_at ON public.affiliate_commission_ledger;
CREATE TRIGGER trg_affiliate_commission_ledger_updated_at
BEFORE UPDATE ON public.affiliate_commission_ledger
FOR EACH ROW EXECUTE FUNCTION public.set_affiliate_updated_at();

CREATE OR REPLACE FUNCTION public.is_affiliate_collection_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(affiliate_program_enabled, false) OR COALESCE(affiliate_shadow_mode, true)
  FROM public.affiliate_program_config
  WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.get_affiliate_entry_initial_status()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN COALESCE(affiliate_program_enabled, false) = true AND COALESCE(affiliate_shadow_mode, true) = false
      THEN 'available'
    ELSE 'shadow'
  END
  FROM public.affiliate_program_config
  WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.create_affiliate_attribution_from_short_link(
  p_short_link_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_partner_id UUID;
  v_partner_user_id UUID;
  v_new_id UUID;
BEGIN
  IF p_short_link_id IS NULL OR p_user_id IS NULL OR COALESCE(public.is_affiliate_collection_enabled(), false) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT asl.affiliate_partner_id, ap.user_id
    INTO v_partner_id, v_partner_user_id
  FROM public.affiliate_short_links asl
  JOIN public.affiliate_partners ap ON ap.id = asl.affiliate_partner_id
  WHERE asl.short_link_id = p_short_link_id
    AND ap.status = 'active'
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.affiliate_attributions (
    referred_user_id,
    affiliate_partner_id,
    source_short_link_id,
    source,
    is_valid,
    invalid_reason
  )
  VALUES (
    p_user_id,
    v_partner_id,
    p_short_link_id,
    'short_link',
    CASE WHEN v_partner_user_id IS NOT NULL AND v_partner_user_id = p_user_id THEN false ELSE true END,
    CASE WHEN v_partner_user_id IS NOT NULL AND v_partner_user_id = p_user_id THEN 'self_referral' ELSE NULL END
  )
  ON CONFLICT (referred_user_id) DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NOT NULL THEN
    RETURN v_new_id;
  END IF;

  SELECT id INTO v_new_id
  FROM public.affiliate_attributions
  WHERE referred_user_id = p_user_id
  LIMIT 1;

  RETURN v_new_id;
END;
$$;

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
  v_amount NUMERIC(12,2);
  v_entry_status TEXT;
  v_event_id TEXT;
  v_new_id UUID;
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

  IF v_attr.id IS NULL OR COALESCE(v_attr.is_valid, true) <> true THEN RETURN NULL; END IF;

  SELECT id, role, is_verified, email, cpf INTO v_referred FROM public.profiles WHERE id = p_referred_user_id LIMIT 1;
  IF v_referred.id IS NULL OR COALESCE(LOWER(v_referred.role), '') <> 'professional' OR COALESCE(v_referred.is_verified, false) <> true THEN RETURN NULL; END IF;

  IF v_attr.partner_user_id IS NOT NULL THEN
    IF v_attr.partner_user_id = p_referred_user_id THEN
      UPDATE public.affiliate_attributions SET is_valid = false, invalid_reason = 'self_referral' WHERE id = v_attr.id;
      RETURN NULL;
    END IF;

    SELECT id, email, cpf INTO v_partner_profile FROM public.profiles WHERE id = v_attr.partner_user_id LIMIT 1;
    IF v_partner_profile.id IS NOT NULL AND (
      COALESCE(NULLIF(LOWER(v_partner_profile.email), ''), '__none__') = COALESCE(NULLIF(LOWER(v_referred.email), ''), '__none__') OR
      COALESCE(NULLIF(v_partner_profile.cpf, ''), '__none__') = COALESCE(NULLIF(v_referred.cpf, ''), '__none__')
    ) THEN
      UPDATE public.affiliate_attributions SET is_valid = false, invalid_reason = 'duplicate_identity' WHERE id = v_attr.id;
      RETURN NULL;
    END IF;
  END IF;

  SELECT signup_commission_amount INTO v_amount FROM public.affiliate_program_config WHERE id = 1;
  IF COALESCE(v_amount, 0) <= 0 THEN RETURN NULL; END IF;

  v_entry_status := COALESCE(public.get_affiliate_entry_initial_status(), 'shadow');
  v_event_id := COALESCE(NULLIF(p_event_source_id, ''), p_referred_user_id::TEXT);

  INSERT INTO public.affiliate_commission_ledger (
    affiliate_partner_id, referred_user_id, attribution_id, entry_type, direction,
    amount, currency, description, event_source, event_source_id, entry_status, metadata
  )
  VALUES (
    v_attr.affiliate_partner_id, p_referred_user_id, v_attr.id, 'signup_credit', 'credit',
    v_amount, 'BRL', 'Comissão por cadastro completo (docs validados)',
    COALESCE(NULLIF(p_event_source, ''), 'profile_verification'), v_event_id, v_entry_status,
    jsonb_build_object('rule', 'signup_docs_verified', 'fixed_amount', v_amount)
  )
  ON CONFLICT (affiliate_partner_id, entry_type, event_source, event_source_id) DO NOTHING
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
