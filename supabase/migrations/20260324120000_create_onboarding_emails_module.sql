-- Create Email Templates Table
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    audience_type TEXT NOT NULL,
    subject TEXT,
    preview_text TEXT,
    html_content TEXT,
    text_content TEXT,
    email_type TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Onboarding Flows Table
CREATE TABLE public.onboarding_email_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    audience_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Onboarding Steps Table
CREATE TABLE public.onboarding_email_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES public.onboarding_email_flows(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.email_templates(id),
    step_order INTEGER NOT NULL,
    wait_after_previous_hours INTEGER NOT NULL DEFAULT 0,
    send_type TEXT NOT NULL CHECK (send_type IN ('always', 'conditional')),
    condition_type TEXT,
    condition_config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(flow_id, step_order)
);

-- Create User Onboarding Flows (Instances) Table
CREATE TABLE public.user_onboarding_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES public.onboarding_email_flows(id) ON DELETE CASCADE,
    audience_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'paused')),
    current_step_order INTEGER NOT NULL DEFAULT 1,
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_processed_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, flow_id)
);

-- Create User Onboarding Step Runs (Logs/History) Table
CREATE TABLE public.user_onboarding_step_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_onboarding_flow_id UUID NOT NULL REFERENCES public.user_onboarding_flows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES public.onboarding_email_flows(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES public.onboarding_email_steps(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.email_templates(id),
    step_order INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed', 'pending')),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    attempt_count INTEGER DEFAULT 0,
    error_message TEXT,
    provider_message_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS setup (allow admins to access all, and service role will bypass RLS)
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_email_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_email_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding_step_runs ENABLE ROW LEVEL SECURITY;

-- Exemplo de policy genérica. Acesso via interface gráfica será majoritariamente 
-- feito via Edge Functions (Service Role tem acesso total por padrão) ou 
-- exigirá que o usuário autenticado tenha permissão de admin.
CREATE POLICY "Enable read access for authenticated admins" ON public.email_templates
    FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));

CREATE POLICY "Enable insert access for authenticated admins" ON public.email_templates
    FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));

CREATE POLICY "Enable update access for authenticated admins" ON public.email_templates
    FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));

-- Para as demais tabelas usamos a mesma lógica
CREATE POLICY "Enable read for admins onboarding_flows" ON public.onboarding_email_flows FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));
CREATE POLICY "Enable mod for admins onboarding_flows" ON public.onboarding_email_flows FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));

CREATE POLICY "Enable read for admins onboarding_steps" ON public.onboarding_email_steps FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));
CREATE POLICY "Enable mod for admins onboarding_steps" ON public.onboarding_email_steps FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));

CREATE POLICY "Enable read for admins and owners user_onboarding_flows" ON public.user_onboarding_flows FOR SELECT TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));
CREATE POLICY "Enable mod for admins user_onboarding_flows" ON public.user_onboarding_flows FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));

CREATE POLICY "Enable read for admins and owners user_onboarding_step_runs" ON public.user_onboarding_step_runs FOR SELECT TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));
CREATE POLICY "Enable mod for admins user_onboarding_step_runs" ON public.user_onboarding_step_runs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));
