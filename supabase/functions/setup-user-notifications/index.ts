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
    console.log("[setup-user-notifications] Iniciando configuração robusta...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Criar ou atualizar a tabela de Notificações de Usuário
      CREATE TABLE IF NOT EXISTS public.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        link TEXT,
        type TEXT DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Garantir que as colunas existam (caso a tabela já tenha sido criada incompleta)
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'info';
      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

      -- 2. Ativar RLS
      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

      -- 3. Limpeza e Reconstrução de Políticas
      DO $$ 
      BEGIN
        DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
        DROP POLICY IF EXISTS "users_select_own_notifications" ON public.notifications;
        
        -- Política única e clara: Usuário autenticado acessa apenas o que for dele
        CREATE POLICY "users_manage_own_notifications" ON public.notifications 
        FOR ALL TO authenticated 
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
      END $$;

      -- 4. Habilitar Realtime
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;
        
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        EXCEPTION WHEN others THEN 
          NULL; -- Ignora se já estiver na publicação
        END;
      END $$;

      -- 5. Notifica o recarregamento do esquema
      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Sistema de notificações de usuário configurado com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    console.error("[setup-user-notifications] Erro:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});