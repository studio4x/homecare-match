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
VALUES (
  'affiliate_interest_admin',
  'admin',
  'Nova candidatura de afiliado (admin)',
  'hcm_admin_notification',
  E'Alerta administrativo HomeCare Match.\n\n{{1}} enviou candidatura de afiliado.\nPúblico: {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}',
  'Candidato',
  'Público não informado',
  '/admin/afiliados',
  jsonb_build_object(
    'details_path', '/admin/afiliados'
  )
)
ON CONFLICT (event_type) DO NOTHING;

NOTIFY pgrst, 'reload schema';
