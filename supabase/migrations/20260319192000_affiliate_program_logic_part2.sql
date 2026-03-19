-- Affiliate Program v1 - recurring logic, triggers and balances

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
BEGIN
  IF p_payment_transaction_id IS NULL OR COALESCE(public.is_affiliate_collection_enabled(), false) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_tx FROM public.payment_transactions WHERE id = p_payment_transaction_id LIMIT 1;
  IF v_tx.id IS NULL OR COALESCE(LOWER(v_tx.transaction_type), '') <> 'plan' THEN RETURN NULL; END IF;
  IF UPPER(COALESCE(v_tx.status, '')) NOT IN ('RECEIVED', 'CONFIRMED', 'PAID', 'SUCCEEDED') THEN RETURN NULL; END IF;

  SELECT aa.*, ap.user_id AS partner_user_id
    INTO v_attr
  FROM public.affiliate_attributions aa
  JOIN public.affiliate_partners ap ON ap.id = aa.affiliate_partner_id
  WHERE aa.referred_user_id = v_tx.user_id
    AND ap.status = 'active'
  LIMIT 1;

  IF v_attr.id IS NULL OR COALESCE(v_attr.is_valid, true) <> true THEN RETURN NULL; END IF;

  SELECT id, role, email, cpf INTO v_referred FROM public.profiles WHERE id = v_tx.user_id LIMIT 1;
  IF v_referred.id IS NULL OR COALESCE(LOWER(v_referred.role), '') <> 'professional' THEN RETURN NULL; END IF;

  IF v_attr.partner_user_id IS NOT NULL THEN
    IF v_attr.partner_user_id = v_tx.user_id THEN
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

  SELECT recurring_commission_percent INTO v_percent FROM public.affiliate_program_config WHERE id = 1;
  IF COALESCE(v_percent, 0) <= 0 OR COALESCE(v_tx.amount, 0) <= 0 THEN RETURN NULL; END IF;

  v_amount := ROUND((COALESCE(v_tx.amount, 0) * v_percent / 100.0)::NUMERIC, 2);
  IF COALESCE(v_amount, 0) <= 0 THEN RETURN NULL; END IF;

  v_entry_status := COALESCE(public.get_affiliate_entry_initial_status(), 'shadow');
  v_event_id := COALESCE(NULLIF(v_tx.payment_id, ''), v_tx.id::TEXT);

  INSERT INTO public.affiliate_commission_ledger (
    affiliate_partner_id, referred_user_id, attribution_id, payment_transaction_id, payment_id,
    entry_type, direction, amount, currency, description,
    event_source, event_source_id, entry_status, metadata
  )
  VALUES (
    v_attr.affiliate_partner_id, v_tx.user_id, v_attr.id, v_tx.id, v_tx.payment_id,
    'recurring_credit', 'credit', v_amount, COALESCE(v_tx.currency, 'BRL'),
    'Comissao recorrente por pagamento valido do indicado',
    'payment', v_event_id, v_entry_status,
    jsonb_build_object('rule', 'recurring_percent', 'percent', v_percent, 'transaction_amount', v_tx.amount, 'plan_id', v_tx.plan_id)
  )
  ON CONFLICT (affiliate_partner_id, entry_type, event_source, event_source_id) DO NOTHING
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_affiliate_clawback(
  p_payment_transaction_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx RECORD;
  v_credit RECORD;
  v_entry_status TEXT;
  v_new_id UUID;
  v_event_id TEXT;
BEGIN
  IF p_payment_transaction_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_tx FROM public.payment_transactions WHERE id = p_payment_transaction_id LIMIT 1;
  IF v_tx.id IS NULL OR COALESCE(LOWER(v_tx.transaction_type), '') <> 'plan' THEN RETURN NULL; END IF;

  IF UPPER(COALESCE(v_tx.status, '')) NOT IN (
    'REFUND_PENDING','REFUNDED','CANCELED','CANCELLED','VOID','DELETED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE'
  ) THEN RETURN NULL; END IF;

  v_event_id := COALESCE(NULLIF(v_tx.payment_id, ''), v_tx.id::TEXT);

  SELECT * INTO v_credit
  FROM public.affiliate_commission_ledger
  WHERE entry_type = 'recurring_credit'
    AND event_source = 'payment'
    AND event_source_id = v_event_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_credit.id IS NULL THEN RETURN NULL; END IF;

  v_entry_status := CASE
    WHEN v_credit.entry_status = 'shadow' THEN 'shadow'
    WHEN v_credit.entry_status = 'paid' THEN 'available'
    WHEN v_credit.entry_status = 'reserved' THEN 'available'
    ELSE COALESCE(v_credit.entry_status, 'available')
  END;

  INSERT INTO public.affiliate_commission_ledger (
    affiliate_partner_id, referred_user_id, attribution_id, payment_transaction_id, payment_id,
    entry_type, direction, amount, currency, description,
    event_source, event_source_id, entry_status, metadata
  )
  VALUES (
    v_credit.affiliate_partner_id, v_credit.referred_user_id, v_credit.attribution_id, v_tx.id, v_tx.payment_id,
    'clawback_debit', 'debit', v_credit.amount, COALESCE(v_credit.currency, 'BRL'),
    'Ajuste negativo por estorno/cancelamento do pagamento do indicado',
    'payment_refund', v_event_id, v_entry_status,
    jsonb_build_object('source_credit_id', v_credit.id, 'refund_status', v_tx.status)
  )
  ON CONFLICT (affiliate_partner_id, entry_type, event_source, event_source_id) DO NOTHING
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_affiliate_after_marketing_short_link_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.create_affiliate_attribution_from_short_link(NEW.short_link_id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_after_marketing_short_link_signup ON public.marketing_short_link_signups;
CREATE TRIGGER trg_affiliate_after_marketing_short_link_signup
AFTER INSERT ON public.marketing_short_link_signups
FOR EACH ROW EXECUTE FUNCTION public.trg_affiliate_after_marketing_short_link_signup();

CREATE OR REPLACE FUNCTION public.trg_affiliate_after_profile_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_verified IS TRUE AND (TG_OP = 'INSERT' OR COALESCE(OLD.is_verified, false) = false) THEN
    PERFORM public.generate_affiliate_signup_commission(NEW.id, 'profile_verification', NEW.id::TEXT);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_after_profile_verified ON public.profiles;
CREATE TRIGGER trg_affiliate_after_profile_verified
AFTER INSERT OR UPDATE OF is_verified ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_affiliate_after_profile_verified();

CREATE OR REPLACE FUNCTION public.trg_affiliate_after_payment_transaction_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_status TEXT;
  v_old_status TEXT;
BEGIN
  v_new_status := UPPER(COALESCE(NEW.status, ''));
  v_old_status := UPPER(COALESCE(OLD.status, ''));

  IF COALESCE(LOWER(NEW.transaction_type), '') <> 'plan' THEN RETURN NEW; END IF;

  IF v_new_status IN ('RECEIVED', 'CONFIRMED', 'PAID', 'SUCCEEDED')
     AND (TG_OP = 'INSERT' OR v_new_status IS DISTINCT FROM v_old_status) THEN
    PERFORM public.generate_affiliate_recurring_commission(NEW.id);
  END IF;

  IF v_new_status IN ('REFUND_PENDING','REFUNDED','CANCELED','CANCELLED','VOID','DELETED','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE')
     AND (TG_OP = 'INSERT' OR v_new_status IS DISTINCT FROM v_old_status) THEN
    PERFORM public.generate_affiliate_clawback(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_after_payment_transaction_change ON public.payment_transactions;
CREATE TRIGGER trg_affiliate_after_payment_transaction_change
AFTER INSERT OR UPDATE OF status ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_affiliate_after_payment_transaction_change();

CREATE OR REPLACE VIEW public.affiliate_partner_balances AS
SELECT
  l.affiliate_partner_id,
  COALESCE(SUM(CASE WHEN l.entry_status = 'shadow' THEN CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END ELSE 0 END), 0)::NUMERIC(12,2) AS shadow_balance,
  COALESCE(SUM(CASE WHEN l.entry_status = 'available' THEN CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END ELSE 0 END), 0)::NUMERIC(12,2) AS available_balance,
  COALESCE(SUM(CASE WHEN l.entry_status = 'reserved' THEN CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END ELSE 0 END), 0)::NUMERIC(12,2) AS reserved_balance,
  COALESCE(SUM(CASE WHEN l.entry_status = 'paid' THEN CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END ELSE 0 END), 0)::NUMERIC(12,2) AS paid_balance,
  COALESCE(SUM(CASE WHEN l.entry_status IN ('available', 'reserved', 'paid', 'shadow') THEN CASE WHEN l.direction = 'credit' THEN l.amount ELSE -l.amount END ELSE 0 END), 0)::NUMERIC(12,2) AS lifetime_balance
FROM public.affiliate_commission_ledger l
GROUP BY l.affiliate_partner_id;

CREATE OR REPLACE FUNCTION public.affiliate_is_partner_owner(p_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.affiliate_partners ap
    WHERE ap.id = p_partner_id
      AND ap.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.create_affiliate_attribution_from_short_link(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_affiliate_signup_commission(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_affiliate_recurring_commission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_affiliate_clawback(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_affiliate_collection_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_affiliate_entry_initial_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_is_partner_owner(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
