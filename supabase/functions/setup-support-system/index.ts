import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let client: Client | null = null;
  try {
    console.log("[setup-support-system] Iniciando sincronização...");

    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      throw new Error("A variável de ambiente SUPABASE_DB_URL não está configurada.");
    }

    client = new Client(dbUrl);
    await client.connect();
    
    const sql = `
      -- 1. Tabelas base
      CREATE TABLE IF NOT EXISTS public.support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'medium',
        attachment_url TEXT,
        attachment_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.support_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        attachment_url TEXT,
        attachment_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.support_faqs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'geral',
        position INTEGER DEFAULT 0,
        is_published BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- 2. Ativar RLS
      ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.support_faqs ENABLE ROW LEVEL SECURITY;

      -- 3. Configuração de Realtime
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;
      END
      $$;

      -- Adiciona tabelas ao Realtime (ignora erros se já existirem)
      DO $$
      BEGIN
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
        EXCEPTION WHEN others THEN NULL;
        END;
        
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
        EXCEPTION WHEN others THEN NULL;
        END;
      END
      $$;

      -- 4. Políticas de Segurança
      DO $$
      BEGIN
        -- Tickets
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_tickets_owner') THEN
          CREATE POLICY "support_tickets_owner" ON public.support_tickets 
          FOR ALL TO authenticated 
          USING (auth.uid() = user_id OR (SELECT is_admin OR role = 'admin' FROM public.profiles WHERE id = auth.uid()));
        END IF;

        -- Mensagens
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_messages_owner') THEN
          CREATE POLICY "support_messages_owner" ON public.support_messages 
          FOR ALL TO authenticated 
          USING (
            EXISTS (
              SELECT 1 FROM public.support_tickets t 
              WHERE t.id = ticket_id 
              AND (t.user_id = auth.uid() OR (SELECT is_admin OR role = 'admin' FROM public.profiles WHERE id = auth.uid()))
            )
          );
        END IF;

        -- FAQs
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'support_faqs_read') THEN
          CREATE POLICY "support_faqs_read" ON public.support_faqs FOR SELECT USING (true);
        END IF;
      END
      $$;

      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(JSON.stringify({ ok: true, message: "Sistema de suporte sincronizado!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("[setup-support-system] Erro fatal:", e.message);
    if (client) {
      try { await client.end(); } catch (err) { console.error("Erro ao fechar cliente:", err); }
    }
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});