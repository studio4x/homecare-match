-- Allow anonymous (public) users to read coupons that are marked as show_publicly.
-- This is needed so non-authenticated visitors can see the public coupon banner
-- on the landing page (pricing section).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'coupons'
      AND policyname = 'coupons_public_read_show_publicly'
  ) THEN
    CREATE POLICY coupons_public_read_show_publicly
      ON public.coupons
      FOR SELECT
      TO anon, authenticated
      USING (show_publicly = true AND is_active = true);
  END IF;
END
$$;
