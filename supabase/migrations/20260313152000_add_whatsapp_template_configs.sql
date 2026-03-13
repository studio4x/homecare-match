CREATE TABLE IF NOT EXISTS public.whatsapp_template_configs (
  event_type TEXT PRIMARY KEY,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('user', 'admin')),
  label TEXT NOT NULL,
  template_name TEXT NOT NULL,
  sample_message TEXT NOT NULL,
  var1_default TEXT,
  var2_default TEXT,
  var3_default TEXT,
  variations JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_template_configs_target_kind
  ON public.whatsapp_template_configs (target_kind, event_type);

ALTER TABLE public.whatsapp_template_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_template_configs'
      AND policyname = 'whatsapp_template_configs_admin_read'
  ) THEN
    CREATE POLICY "whatsapp_template_configs_admin_read"
      ON public.whatsapp_template_configs
      FOR SELECT
      TO authenticated
      USING (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_template_configs'
      AND policyname = 'whatsapp_template_configs_admin_upsert'
  ) THEN
    CREATE POLICY "whatsapp_template_configs_admin_upsert"
      ON public.whatsapp_template_configs
      FOR INSERT
      TO authenticated
      WITH CHECK (check_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_template_configs'
      AND policyname = 'whatsapp_template_configs_admin_update'
  ) THEN
    CREATE POLICY "whatsapp_template_configs_admin_update"
      ON public.whatsapp_template_configs
      FOR UPDATE
      TO authenticated
      USING (check_is_admin())
      WITH CHECK (check_is_admin());
  END IF;
END
$$;

