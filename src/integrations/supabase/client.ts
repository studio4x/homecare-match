import { createClient } from '@supabase/supabase-js';

// Prioriza as variáveis de ambiente da Vercel (VITE_...) 
// Se não existirem, usa os valores padrão do projeto.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://rkjvtnadqkbwomgzyswr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ieATkQhcgldd0uqss9Xwbg_ZWGDdFwU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);