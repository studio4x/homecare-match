ALTER TABLE public.academy_courses
  ADD COLUMN IF NOT EXISTS external_course_id TEXT;

UPDATE public.academy_courses
SET external_course_id = slug
WHERE external_course_id IS NULL OR btrim(external_course_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_courses_external_course_id
  ON public.academy_courses (external_course_id)
  WHERE external_course_id IS NOT NULL AND btrim(external_course_id) <> '';

CREATE TABLE IF NOT EXISTS public.academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS academy_enrollments_user_course_key
  ON public.academy_enrollments (user_id, course_slug);

ALTER TABLE public.academy_enrollments
  ADD COLUMN IF NOT EXISTS access_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS release_source TEXT,
  ADD COLUMN IF NOT EXISTS external_reference_id TEXT,
  ADD COLUMN IF NOT EXISTS lms_progress_percent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lms_is_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lms_approval_status TEXT NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS lms_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lms_last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_academy_enrollments_access_status
  ON public.academy_enrollments (access_status);

CREATE TABLE IF NOT EXISTS public.lms_integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  event_type TEXT,
  external_user_id TEXT,
  external_course_id TEXT,
  http_status INTEGER,
  status TEXT NOT NULL CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lms_integration_logs_request_direction_key UNIQUE (request_id, direction)
);

CREATE INDEX IF NOT EXISTS idx_lms_integration_logs_direction_created
  ON public.lms_integration_logs (direction, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lms_integration_logs_user_course
  ON public.lms_integration_logs (external_user_id, external_course_id);

ALTER TABLE public.lms_integration_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lms_integration_logs'
      AND policyname = 'Admins can read LMS integration logs'
  ) THEN
    CREATE POLICY "Admins can read LMS integration logs"
      ON public.lms_integration_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND (profiles.is_admin = true OR profiles.role = 'admin')
        )
      );
  END IF;
END $$;
