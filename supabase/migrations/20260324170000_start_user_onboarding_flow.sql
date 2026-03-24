-- Function to manually start onboarding flow for an existing user
CREATE OR REPLACE FUNCTION public.start_user_onboarding_flow(
  p_user_id UUID,
  p_flow_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_flow_id UUID := p_flow_id;
  v_audience_type TEXT;
  v_first_step RECORD;
  v_instance_id UUID;
  v_existing_id UUID;
  v_user_role TEXT;
BEGIN
  -- 1. Validar usuário e obter role
  SELECT role INTO v_user_role FROM public.profiles WHERE id = p_user_id;
  
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  IF v_user_role != 'professional' THEN
    RAISE EXCEPTION 'Apenas usuários com perfil "professional" podem ser adicionados a este fluxo.';
  END IF;

  -- 2. Identificar o fluxo se não fornecido
  IF v_flow_id IS NULL THEN
    SELECT id INTO v_flow_id 
    FROM public.onboarding_email_flows 
    WHERE audience_type = 'professional' AND is_active = true 
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_flow_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum fluxo de onboarding ativo encontrado para profissionais.';
  END IF;

  -- 3. Verificar duplicidade de fluxo ativo
  SELECT id INTO v_existing_id 
  FROM public.user_onboarding_flows 
  WHERE user_id = p_user_id AND flow_id = v_flow_id AND status = 'active'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este profissional já está em um fluxo ativo.';
  END IF;

  -- 4. Obter o primeiro passo
  SELECT * INTO v_first_step 
  FROM public.onboarding_email_steps 
  WHERE flow_id = v_flow_id AND step_order = 1 AND is_active = true
  LIMIT 1;

  IF v_first_step.id IS NULL THEN
    RAISE EXCEPTION 'O fluxo selecionado não possui um primeiro passo (step_order = 1) ativo.';
  END IF;

  -- 5. Inserir a nova instância
  INSERT INTO public.user_onboarding_flows (
    user_id, 
    flow_id, 
    audience_type, 
    status, 
    current_step_order, 
    next_run_at,
    started_at
  ) VALUES (
    p_user_id, 
    v_flow_id, 
    'professional', 
    'active', 
    1, 
    now() + (v_first_step.wait_after_previous_hours || ' hours')::interval,
    now()
  ) RETURNING id INTO v_instance_id;

  RETURN v_instance_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
