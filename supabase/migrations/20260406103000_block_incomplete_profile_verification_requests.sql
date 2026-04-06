CREATE OR REPLACE FUNCTION public.enforce_profile_completion_before_verification_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  missing_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF COALESCE(NEW.verification_sent, FALSE) = TRUE
     AND COALESCE(OLD.verification_sent, FALSE) = FALSE THEN

    IF NEW.avatar_url IS NULL OR btrim(NEW.avatar_url) = '' THEN
      missing_fields := array_append(missing_fields, 'Foto');
    END IF;
    IF NEW.full_name IS NULL OR btrim(NEW.full_name) = '' THEN
      missing_fields := array_append(missing_fields, 'Nome');
    END IF;
    IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
      missing_fields := array_append(missing_fields, 'WhatsApp');
    END IF;
    IF NEW.neighborhood IS NULL OR btrim(NEW.neighborhood) = '' THEN
      missing_fields := array_append(missing_fields, 'Bairro');
    END IF;
    IF NEW.city IS NULL OR btrim(NEW.city) = '' THEN
      missing_fields := array_append(missing_fields, 'Cidade');
    END IF;
    IF NEW.state IS NULL OR btrim(NEW.state) = '' THEN
      missing_fields := array_append(missing_fields, 'Estado');
    END IF;

    IF NEW.role = 'professional' THEN
      IF NEW.specialty IS NULL OR btrim(NEW.specialty) = '' THEN
        missing_fields := array_append(missing_fields, 'Especialidade');
      END IF;
      IF NEW.registration IS NULL OR btrim(NEW.registration) = '' THEN
        missing_fields := array_append(missing_fields, 'Registro');
      END IF;
      IF NEW.experience IS NULL OR btrim(NEW.experience) = '' THEN
        missing_fields := array_append(missing_fields, 'Formações');
      END IF;
      IF NEW.bio IS NULL OR btrim(NEW.bio) = '' THEN
        missing_fields := array_append(missing_fields, 'Biografia');
      END IF;
    ELSIF NEW.role = 'company' THEN
      IF NEW.company_name IS NULL OR btrim(NEW.company_name) = '' THEN
        missing_fields := array_append(missing_fields, 'Razão Social');
      END IF;
      IF NEW.cnpj IS NULL OR btrim(NEW.cnpj) = '' THEN
        missing_fields := array_append(missing_fields, 'CNPJ');
      END IF;
      IF NEW.bio IS NULL OR btrim(NEW.bio) = '' THEN
        missing_fields := array_append(missing_fields, 'Descrição da Empresa');
      END IF;
    ELSIF NEW.role = 'family' THEN
      IF NEW.patient_name IS NULL OR btrim(NEW.patient_name) = '' THEN
        missing_fields := array_append(missing_fields, 'Nome do Paciente');
      END IF;
      IF NEW.patient_age IS NULL THEN
        missing_fields := array_append(missing_fields, 'Idade do Paciente');
      END IF;
      IF NEW.patient_medical_conditions IS NULL OR btrim(NEW.patient_medical_conditions) = '' THEN
        missing_fields := array_append(missing_fields, 'Condição Médica');
      END IF;
      IF NEW.bio IS NULL OR btrim(NEW.bio) = '' THEN
        missing_fields := array_append(missing_fields, 'Outras Observações');
      END IF;
      IF COALESCE(array_length(NEW.availability, 1), 0) = 0 THEN
        missing_fields := array_append(missing_fields, 'Horário de Atendimento');
      END IF;
    END IF;

    IF COALESCE(array_length(missing_fields, 1), 0) > 0 THEN
      RAISE EXCEPTION 'Perfil incompleto. Complete antes de enviar documentos: %.', array_to_string(missing_fields, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_completion_before_verification_request ON public.profiles;

CREATE TRIGGER trg_enforce_profile_completion_before_verification_request
BEFORE UPDATE OF verification_sent ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_completion_before_verification_request();

NOTIFY pgrst, 'reload schema';
