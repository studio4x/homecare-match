ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS patient_document_url TEXT,
  ADD COLUMN IF NOT EXISTS patient_address_proof_url TEXT;

NOTIFY pgrst, 'reload schema';
