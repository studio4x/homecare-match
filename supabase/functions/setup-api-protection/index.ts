import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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
    console.log("[setup-api-protection] Criando estrutura de controle de custos...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Criar tabela de logs de uso de API
      CREATE TABLE IF NOT EXISTS public.api_usage_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        resource_type TEXT NOT NULL, -- 'ai_bio', 'geocoding'
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 2. Ativar RLS
      ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

      -- 3. Políticas de Segurança
      DO $$
      BEGIN
        -- Apenas Admins podem ler os logs de uso
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read api usage') THEN
          CREATE POLICY "Admins can read api usage" ON public.api_usage_logs 
          FOR SELECT TO authenticated USING (check_is_admin());
        END IF;
      END
      $$;

      -- 4. Notifica o recarregamento do esquema
      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Proteção de API configurada!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});