import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://rkjvtnadqkbwomgzyswr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let client: Client | null = null;

  try {
    console.log("[setup-audit-trail] Iniciando configuração robusta...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Criar tabela de logs
      CREATE TABLE IF NOT EXISTS public.admin_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        action_type TEXT NOT NULL,
        target_id UUID,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 2. Ativar RLS
      ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

      -- 3. Políticas de Segurança
      DO $$
      BEGIN
        DROP POLICY IF EXISTS "Admins can read logs" ON public.admin_logs;
        CREATE POLICY "Admins can read logs" ON public.admin_logs 
        FOR SELECT TO authenticated USING (check_is_admin());
      END
      $$;

      -- 4. Notifica o recarregamento
      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    // 5. Inserir log de teste/inicialização
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: user?.id,
      action_type: 'SYSTEM_SETUP',
      details: 'O sistema de auditoria foi configurado ou atualizado com sucesso.'
    });

    return new Response(JSON.stringify({ ok: true, message: "Sistema de auditoria pronto!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});