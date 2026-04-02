ALTER TABLE public.site_config
  ADD COLUMN IF NOT EXISTS free_trial_monthly_upgrade_enabled BOOLEAN NOT NULL DEFAULT true;

UPDATE public.site_config
SET free_trial_monthly_upgrade_enabled = COALESCE(free_trial_monthly_upgrade_enabled, true)
WHERE id = 1;

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
VALUES (
  'free_trial_bonus_upgrade_user',
  'user',
  'Teste gratis: bonus de 30 dias no mensal (usuario)',
  'hcm_user_notification_v2',
  E'Atualizacao do seu plano HomeCare Match.\n\n{{1}}, {{2}}.\n\nAcesse: https://www.homecarematch.com.br{{3}}',
  'Usuario',
  'voce ganhou mais 30 dias gratis no Plano Mensal',
  '/dashboard/pagamentos?trialBonus=extended',
  jsonb_build_object(
    'status_text', 'voce ganhou mais 30 dias gratis no Plano Mensal',
    'details_path', '/dashboard/pagamentos?trialBonus=extended'
  ),
  true
)
ON CONFLICT (event_type) DO UPDATE
SET
  label = EXCLUDED.label,
  template_name = EXCLUDED.template_name,
  sample_message = EXCLUDED.sample_message,
  var1_default = EXCLUDED.var1_default,
  var2_default = EXCLUDED.var2_default,
  var3_default = EXCLUDED.var3_default,
  variations = EXCLUDED.variations,
  is_active = EXCLUDED.is_active,
  updated_at = now();