INSERT INTO public.whatsapp_template_configs (
  event_type,
  target_kind,
  label,
  template_name,
  sample_message,
  var1_default,
  var2_default,
  var3_default,
  variations
)
VALUES
  (
    'new_contact_interest_user',
    'user',
    'Novo interesse no perfil (usuario)',
    'hcm_user_contact_interest',
    E'Novo interesse no seu perfil.\n\n{{1}} {{2}}.\n\nAcompanhe em: https://www.homecarematch.com.br{{3}}',
    'Empresa interessada',
    'demonstrou interesse no seu perfil',
    '/dashboard/contatos',
    jsonb_build_object(
      'action_text', 'demonstrou interesse no seu perfil',
      'cta_path', '/dashboard/contatos'
    )
  ),
  (
    'support_new_message_user',
    'user',
    'Suporte: nova resposta (usuario)',
    'hcm_user_support_update',
    E'Atualizacao do suporte HomeCare Match.\n\nSeu chamado "{{1}}" {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}',
    'Chamado',
    'recebeu nova resposta da equipe',
    '/dashboard/suporte/{ticket_id}',
    jsonb_build_object(
      'action_text', 'recebeu nova resposta da equipe',
      'cta_path_pattern', '/dashboard/suporte/{ticket_id}'
    )
  ),
  (
    'support_ticket_closed_user',
    'user',
    'Suporte: chamado encerrado (usuario)',
    'hcm_user_support_update',
    E'Atualizacao do suporte HomeCare Match.\n\nSeu chamado "{{1}}" {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}',
    'Chamado',
    'foi encerrado pela equipe',
    '/dashboard/suporte/{ticket_id}',
    jsonb_build_object(
      'action_text', 'foi encerrado pela equipe',
      'cta_path_pattern', '/dashboard/suporte/{ticket_id}'
    )
  ),
  (
    'verification_request_user_confirmation',
    'user',
    'Verificacao: solicitacao recebida (usuario)',
    'hcm_user_verification_update',
    E'Atualizacao de verificacao de perfil.\n\n{{1}}, {{2}}.\n\nDetalhes: {{3}}',
    'Usuario',
    'recebemos seus documentos para verificacao',
    '/dashboard/perfil',
    jsonb_build_object(
      'status_text', 'recebemos seus documentos para verificacao',
      'details_path', '/dashboard/perfil'
    )
  ),
  (
    'verification_approved_user',
    'user',
    'Verificacao: aprovada (usuario)',
    'hcm_user_verification_update',
    E'Atualizacao de verificacao de perfil.\n\n{{1}}, {{2}}.\n\nDetalhes: {{3}}',
    'Usuario',
    'sua verificacao foi aprovada',
    '/dashboard/perfil',
    jsonb_build_object(
      'status_text', 'sua verificacao foi aprovada',
      'details_path', '/dashboard/perfil'
    )
  ),
  (
    'verification_rejected_user',
    'user',
    'Verificacao: reprovada (usuario)',
    'hcm_user_verification_update',
    E'Atualizacao de verificacao de perfil.\n\n{{1}}, {{2}}.\n\nDetalhes: {{3}}',
    'Usuario',
    'sua verificacao foi reprovada',
    'nao informado',
    jsonb_build_object(
      'status_text', 'sua verificacao foi reprovada',
      'rejection_reason_fallback', 'nao informado'
    )
  ),
  (
    'subscription_renewal_reminder_user',
    'user',
    'Assinatura: lembrete de renovacao (usuario)',
    'hcm_user_subscription_reminder',
    E'Lembrete de assinatura HomeCare Match.\n\n{{1}}, {{2}}.\n\nAcompanhe em: https://www.homecarematch.com.br{{3}}',
    'Usuario',
    'Lembrete de assinatura',
    '/dashboard/pagamentos?renewalReminder={reminder_key}',
    jsonb_build_object(
      'monthly_due_title', 'Renovacao automatica hoje',
      'monthly_upcoming_title', 'Renovacao automatica proxima',
      'yearly_due_title', 'Plano anual vence hoje',
      'yearly_upcoming_title', 'Plano anual perto do vencimento',
      'details_path_pattern', '/dashboard/pagamentos?renewalReminder={reminder_key}'
    )
  ),
  (
    'verification_request_admin',
    'admin',
    'Verificacao pendente (admin)',
    'hcm_admin_notification',
    E'Alerta administrativo HomeCare Match.\n\n{{1}} {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}',
    'Profissional',
    'enviou documentos para verificacao',
    '/admin/verificacoes',
    jsonb_build_object(
      'status_text', 'enviou documentos para verificacao',
      'details_path', '/admin/verificacoes'
    )
  ),
  (
    'support_new_ticket_admin',
    'admin',
    'Suporte: novo ticket (admin)',
    'hcm_admin_notification',
    E'Alerta administrativo HomeCare Match.\n\n{{1}} abriu ticket "{{2}}".\n\nAcesse: https://www.homecarematch.com.br{{3}}',
    'Usuario',
    'Chamado',
    '/admin/suporte/{ticket_id}',
    jsonb_build_object(
      'cta_path_pattern', '/admin/suporte/{ticket_id}'
    )
  ),
  (
    'support_new_message_admin',
    'admin',
    'Suporte: nova mensagem (admin)',
    'hcm_admin_notification',
    E'Alerta administrativo HomeCare Match.\n\n{{1}} respondeu no ticket "{{2}}".\n\nAcesse: https://www.homecarematch.com.br{{3}}',
    'Usuario',
    'Chamado',
    '/admin/suporte/{ticket_id}',
    jsonb_build_object(
      'cta_path_pattern', '/admin/suporte/{ticket_id}'
    )
  ),
  (
    'report_created_admin',
    'admin',
    'Nova denuncia (admin)',
    'hcm_admin_notification',
    E'Alerta administrativo HomeCare Match.\n\nPerfil: {{1}}.\nMotivo: {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}',
    'Perfil',
    'Motivo nao informado',
    '/admin/denuncias',
    jsonb_build_object(
      'details_path', '/admin/denuncias'
    )
  ),
  (
    'concierge_request_admin',
    'admin',
    'Novo pedido concierge (admin)',
    'hcm_admin_notification',
    E'Alerta administrativo HomeCare Match.\n\n{{1}} solicitou atendimento: {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}',
    'Usuario',
    'Especialidade nao informada',
    '/admin/concierge',
    jsonb_build_object(
      'details_path', '/admin/concierge'
    )
  )
ON CONFLICT (event_type) DO NOTHING;
