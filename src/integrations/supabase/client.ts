import { createClient } from '@supabase/supabase-js';

// Prioriza as variáveis de ambiente da Vercel (VITE_...) 
// Se não existirem, usa os valores padrão do projeto.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://rkjvtnadqkbwomgzyswr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJranZ0bmFkcWtid29tZ3p5c3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjI3NTAsImV4cCI6MjA4NTYzODc1MH0.Xc1l3rYeR3zs-9ZRsAtvYDrhnXHvyydf6VmpCoLNeFI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);