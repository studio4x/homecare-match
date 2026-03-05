-- Allow admins to apply free_trial from admin panel.

CREATE OR REPLACE FUNCTION public.enforce_free_trial_signup_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_is_admin BOOLEAN := false;
BEGIN
  IF NEW.subscription_tier = 'free_trial'
     AND OLD.subscription_tier IS DISTINCT FROM 'free_trial' THEN
    SELECT COALESCE(is_admin, false) OR COALESCE(role = 'admin', false)
      INTO actor_is_admin
      FROM public.profiles
     WHERE id = auth.uid();

    IF NOT COALESCE(actor_is_admin, false) THEN
      RAISE EXCEPTION 'O plano free_trial so pode ser aplicado no cadastro inicial ou por administradores.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
