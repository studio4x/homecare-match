-- Affiliate Program v1 - RLS policies

ALTER TABLE public.affiliate_program_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_short_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payout_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_program_config' AND policyname = 'affiliate_program_config_select_all_authenticated'
  ) THEN
    CREATE POLICY "affiliate_program_config_select_all_authenticated"
    ON public.affiliate_program_config
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_program_config' AND policyname = 'affiliate_program_config_admin_update'
  ) THEN
    CREATE POLICY "affiliate_program_config_admin_update"
    ON public.affiliate_program_config
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_partners' AND policyname = 'affiliate_partners_owner_or_admin_select'
  ) THEN
    CREATE POLICY "affiliate_partners_owner_or_admin_select"
    ON public.affiliate_partners
    FOR SELECT
    TO authenticated
    USING (check_is_admin() OR user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_partners' AND policyname = 'affiliate_partners_owner_or_admin_update'
  ) THEN
    CREATE POLICY "affiliate_partners_owner_or_admin_update"
    ON public.affiliate_partners
    FOR UPDATE
    TO authenticated
    USING (check_is_admin() OR user_id = auth.uid())
    WITH CHECK (check_is_admin() OR user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_partners' AND policyname = 'affiliate_partners_owner_or_admin_insert'
  ) THEN
    CREATE POLICY "affiliate_partners_owner_or_admin_insert"
    ON public.affiliate_partners
    FOR INSERT
    TO authenticated
    WITH CHECK (check_is_admin() OR user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_short_links' AND policyname = 'affiliate_short_links_owner_or_admin_select'
  ) THEN
    CREATE POLICY "affiliate_short_links_owner_or_admin_select"
    ON public.affiliate_short_links
    FOR SELECT
    TO authenticated
    USING (
      check_is_admin() OR EXISTS (
        SELECT 1
        FROM public.affiliate_partners ap
        WHERE ap.id = affiliate_short_links.affiliate_partner_id
          AND ap.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_short_links' AND policyname = 'affiliate_short_links_admin_all'
  ) THEN
    CREATE POLICY "affiliate_short_links_admin_all"
    ON public.affiliate_short_links
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_attributions' AND policyname = 'affiliate_attributions_owner_or_admin_select'
  ) THEN
    CREATE POLICY "affiliate_attributions_owner_or_admin_select"
    ON public.affiliate_attributions
    FOR SELECT
    TO authenticated
    USING (
      check_is_admin() OR EXISTS (
        SELECT 1
        FROM public.affiliate_partners ap
        WHERE ap.id = affiliate_attributions.affiliate_partner_id
          AND ap.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_attributions' AND policyname = 'affiliate_attributions_admin_all'
  ) THEN
    CREATE POLICY "affiliate_attributions_admin_all"
    ON public.affiliate_attributions
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_commission_ledger' AND policyname = 'affiliate_commission_ledger_owner_or_admin_select'
  ) THEN
    CREATE POLICY "affiliate_commission_ledger_owner_or_admin_select"
    ON public.affiliate_commission_ledger
    FOR SELECT
    TO authenticated
    USING (
      check_is_admin() OR EXISTS (
        SELECT 1
        FROM public.affiliate_partners ap
        WHERE ap.id = affiliate_commission_ledger.affiliate_partner_id
          AND ap.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_commission_ledger' AND policyname = 'affiliate_commission_ledger_admin_all'
  ) THEN
    CREATE POLICY "affiliate_commission_ledger_admin_all"
    ON public.affiliate_commission_ledger
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_payout_batches' AND policyname = 'affiliate_payout_batches_owner_or_admin_select'
  ) THEN
    CREATE POLICY "affiliate_payout_batches_owner_or_admin_select"
    ON public.affiliate_payout_batches
    FOR SELECT
    TO authenticated
    USING (
      check_is_admin() OR EXISTS (
        SELECT 1
        FROM public.affiliate_payout_items api
        JOIN public.affiliate_partners ap ON ap.id = api.affiliate_partner_id
        WHERE api.batch_id = affiliate_payout_batches.id
          AND ap.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_payout_batches' AND policyname = 'affiliate_payout_batches_admin_all'
  ) THEN
    CREATE POLICY "affiliate_payout_batches_admin_all"
    ON public.affiliate_payout_batches
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_payout_items' AND policyname = 'affiliate_payout_items_owner_or_admin_select'
  ) THEN
    CREATE POLICY "affiliate_payout_items_owner_or_admin_select"
    ON public.affiliate_payout_items
    FOR SELECT
    TO authenticated
    USING (
      check_is_admin() OR EXISTS (
        SELECT 1
        FROM public.affiliate_partners ap
        WHERE ap.id = affiliate_payout_items.affiliate_partner_id
          AND ap.user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'affiliate_payout_items' AND policyname = 'affiliate_payout_items_admin_all'
  ) THEN
    CREATE POLICY "affiliate_payout_items_admin_all"
    ON public.affiliate_payout_items
    FOR ALL
    TO authenticated
    USING (check_is_admin())
    WITH CHECK (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
