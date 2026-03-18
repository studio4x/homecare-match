DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_commercial_clicks'
      AND policyname = 'whatsapp_commercial_clicks_admin_delete'
  ) THEN
    CREATE POLICY "whatsapp_commercial_clicks_admin_delete"
    ON public.whatsapp_commercial_clicks
    FOR DELETE TO authenticated
    USING (check_is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
