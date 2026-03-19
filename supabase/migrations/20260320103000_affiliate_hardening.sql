-- Affiliate program hardening
-- 1) Secure short-link signup tracking against forged user_id
-- 2) Prevent self-provisioning affiliate partners through RLS
-- 3) Restrict partner self-update to PIX fields only
-- 4) Approve payout batches atomically with row locks

CREATE OR REPLACE FUNCTION public.track_marketing_short_link_signup(
  p_slug TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_short_link_id UUID;
  v_auth_user_id UUID;
  v_effective_user_id UUID;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN false;
  END IF;

  v_auth_user_id := auth.uid();
  IF v_auth_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_auth_user_id THEN
    RAISE EXCEPTION 'p_user_id must match auth.uid()';
  END IF;

  v_effective_user_id := COALESCE(p_user_id, v_auth_user_id);

  SELECT id
    INTO v_short_link_id
  FROM public.marketing_short_links
  WHERE lower(slug) = lower(btrim(p_slug))
  LIMIT 1;

  IF v_short_link_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.marketing_short_link_signups (short_link_id, user_id)
  VALUES (v_short_link_id, v_effective_user_id)
  ON CONFLICT (short_link_id, user_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.marketing_short_links
  SET
    signup_count = COALESCE(signup_count, 0) + 1,
    last_signup_at = now(),
    updated_at = now()
  WHERE id = v_short_link_id;

  INSERT INTO public.marketing_short_link_events (
    short_link_id,
    event_type,
    user_id,
    occurred_at
  ) VALUES (
    v_short_link_id,
    'signup',
    v_effective_user_id,
    now()
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.track_marketing_short_link_signup(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_marketing_short_link_signup(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.track_marketing_short_link_signup(TEXT, UUID) TO authenticated;

DROP POLICY IF EXISTS "affiliate_partners_owner_or_admin_insert" ON public.affiliate_partners;
CREATE POLICY "affiliate_partners_owner_or_admin_insert"
ON public.affiliate_partners
FOR INSERT
TO authenticated
WITH CHECK (check_is_admin());

CREATE OR REPLACE FUNCTION public.enforce_affiliate_partner_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Service operations and SQL migrations must not be blocked by the self-update guard.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role')
     OR COALESCE(auth.role(), '') = 'service_role'
     OR check_is_admin() THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();
  IF v_uid IS NULL OR OLD.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Acesso negado para atualizar parceiro afiliado.';
  END IF;

  -- Partner self-service in v1 is restricted to PIX fields only.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.phone IS DISTINCT FROM OLD.phone
     OR NEW.is_external IS DISTINCT FROM OLD.is_external
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Afiliado pode atualizar apenas chave PIX e tipo da chave PIX.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_partners_self_update_guard ON public.affiliate_partners;
CREATE TRIGGER trg_affiliate_partners_self_update_guard
BEFORE UPDATE ON public.affiliate_partners
FOR EACH ROW
EXECUTE FUNCTION public.enforce_affiliate_partner_self_update();

CREATE OR REPLACE FUNCTION public.approve_affiliate_payout_batch(
  p_admin_user_id UUID,
  p_period_label TEXT DEFAULT NULL
)
RETURNS TABLE(
  created BOOLEAN,
  batch_id UUID,
  total_affiliates INTEGER,
  total_entries INTEGER,
  total_amount NUMERIC(12,2),
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_minimum NUMERIC(12,2) := 100.00;
  v_batch_id UUID;
  v_total_amount NUMERIC(12,2) := 0;
  v_total_entries INTEGER := 0;
  v_partner_count INTEGER := 0;
  v_now TIMESTAMPTZ := now();
  v_period TEXT;
  v_item_id UUID;
  v_reserved_count INTEGER;
  rec RECORD;
BEGIN
  IF p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'p_admin_user_id obrigatorio';
  END IF;

  v_period := COALESCE(NULLIF(btrim(p_period_label), ''), to_char(v_now, 'YYYY-MM'));

  SELECT COALESCE(payout_minimum_amount, 100.00)
  INTO v_minimum
  FROM public.affiliate_program_config
  WHERE id = 1;

  CREATE TEMP TABLE tmp_affiliate_locked_entries (
    id UUID PRIMARY KEY,
    affiliate_partner_id UUID NOT NULL,
    direction TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_affiliate_locked_entries (id, affiliate_partner_id, direction, amount)
  SELECT l.id, l.affiliate_partner_id, l.direction, l.amount
  FROM public.affiliate_commission_ledger l
  WHERE l.entry_status = 'available'
    AND l.payout_item_id IS NULL
  ORDER BY l.created_at ASC
  LIMIT 10000
  FOR UPDATE SKIP LOCKED;

  IF NOT EXISTS (SELECT 1 FROM tmp_affiliate_locked_entries) THEN
    RETURN QUERY
    SELECT false, NULL::UUID, 0, 0, 0::NUMERIC(12,2), 'Nenhuma comissão disponível para pagamento.';
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_affiliate_eligible (
    affiliate_partner_id UUID PRIMARY KEY,
    amount NUMERIC(12,2) NOT NULL,
    entry_count INTEGER NOT NULL,
    pix_key TEXT NOT NULL,
    pix_key_type TEXT
  ) ON COMMIT DROP;

  INSERT INTO tmp_affiliate_eligible (affiliate_partner_id, amount, entry_count, pix_key, pix_key_type)
  SELECT
    e.affiliate_partner_id,
    ROUND(SUM(CASE WHEN e.direction = 'debit' THEN -e.amount ELSE e.amount END)::NUMERIC, 2) AS amount,
    COUNT(*)::INTEGER AS entry_count,
    ap.pix_key,
    ap.pix_key_type
  FROM tmp_affiliate_locked_entries e
  JOIN public.affiliate_partners ap ON ap.id = e.affiliate_partner_id
  WHERE ap.status = 'active'
    AND NULLIF(btrim(COALESCE(ap.pix_key, '')), '') IS NOT NULL
  GROUP BY e.affiliate_partner_id, ap.pix_key, ap.pix_key_type
  HAVING ROUND(SUM(CASE WHEN e.direction = 'debit' THEN -e.amount ELSE e.amount END)::NUMERIC, 2) >= v_minimum;

  IF NOT EXISTS (SELECT 1 FROM tmp_affiliate_eligible) THEN
    RETURN QUERY
    SELECT false, NULL::UUID, 0, 0, 0::NUMERIC(12,2), 'Nenhum afiliado elegível para lote (mínimo, status, ou PIX ausente).';
    RETURN;
  END IF;

  INSERT INTO public.affiliate_payout_batches (
    period_label,
    status,
    minimum_amount,
    approved_by,
    approved_at
  )
  VALUES (
    v_period,
    'approved',
    v_minimum,
    p_admin_user_id,
    v_now
  )
  RETURNING id INTO v_batch_id;

  FOR rec IN
    SELECT affiliate_partner_id, amount, entry_count, pix_key, pix_key_type
    FROM tmp_affiliate_eligible
    ORDER BY affiliate_partner_id
  LOOP
    INSERT INTO public.affiliate_payout_items (
      batch_id,
      affiliate_partner_id,
      amount,
      entry_count,
      status,
      pix_key,
      pix_key_type
    )
    VALUES (
      v_batch_id,
      rec.affiliate_partner_id,
      rec.amount,
      rec.entry_count,
      'reserved',
      rec.pix_key,
      rec.pix_key_type
    )
    RETURNING id INTO v_item_id;

    UPDATE public.affiliate_commission_ledger l
    SET
      entry_status = 'reserved',
      payout_item_id = v_item_id,
      updated_at = v_now
    WHERE l.id IN (
      SELECT id
      FROM tmp_affiliate_locked_entries
      WHERE affiliate_partner_id = rec.affiliate_partner_id
    )
      AND l.entry_status = 'available'
      AND l.payout_item_id IS NULL;

    GET DIAGNOSTICS v_reserved_count = ROW_COUNT;
    IF v_reserved_count <> rec.entry_count THEN
      RAISE EXCEPTION 'Falha de concorrência ao reservar entradas do afiliado %', rec.affiliate_partner_id;
    END IF;

    v_partner_count := v_partner_count + 1;
    v_total_entries := v_total_entries + rec.entry_count;
    v_total_amount := v_total_amount + rec.amount;
  END LOOP;

  v_total_amount := ROUND(v_total_amount::NUMERIC, 2);

  UPDATE public.affiliate_payout_batches
  SET
    total_affiliates = v_partner_count,
    total_entries = v_total_entries,
    total_amount = v_total_amount,
    updated_at = v_now
  WHERE id = v_batch_id;

  RETURN QUERY
  SELECT true, v_batch_id, v_partner_count, v_total_entries, v_total_amount, 'Lote aprovado com sucesso.';
END;
$$;

REVOKE ALL ON FUNCTION public.approve_affiliate_payout_batch(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_affiliate_payout_batch(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.approve_affiliate_payout_batch(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_affiliate_payout_batch(UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
