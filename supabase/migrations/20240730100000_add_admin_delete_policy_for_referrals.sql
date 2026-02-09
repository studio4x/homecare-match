CREATE POLICY "Admins can delete referrals"
ON public.referrals
FOR DELETE
TO authenticated
USING (check_is_admin());