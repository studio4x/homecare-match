CREATE OR REPLACE FUNCTION public.enqueue_notify_contact_from_interactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  auth_header TEXT;
BEGIN
  IF NEW.sender_id IS NULL OR NEW.professional_id IS NULL OR NEW.sender_id = NEW.professional_id THEN
    RETURN NEW;
  END IF;

  supabase_url := COALESCE(
    NULLIF(current_setting('app.settings.supabase_url', true), ''),
    'https://rkjvtnadqkbwomgzyswr.supabase.co'
  );

  service_role_key := NULLIF(current_setting('app.settings.service_role_key', true), '');
  auth_header := CASE
    WHEN service_role_key IS NOT NULL THEN 'Bearer ' || service_role_key
    ELSE NULL
  END;

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/notify-contact',
      headers := jsonb_strip_nulls(
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', auth_header
        )
      ),
      body := jsonb_build_object(
        'professional_id', NEW.professional_id,
        'sender_id', NEW.sender_id,
        'interaction_id', NEW.id
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '[enqueue_notify_contact_from_interactions] erro ao enfileirar notify-contact: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

