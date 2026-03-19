-- Ensure affiliate partner is removed when linked user profile is deleted

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'affiliate_partners_user_id_fkey'
      AND conrelid = 'public.affiliate_partners'::regclass
  ) THEN
    ALTER TABLE public.affiliate_partners
      DROP CONSTRAINT affiliate_partners_user_id_fkey;
  END IF;
END
$$;

ALTER TABLE public.affiliate_partners
  ADD CONSTRAINT affiliate_partners_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

-- Remove legacy orphan partners that should always be linked to a platform user
DELETE FROM public.affiliate_partners
WHERE user_id IS NULL
  AND COALESCE(is_external, false) = false;

NOTIFY pgrst, 'reload schema';

