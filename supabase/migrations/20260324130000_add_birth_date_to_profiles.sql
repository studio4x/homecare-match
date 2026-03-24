-- Add birth_date column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
