-- Add public highlight fields to coupons for pre-launch campaign.
-- These fields control whether a coupon is displayed publicly
-- and how it appears in the UI (field block + monthly plan card).

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS show_publicly          BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS highlight_on_monthly_plan BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_label           TEXT,
  ADD COLUMN IF NOT EXISTS public_title           TEXT,
  ADD COLUMN IF NOT EXISTS public_description     TEXT,
  ADD COLUMN IF NOT EXISTS display_priority       INTEGER  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eligible_audience      TEXT,
  ADD COLUMN IF NOT EXISTS campaign_badge         TEXT;

-- Index to speed up the public highlighted coupon query.
CREATE INDEX IF NOT EXISTS idx_coupons_public_highlight
  ON public.coupons (display_priority DESC, created_at DESC)
  WHERE show_publicly = true AND is_active = true;

NOTIFY pgrst, 'reload schema';
