ALTER TABLE IF EXISTS public.site_config
ADD COLUMN IF NOT EXISTS chatbot_ai_first BOOLEAN DEFAULT true;

UPDATE public.site_config
SET chatbot_ai_first = COALESCE(chatbot_ai_first, true);

NOTIFY pgrst, 'reload schema';
