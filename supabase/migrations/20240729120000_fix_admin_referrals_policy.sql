-- Drop the faulty policy
DROP POLICY IF EXISTS "Admins can view all referrals" ON public.referrals;

-- Recreate the policy using a more robust admin check function
CREATE POLICY "Admins can view all referrals"
ON public.referrals
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));