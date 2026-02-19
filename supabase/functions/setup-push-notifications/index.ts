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
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Garantir tabelas
      CREATE TABLE IF NOT EXISTS public.push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        subscription JSONB NOT NULL,
        device_type TEXT,
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

      -- 2. Configurar REPLICA IDENTITY para garantir que o Realtime envie todos os campos
      ALTER TABLE public.push_notifications REPLICA IDENTITY FULL;

      -- 3. Ativar RLS
      ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

      -- 4. Políticas de Segurança
      DO $$
      BEGIN
        -- Inscrições: Permitir inserção pública e gerenciamento total por Admin
        DROP POLICY IF EXISTS "Allow public insert subscriptions" ON public.push_subscriptions;
        CREATE POLICY "Allow public insert subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (true);

        DROP POLICY IF EXISTS "Admins manage subscriptions" ON public.push_subscriptions;
        CREATE POLICY "Admins manage subscriptions" ON public.push_subscriptions 
        FOR ALL TO authenticated USING (public.check_is_admin() = true);

        -- Notificações: Público pode ler apenas as que já foram enviadas
        DROP POLICY IF EXISTS "Public can read sent notifications" ON public.push_notifications;
        CREATE POLICY "Public can read sent notifications" ON public.push_notifications 
        FOR SELECT USING (status = 'sent' OR (public.check_is_admin() = true));

        -- Admins gerenciam tudo
        DROP POLICY IF EXISTS "Admins manage push notifications" ON public.push_notifications;
        CREATE POLICY "Admins manage push notifications" ON public.push_notifications 
        FOR ALL TO authenticated USING (public.check_is_admin());
      END
      $$;

      -- 5. Habilitar Realtime
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;
        
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.push_notifications;
        EXCEPTION WHEN others THEN NULL;
        END;
      END $$;

      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Banco de dados e políticas de Push atualizadas!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});