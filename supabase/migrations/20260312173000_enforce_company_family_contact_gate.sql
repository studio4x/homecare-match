CREATE OR REPLACE FUNCTION public.enforce_company_family_contact_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_profile public.profiles%ROWTYPE;
  missing_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NEW.sender_id IS NULL OR NEW.professional_id IS NULL OR NEW.sender_id = NEW.professional_id THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO sender_profile
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível validar o perfil do remetente.'
      USING ERRCODE = 'P0001';
  END IF;

  IF sender_profile.role NOT IN ('company', 'family') THEN
    RETURN NEW;
  END IF;

  IF sender_profile.avatar_url IS NULL OR btrim(sender_profile.avatar_url) = '' THEN
    missing_fields := array_append(missing_fields, 'Foto');
  END IF;
  IF sender_profile.full_name IS NULL OR btrim(sender_profile.full_name) = '' THEN
    missing_fields := array_append(missing_fields, 'Nome');
  END IF;
  IF sender_profile.phone IS NULL OR btrim(sender_profile.phone) = '' THEN
    missing_fields := array_append(missing_fields, 'WhatsApp');
  END IF;
  IF sender_profile.neighborhood IS NULL OR btrim(sender_profile.neighborhood) = '' THEN
    missing_fields := array_append(missing_fields, 'Bairro');
  END IF;
  IF sender_profile.city IS NULL OR btrim(sender_profile.city) = '' THEN
    missing_fields := array_append(missing_fields, 'Cidade');
  END IF;
  IF sender_profile.state IS NULL OR btrim(sender_profile.state) = '' THEN
    missing_fields := array_append(missing_fields, 'Estado');
  END IF;

  IF sender_profile.role = 'company' THEN
    IF sender_profile.company_name IS NULL OR btrim(sender_profile.company_name) = '' THEN
      missing_fields := array_append(missing_fields, 'Razão Social');
    END IF;
    IF sender_profile.cnpj IS NULL OR btrim(sender_profile.cnpj) = '' THEN
      missing_fields := array_append(missing_fields, 'CNPJ');
    END IF;
    IF sender_profile.bio IS NULL OR btrim(sender_profile.bio) = '' THEN
      missing_fields := array_append(missing_fields, 'Descrição da Empresa');
    END IF;
  END IF;

  IF sender_profile.role = 'family' THEN
    IF sender_profile.patient_name IS NULL OR btrim(sender_profile.patient_name) = '' THEN
      missing_fields := array_append(missing_fields, 'Nome do Paciente');
    END IF;
    IF sender_profile.patient_age IS NULL THEN
      missing_fields := array_append(missing_fields, 'Idade do Paciente');
    END IF;
    IF sender_profile.patient_medical_conditions IS NULL OR btrim(sender_profile.patient_medical_conditions) = '' THEN
      missing_fields := array_append(missing_fields, 'Condição Médica');
    END IF;
    IF sender_profile.bio IS NULL OR btrim(sender_profile.bio) = '' THEN
      missing_fields := array_append(missing_fields, 'Outras Observações');
    END IF;
    IF COALESCE(array_length(sender_profile.availability, 1), 0) = 0 THEN
      missing_fields := array_append(missing_fields, 'Horário de Atendimento');
    END IF;
  END IF;

  IF COALESCE(array_length(missing_fields, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Perfil incompleto. Complete: %.', array_to_string(missing_fields, ', ')
      USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(sender_profile.is_verified, FALSE) = FALSE THEN
    RAISE EXCEPTION 'Documentos ainda não validados. Aguarde aprovação para adicionar contatos.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_company_family_contact_gate ON public.interactions;

CREATE TRIGGER trg_enforce_company_family_contact_gate
BEFORE INSERT ON public.interactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_company_family_contact_gate();

NOTIFY pgrst, 'reload schema';
