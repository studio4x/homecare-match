-- Make columns nullable in user_onboarding_step_runs to allow logging manual tests
ALTER TABLE public.user_onboarding_step_runs 
ALTER COLUMN user_onboarding_flow_id DROP NOT NULL,
ALTER COLUMN flow_id DROP NOT NULL,
ALTER COLUMN step_id DROP NOT NULL,
ALTER COLUMN step_order DROP NOT NULL;
