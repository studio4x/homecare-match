-- Function to start onboarding flow for new professionals
CREATE OR REPLACE FUNCTION public.handle_professional_onboarding_start()
RETURNS trigger AS $$
DECLARE
  v_flow_id UUID;
  v_first_step RECORD;
BEGIN
  -- Verificar se e um profissional
  IF NEW.role = 'professional' THEN
      -- Procurar o fluxo ativo para professionals
      SELECT id INTO v_flow_id 
      FROM public.onboarding_email_flows 
      WHERE audience_type = 'professional' AND is_active = true 
      ORDER BY created_at DESC LIMIT 1;
      
      IF v_flow_id IS NOT NULL THEN
        -- Obter o primeiro passo (step_order = 1) e seu wait_after_previous_hours
        SELECT * INTO v_first_step 
        FROM public.onboarding_email_steps 
        WHERE flow_id = v_flow_id AND step_order = 1 AND is_active = true
        LIMIT 1;
        
        IF v_first_step.id IS NOT NULL THEN
            INSERT INTO public.user_onboarding_flows (
              user_id, flow_id, audience_type, status, current_step_order, next_run_at
            ) VALUES (
              NEW.id, v_flow_id, 'professional', 'active', 1, 
              now() + (v_first_step.wait_after_previous_hours || ' hours')::interval
            );
        END IF;
      END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_professional_profile_created ON public.profiles;
CREATE TRIGGER on_professional_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_professional_onboarding_start();
