-- Affiliate Program v1 - schema

ALTER TABLE IF EXISTS public.site_config
  ADD COLUMN IF NOT EXISTS affiliate_program_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.affiliate_program_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  affiliate_program_enabled BOOLEAN NOT NULL DEFAULT false,
  affiliate_shadow_mode BOOLEAN NOT NULL DEFAULT true,
  signup_commission_amount NUMERIC(12,2) NOT NULL DEFAULT 50.00,
  recurring_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  payout_minimum_amount NUMERIC(12,2) NOT NULL DEFAULT 100.00,
  payout_cycle TEXT NOT NULL DEFAULT 'monthly',
  recurring_duration_mode TEXT NOT NULL DEFAULT 'while_active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.affiliate_program_config (
  id,
  affiliate_program_enabled,
  affiliate_shadow_mode,
  signup_commission_amount,
  recurring_commission_percent,
  payout_minimum_amount,
  payout_cycle,
  recurring_duration_mode
)
VALUES (1, false, true, 50.00, 10.00, 100.00, 'monthly', 'while_active')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  pix_key TEXT,
  pix_key_type TEXT,
  is_external BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_partners_status_check CHECK (status IN ('active', 'inactive', 'blocked')),
  CONSTRAINT affiliate_partners_pix_type_check CHECK (
    pix_key_type IS NULL OR pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'random')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_partners_user_unique
  ON public.affiliate_partners (user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.affiliate_short_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  short_link_id UUID NOT NULL REFERENCES public.marketing_short_links(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_short_links_unique UNIQUE (short_link_id)
);

CREATE TABLE IF NOT EXISTS public.affiliate_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  affiliate_partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  source_short_link_id UUID REFERENCES public.marketing_short_links(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'short_link',
  is_valid BOOLEAN NOT NULL DEFAULT true,
  invalid_reason TEXT,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_attributions_first_touch UNIQUE (referred_user_id)
);

CREATE TABLE IF NOT EXISTS public.affiliate_payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label TEXT,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  minimum_amount NUMERIC(12,2) NOT NULL DEFAULT 100.00,
  total_affiliates INTEGER NOT NULL DEFAULT 0,
  total_entries INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  payment_proof_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_payout_batches_status_check CHECK (status IN ('draft', 'approved', 'paid', 'canceled'))
);

CREATE TABLE IF NOT EXISTS public.affiliate_payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.affiliate_payout_batches(id) ON DELETE CASCADE,
  affiliate_partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  entry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'reserved',
  pix_key TEXT,
  pix_key_type TEXT,
  payment_reference TEXT,
  payment_proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_payout_items_status_check CHECK (status IN ('reserved', 'paid', 'canceled')),
  CONSTRAINT affiliate_payout_items_unique UNIQUE (batch_id, affiliate_partner_id)
);

CREATE TABLE IF NOT EXISTS public.affiliate_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attribution_id UUID REFERENCES public.affiliate_attributions(id) ON DELETE SET NULL,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  payout_item_id UUID REFERENCES public.affiliate_payout_items(id) ON DELETE SET NULL,
  payment_id TEXT,
  entry_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  description TEXT,
  event_source TEXT NOT NULL,
  event_source_id TEXT NOT NULL,
  entry_status TEXT NOT NULL DEFAULT 'shadow',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_commission_ledger_entry_type_check CHECK (
    entry_type IN ('signup_credit', 'recurring_credit', 'clawback_debit', 'manual_adjustment')
  ),
  CONSTRAINT affiliate_commission_ledger_direction_check CHECK (direction IN ('credit', 'debit')),
  CONSTRAINT affiliate_commission_ledger_status_check CHECK (
    entry_status IN ('shadow', 'available', 'reserved', 'paid', 'voided')
  ),
  CONSTRAINT affiliate_commission_ledger_idempotency UNIQUE (
    affiliate_partner_id,
    entry_type,
    event_source,
    event_source_id
  )
);

CREATE INDEX IF NOT EXISTS idx_affiliate_short_links_partner ON public.affiliate_short_links (affiliate_partner_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_partner ON public.affiliate_attributions (affiliate_partner_id, attributed_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_payout_batches_status ON public.affiliate_payout_batches (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_payout_items_partner ON public.affiliate_payout_items (affiliate_partner_id, status);
CREATE INDEX IF NOT EXISTS idx_affiliate_ledger_partner_status ON public.affiliate_commission_ledger (affiliate_partner_id, entry_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_ledger_payment ON public.affiliate_commission_ledger (payment_id);
