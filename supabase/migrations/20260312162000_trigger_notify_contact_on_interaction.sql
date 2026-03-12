CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.enqueue_notify_contact_from_interactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_id IS NULL OR NEW.professional_id IS NULL OR NEW.sender_id = NEW.professional_id THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := (SELECT current_setting('app.settings.supabase_url', true)) || '/functions/v1/notify-contact',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT current_setting('app.settings.service_role_key', true))
    ),
    body := jsonb_build_object(
      'professional_id', NEW.professional_id,
      'sender_id', NEW.sender_id,
      'interaction_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_contact_on_interaction ON public.interactions;

CREATE TRIGGER trg_notify_contact_on_interaction
AFTER INSERT ON public.interactions
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_notify_contact_from_interactions();

NOTIFY pgrst, 'reload schema';

