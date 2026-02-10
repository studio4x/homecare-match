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
      -- Tabela de Tickets
      CREATE TABLE IF NOT EXISTS public.support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, closed
        priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Mensagens dos Tickets (Chat)
      CREATE TABLE IF NOT EXISTS public.support_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- FAQs e Base de Conhecimento
      CREATE TABLE IF NOT EXISTS public.support_faqs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'geral',
        position INTEGER DEFAULT 0,
        is_published BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Habilitar RLS
      ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.support_faqs ENABLE ROW LEVEL SECURITY;

      -- Políticas
      DO $$
      BEGIN
        -- Tickets: Usuário vê os seus, Admin vê todos
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_tickets_owner') THEN
          CREATE POLICY "support_tickets_owner" ON public.support_tickets FOR ALL TO authenticated USING (auth.uid() = user_id OR check_is_admin());
        END IF;

        -- Mensagens: Usuário vê as do seu ticket, Admin vê todas
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_messages_owner') THEN
          CREATE POLICY "support_messages_owner" ON public.support_messages FOR ALL TO authenticated 
          USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR check_is_admin())));
        END IF;

        -- FAQs: Todos leem, Admin edita
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_faqs_read') THEN
          CREATE POLICY "support_faqs_read" ON public.support_faqs FOR SELECT USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_faqs_admin') THEN
          CREATE POLICY "support_faqs_admin" ON public.support_faqs FOR ALL TO authenticated USING (check_is_admin());
        END IF;
      END
      $$;
    `;
    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Sistema de suporte configurado!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});