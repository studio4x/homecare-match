INSERT INTO public.site_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE IF EXISTS public.site_config
  ADD COLUMN IF NOT EXISTS support_sla_config JSONB,
  ADD COLUMN IF NOT EXISTS support_business_hours_config JSONB,
  ADD COLUMN IF NOT EXISTS crisis_protocol_config JSONB;

UPDATE public.site_config
SET
  support_sla_config = COALESCE(
    support_sla_config,
    '{
      "categories": [
        { "key": "payment", "label": "Pagamentos", "first_response_hours": 2, "position": 1, "description": "Primeira resposta em ate 2 horas uteis." },
        { "key": "technical", "label": "Problema tecnico", "first_response_hours": 24, "position": 2, "description": "Primeira resposta em ate 24 horas uteis." },
        { "key": "account", "label": "Conta e acesso", "first_response_hours": 24, "position": 3, "description": "Primeira resposta em ate 24 horas uteis." },
        { "key": "general", "label": "Duvida geral", "first_response_hours": 24, "position": 4, "description": "Primeira resposta em ate 24 horas uteis." }
      ],
      "public_note": "Os prazos acima se referem ao tempo da primeira resposta humana da equipe. Nao representam prazo de resolucao final."
    }'::jsonb
  ),
  support_business_hours_config = COALESCE(
    support_business_hours_config,
    '{
      "timezone": "America/Sao_Paulo",
      "days_of_week": [1, 2, 3, 4, 5],
      "start_hour": 8,
      "end_hour": 18
    }'::jsonb
  ),
  crisis_protocol_config = COALESCE(
    crisis_protocol_config,
    '{
      "triage_checklist": [
        "Receber o relato e registrar data, hora, IDs envolvidos e canal de entrada.",
        "Classificar a severidade inicial com base em risco a vida, indicios de crime, fraude ou repercussao publica.",
        "Preservar evidencias disponiveis antes de qualquer contato externo."
      ],
      "escalation_criteria": [
        "Elevar imediatamente para nivel critico quando houver risco a integridade fisica, abuso, violencia, fraude relevante ou indicio criminal.",
        "Escalar para juridico/compliance quando houver pedido formal, ameaca de litigio, imprensa ou autoridade publica."
      ],
      "evidence_preservation": [
        "Preservar tickets, mensagens, anexos, denuncias, logs administrativos e notificacoes relacionadas.",
        "Evitar exclusao ou alteracao de registros ate conclusao da triagem."
      ],
      "safety_hold_flow": [
        "Aplicar suspensao cautelar manual quando a triagem indicar risco atual para usuarios ou para a plataforma.",
        "Registrar motivo, responsavel e data da medida no perfil e na denuncia."
      ],
      "complainant_communication": [
        "Confirmar recebimento do relato com linguagem objetiva e sem prometer conclusao antecipada.",
        "Informar que a plataforma pode solicitar evidencias adicionais e que medidas internas poderao ser adotadas."
      ],
      "media_holding_statement": "Estamos apurando os fatos com prioridade, preservando os registros relevantes e colaborando com as autoridades competentes quando aplicavel.",
      "contacts": [
        { "role": "Operacao", "name": "", "email": "", "phone": "" },
        { "role": "Juridico/Compliance", "name": "", "email": "", "phone": "" },
        { "role": "Porta-voz", "name": "", "email": "", "phone": "" }
      ]
    }'::jsonb
  )
WHERE id = 1;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS account_status_reason TEXT,
  ADD COLUMN IF NOT EXISTS account_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_status_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.profiles
SET account_status = COALESCE(NULLIF(account_status, ''), 'active')
WHERE account_status IS NULL OR account_status = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_account_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active', 'under_review', 'suspended'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles (account_status);

ALTER TABLE IF EXISTS public.support_tickets
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_policy_key TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS sla_status TEXT NOT NULL DEFAULT 'on_time';

UPDATE public.support_tickets
SET
  category = COALESCE(NULLIF(category, ''), 'general'),
  sla_policy_key = COALESCE(NULLIF(sla_policy_key, ''), COALESCE(NULLIF(category, ''), 'general')),
  sla_status = COALESCE(NULLIF(sla_status, ''), 'on_time')
