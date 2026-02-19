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
      -- 1. Tabela de Inscrições (Alterada para permitir user_id nulo)
      CREATE TABLE IF NOT EXISTS public.push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Removido NOT NULL
        subscription JSONB NOT NULL,
        device_type TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Garantir que user_id é anulável se a tabela já existia
      ALTER TABLE public.push_subscriptions ALTER COLUMN user_id DROP NOT NULL;

      -- 2. Tabela de Notificações
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

      -- 3. Ativar RLS
      ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

      -- 4. Políticas
      DO $$
      BEGIN
        -- Permitir que qualquer um insira uma inscrição (anônimo ou logado)
        DROP POLICY IF EXISTS "Allow public insert subscriptions" ON public.push_subscriptions;
        CREATE POLICY "Allow public insert subscriptions" ON public.push_subscriptions 
        FOR INSERT WITH CHECK (true);

        -- Usuários logados gerenciam as suas
        DROP POLICY IF EXISTS "Users manage own subscriptions" ON public.push_subscriptions;
        CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions 
        FOR ALL TO authenticated USING (auth.uid() = user_id);

        -- Admins gerenciam tudo
        DROP POLICY IF EXISTS "Admins manage push notifications" ON public.push_notifications;
        CREATE POLICY "Admins manage push notifications" ON public.push_notifications 
        FOR ALL TO authenticated USING (check_is_admin());
        
        -- Admin pode ver todas as inscrições
        DROP POLICY IF EXISTS "Admins view all subscriptions" ON public.push_subscriptions;
        CREATE POLICY "Admins view all subscriptions" ON public.push_subscriptions 
        FOR SELECT TO authenticated USING (check_is_admin());
      END
      $$;

      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Sistema de Push atualizado para suporte anônimo!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});