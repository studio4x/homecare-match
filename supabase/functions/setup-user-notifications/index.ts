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
    console.log("[setup-user-notifications] Configurando Realtime e Replica Identity...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Garantir que a tabela existe com todas as colunas
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

      -- 2. Configurar REPLICA IDENTITY para garantir que o Realtime envie todos os dados
      ALTER TABLE public.notifications REPLICA IDENTITY FULL;

      -- 3. Ativar RLS e Políticas
      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "users_manage_own_notifications" ON public.notifications;
      CREATE POLICY "users_manage_own_notifications" ON public.notifications 
      FOR ALL TO authenticated 
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

      -- 4. Garantir que a tabela está na publicação de Realtime
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;
        
        -- Tenta adicionar a tabela (ignora se já estiver lá)
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        EXCEPTION WHEN others THEN 
          NULL;
        END;
      END $$;

      -- 5. Notifica o recarregamento do esquema
      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Realtime configurado para notificações!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});