WHERE category IS NULL
   OR category = ''
   OR sla_policy_key IS NULL
   OR sla_policy_key = ''
   OR sla_status IS NULL
   OR sla_status = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'support_tickets_category_check'
      AND conrelid = 'public.support_tickets'::regclass
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_category_check
      CHECK (category IN ('payment', 'technical', 'account', 'general'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'support_tickets_sla_status_check'
      AND conrelid = 'public.support_tickets'::regclass
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_sla_status_check
      CHECK (sla_status IN ('on_time', 'at_risk', 'overdue', 'answered'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_support_tickets_category
  ON public.support_tickets (category);

CREATE INDEX IF NOT EXISTS idx_support_tickets_due_status
  ON public.support_tickets (status, sla_status, first_response_due_at);

CREATE INDEX IF NOT EXISTS idx_support_tickets_first_response_due
  ON public.support_tickets (first_response_due_at);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.reports
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS triage_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS triaged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linked_ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS safety_hold_applied BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS safety_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS safety_hold_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS safety_hold_at TIMESTAMPTZ;

UPDATE public.reports
SET
  severity = COALESCE(NULLIF(severity, ''), 'medium'),
  triage_status = COALESCE(NULLIF(triage_status, ''), COALESCE(NULLIF(status, ''), 'pending'))
WHERE severity IS NULL
   OR severity = ''
   OR triage_status IS NULL
   OR triage_status = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_severity_check'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_severity_check
      CHECK (severity IN ('low', 'medium', 'high', 'critical'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_triage_status_check'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_triage_status_check
      CHECK (triage_status IN ('pending', 'under_review', 'escalated', 'resolved', 'dismissed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_reports_triage_status
  ON public.reports (triage_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_severity
  ON public.reports (severity, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_support_business_hours_config()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT support_business_hours_config
    INTO v_config
  FROM public.site_config
  WHERE id = 1;

  RETURN COALESCE(
    v_config,
    '{
      "timezone": "America/Sao_Paulo",
      "days_of_week": [1, 2, 3, 4, 5],
      "start_hour": 8,
      "end_hour": 18
    }'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_support_sla_config()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT support_sla_config
    INTO v_config
  FROM public.site_config
  WHERE id = 1;

  RETURN COALESCE(
    v_config,
    '{
      "categories": [
        { "key": "payment", "label": "Pagamentos", "first_response_hours": 2, "position": 1, "description": "Primeira resposta em ate 2 horas uteis." },
        { "key": "technical", "label": "Problema tecnico", "first_response_hours": 24, "position": 2, "description": "Primeira resposta em ate 24 horas uteis." },
        { "key": "account", "label": "Conta e acesso", "first_response_hours": 24, "position": 3, "description": "Primeira resposta em ate 24 horas uteis." },
        { "key": "general", "label": "Duvida geral", "first_response_hours": 24, "position": 4, "description": "Primeira resposta em ate 24 horas uteis." }
      ],
      "public_note": "Os prazos acima se referem ao tempo da primeira resposta humana da equipe. Nao representam prazo de resolucao final."
    }'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_support_sla_target_hours(p_category TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_config JSONB := public.get_support_sla_config();
  v_hours INTEGER;
  v_category TEXT := COALESCE(NULLIF(lower(trim(p_category)), ''), 'general');
BEGIN
  SELECT COALESCE((entry ->> 'first_response_hours')::INTEGER, 24)
    INTO v_hours
  FROM jsonb_array_elements(COALESCE(v_config -> 'categories', '[]'::jsonb)) AS entry
  WHERE lower(COALESCE(entry ->> 'key', '')) = v_category
  ORDER BY COALESCE((entry ->> 'position')::INTEGER, 999)
  LIMIT 1;

  IF v_hours IS NULL THEN
    SELECT COALESCE((entry ->> 'first_response_hours')::INTEGER, 24)
      INTO v_hours
    FROM jsonb_array_elements(COALESCE(v_config -> 'categories', '[]'::jsonb)) AS entry
    WHERE lower(COALESCE(entry ->> 'key', '')) = 'general'
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_hours, 24);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_support_business_minute(
  p_local_timestamp TIMESTAMP,
  p_config JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_days INTEGER[] := ARRAY(
    SELECT jsonb_array_elements_text(COALESCE(p_config -> 'days_of_week', '[1,2,3,4,5]'::jsonb))::INTEGER
  );
  v_start_hour INTEGER := COALESCE((p_config ->> 'start_hour')::INTEGER, 8);
  v_end_hour INTEGER := COALESCE((p_config ->> 'end_hour')::INTEGER, 18);
  v_isodow INTEGER := EXTRACT(ISODOW FROM p_local_timestamp)::INTEGER;
  v_time TIME := p_local_timestamp::TIME;
BEGIN
  IF NOT (v_isodow = ANY(v_days)) THEN
    RETURN FALSE;
  END IF;

  RETURN v_time >= make_time(v_start_hour, 0, 0)
     AND v_time < make_time(v_end_hour, 0, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.align_support_business_start(
  p_local_timestamp TIMESTAMP,
  p_config JSONB
)
RETURNS TIMESTAMP
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_candidate TIMESTAMP := date_trunc('minute', p_local_timestamp);
  v_days INTEGER[] := ARRAY(
    SELECT jsonb_array_elements_text(COALESCE(p_config -> 'days_of_week', '[1,2,3,4,5]'::jsonb))::INTEGER
  );
  v_start_hour INTEGER := COALESCE((p_config ->> 'start_hour')::INTEGER, 8);
  v_end_hour INTEGER := COALESCE((p_config ->> 'end_hour')::INTEGER, 18);
  v_isodow INTEGER;
  v_start_time TIME := make_time(v_start_hour, 0, 0);
  v_end_time TIME := make_time(v_end_hour, 0, 0);
BEGIN
  LOOP
    v_isodow := EXTRACT(ISODOW FROM v_candidate)::INTEGER;

    IF NOT (v_isodow = ANY(v_days)) THEN
      v_candidate := date_trunc('day', v_candidate + INTERVAL '1 day') + v_start_time;
      CONTINUE;
    END IF;

    IF v_candidate::TIME < v_start_time THEN
      v_candidate := date_trunc('day', v_candidate) + v_start_time;
      EXIT;
    END IF;

    IF v_candidate::TIME >= v_end_time THEN
      v_candidate := date_trunc('day', v_candidate + INTERVAL '1 day') + v_start_time;
      CONTINUE;
    END IF;

    EXIT;
  END LOOP;

  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_support_business_minutes(
  p_start_at TIMESTAMPTZ,
  p_minutes INTEGER,
  p_config JSONB
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_timezone TEXT := COALESCE(NULLIF(p_config ->> 'timezone', ''), 'America/Sao_Paulo');
  v_remaining INTEGER := GREATEST(COALESCE(p_minutes, 0), 0);
  v_local TIMESTAMP := public.align_support_business_start(p_start_at AT TIME ZONE v_timezone, p_config);
BEGIN
  IF v_remaining = 0 THEN
    RETURN v_local AT TIME ZONE v_timezone;
  END IF;

  WHILE v_remaining > 0 LOOP
    v_local := v_local + INTERVAL '1 minute';

    IF public.is_support_business_minute(v_local, p_config) THEN
      v_remaining := v_remaining - 1;
    END IF;
  END LOOP;

  RETURN v_local AT TIME ZONE v_timezone;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_support_sla_status(
  p_created_at TIMESTAMPTZ,
  p_due_at TIMESTAMPTZ,
  p_first_response_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_total_window INTERVAL;
  v_warning_window INTERVAL;
BEGIN
  IF p_first_response_at IS NOT NULL THEN
    RETURN 'answered';
  END IF;

  IF p_due_at IS NULL THEN
    RETURN 'on_time';
  END IF;

  IF v_now > p_due_at THEN
    RETURN 'overdue';
  END IF;

  v_total_window := COALESCE(p_due_at - p_created_at, INTERVAL '0 minute');
  v_warning_window := LEAST(GREATEST(v_total_window / 4, INTERVAL '30 minutes'), INTERVAL '6 hours');

  IF v_now >= (p_due_at - v_warning_window) THEN
    RETURN 'at_risk';
  END IF;

  RETURN 'on_time';
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_support_ticket_sla_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_category TEXT := COALESCE(NULLIF(lower(trim(NEW.category)), ''), 'general');
  v_hours INTEGER;
  v_business_config JSONB := public.get_support_business_hours_config();
BEGIN
  NEW.category := v_category;
  NEW.sla_policy_key := COALESCE(NULLIF(lower(trim(NEW.sla_policy_key)), ''), v_category);
  v_hours := public.get_support_sla_target_hours(NEW.sla_policy_key);

  IF TG_OP = 'INSERT'
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.sla_policy_key IS DISTINCT FROM OLD.sla_policy_key
     OR NEW.first_response_due_at IS NULL THEN
    NEW.first_response_due_at := public.add_support_business_minutes(
      COALESCE(NEW.created_at, NOW()),
      v_hours * 60,
      v_business_config
    );
  END IF;

  NEW.sla_status := public.compute_support_sla_status(
    COALESCE(NEW.created_at, NOW()),
    NEW.first_response_due_at,
    NEW.first_response_at
  );
  NEW.updated_at := COALESCE(NEW.updated_at, NOW());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_sla_fields
  ON public.support_tickets;

CREATE TRIGGER trg_support_ticket_sla_fields
BEFORE INSERT OR UPDATE OF category, created_at, first_response_at, sla_policy_key, first_response_due_at
ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.apply_support_ticket_sla_fields();

CREATE OR REPLACE FUNCTION public.mark_support_first_admin_response()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  SELECT COALESCE(is_admin, FALSE) OR role = 'admin'
    INTO v_is_admin
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF v_is_admin THEN
    UPDATE public.support_tickets
    SET
      first_response_at = COALESCE(first_response_at, NEW.created_at),
      sla_status = 'answered',
      updated_at = NEW.created_at
    WHERE id = NEW.ticket_id;
  ELSE
    UPDATE public.support_tickets
    SET updated_at = NEW.created_at
    WHERE id = NEW.ticket_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_first_admin_response
  ON public.support_messages;

CREATE TRIGGER trg_support_first_admin_response
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.mark_support_first_admin_response();

UPDATE public.support_tickets
SET
  category = COALESCE(NULLIF(category, ''), 'general'),
  sla_policy_key = COALESCE(NULLIF(sla_policy_key, ''), COALESCE(NULLIF(category, ''), 'general'));

WITH first_admin_responses AS (
  SELECT
    sm.ticket_id,
    MIN(sm.created_at) AS first_response_at
  FROM public.support_messages sm
  JOIN public.profiles p
    ON p.id = sm.sender_id
  WHERE COALESCE(p.is_admin, FALSE) = TRUE
     OR p.role = 'admin'
  GROUP BY sm.ticket_id
)
UPDATE public.support_tickets t
SET first_response_at = fa.first_response_at
FROM first_admin_responses fa
WHERE fa.ticket_id = t.id
  AND (t.first_response_at IS NULL OR fa.first_response_at < t.first_response_at);

UPDATE public.support_tickets
SET sla_status = public.compute_support_sla_status(created_at, first_response_due_at, first_response_at);

DROP VIEW IF EXISTS public.professional_discovery;

CREATE VIEW public.professional_discovery AS
SELECT
  id,
  full_name,
  avatar_url,
  specialty,
  city,
  state,
  neighborhood,
  experience,
  professional_experiences,
  bio,
  is_verified,
  subscription_tier,
  subscription_end_at,
  cancel_at_period_end,
  role,
  lat,
  lng,
  referral_count,
  updated_at,
  trial_started_at,
  is_hidden,
  account_status
FROM public.profiles
WHERE role = 'professional'
  AND full_name IS NOT NULL
  AND email_confirmed = TRUE
  AND is_hidden = FALSE
  AND account_status = 'active';

GRANT SELECT ON public.professional_discovery TO authenticated;
GRANT SELECT ON public.professional_discovery TO anon;

NOTIFY pgrst, 'reload schema';
