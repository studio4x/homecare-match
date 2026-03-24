-- Create Onboarding System Settings Table
CREATE TABLE IF NOT EXISTS public.onboarding_system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.onboarding_system_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read for admins onboarding_settings" 
    ON public.onboarding_system_settings FOR SELECT 
    TO authenticated 
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));

CREATE POLICY "Enable mod for admins onboarding_settings" 
    ON public.onboarding_system_settings FOR ALL 
    TO authenticated 
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.is_admin = true)));

-- Seed default value (OFF by default)
INSERT INTO public.onboarding_system_settings (setting_key, setting_value)
VALUES ('is_system_active', '{"enabled": false}')
ON CONFLICT (setting_key) DO NOTHING;
