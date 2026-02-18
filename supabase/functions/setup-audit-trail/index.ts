import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let client: Client | null = null;
  try {
    console.log("[setup-audit-trail] Criando estrutura de auditoria...");
    
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
        -- Apenas Admins podem ler os logs
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read logs') THEN
          CREATE POLICY "Admins can read logs" ON public.admin_logs 
          FOR SELECT TO authenticated USING (check_is_admin());
        END IF;

        -- Ninguém pode deletar ou alterar logs (Imutabilidade)
        DROP POLICY IF EXISTS "No one can delete logs" ON public.admin_logs;
        DROP POLICY IF EXISTS "No one can update logs" ON public.admin_logs;
      END
      $$;

      -- 4. Notificar recarregamento
      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Sistema de auditoria configurado!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});