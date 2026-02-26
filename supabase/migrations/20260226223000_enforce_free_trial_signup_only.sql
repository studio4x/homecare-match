-- Ensure free_trial is granted only during profile creation (signup flow).

CREATE OR REPLACE FUNCTION public.enforce_free_trial_signup_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subscription_tier = 'free_trial'
     AND OLD.subscription_tier IS DISTINCT FROM 'free_trial' THEN
    RAISE EXCEPTION 'O plano free_trial so pode ser aplicado no cadastro inicial.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_trial_signup_only ON public.profiles;

CREATE TRIGGER trg_enforce_free_trial_signup_only
BEFORE UPDATE OF subscription_tier
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_free_trial_signup_only();
