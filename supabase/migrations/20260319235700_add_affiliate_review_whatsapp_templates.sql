INSERT INTO public.whatsapp_template_configs (
  event_type,
  target_kind,
  label,
  template_name,
  sample_message,
  var1_default,
  var2_default,
  var3_default,
  variations,
  is_active
)
VALUES
  (
    'affiliate_application_approved_user',
    'user',
    'Afiliado: candidatura aprovada (usuario)',
    'hcm_user_notification_v2',
    E'Atualizacao do programa de afiliados.\n\n{{1}}, {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}',
    'Afiliado',
    'sua candidatura foi aprovada',
    '/dashboard/afiliados',
    jsonb_build_object(
      'status_text', 'sua candidatura foi aprovada',
      'details_path', '/dashboard/afiliados'
    ),
    true
  ),
  (
    'affiliate_application_rejected_user',
    'user',
    'Afiliado: candidatura rejeitada (usuario)',
    'hcm_user_notification_v2',
    E'Atualizacao do programa de afiliados.\n\n{{1}}, {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}',
    'Afiliado',
    'sua candidatura nao foi aprovada',
    '/afiliados',
    jsonb_build_object(
      'status_text', 'sua candidatura nao foi aprovada',
      'details_path', '/afiliados'
    ),
    true
  )
ON CONFLICT (event_type) DO UPDATE
SET
  target_kind = EXCLUDED.target_kind,
  label = EXCLUDED.label,
  template_name = EXCLUDED.template_name,
  sample_message = EXCLUDED.sample_message,
  var1_default = EXCLUDED.var1_default,
  var2_default = EXCLUDED.var2_default,
  var3_default = EXCLUDED.var3_default,
  variations = EXCLUDED.variations,
  is_active = EXCLUDED.is_active,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
