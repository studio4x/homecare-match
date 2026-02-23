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
    console.log("[setup-push-notifications] Iniciando sincronização robusta...");
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Garantir tabelas
      CREATE TABLE IF NOT EXISTS public.push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        subscription JSONB NOT NULL,
        device_type TEXT,
        browser TEXT,
        city TEXT,
        ip_address TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.push_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        link TEXT,
        image_url TEXT,
        target_role TEXT DEFAULT 'all',
        status TEXT DEFAULT 'pending',
        scheduled_for TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        created_by UUID REFERENCES public.profiles(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 2. Configurar REPLICA IDENTITY
      ALTER TABLE public.push_notifications REPLICA IDENTITY FULL;

      -- 3. Habilitar Realtime com verificação
      DO $$
      BEGIN
        -- Cria a publicação se não existir
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;

        -- Adiciona a tabela apenas se ela ainda não estiver na publicação
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables 
          WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'push_notifications'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.push_notifications;
        END IF;
      END $$;

      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Sistema de Push sincronizado com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[setup-push-notifications] Erro fatal:", e.message);
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});