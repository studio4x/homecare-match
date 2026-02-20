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
    console.log("[setup-user-notifications] Configurando Realtime e Identidade de Réplica...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Garantir tabela e colunas
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

      ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS image_url TEXT;

      -- 2. Configurar REPLICA IDENTITY FULL (CRÍTICO para Realtime)
      ALTER TABLE public.notifications REPLICA IDENTITY FULL;

      -- 3. Habilitar Realtime com verificação de existência
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables 
          WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'notifications'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        END IF;
      END $$;

      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Sistema de avisos sincronizado com REPLICA IDENTITY FULL!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[setup-user-notifications] Erro fatal:", e.message);
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});