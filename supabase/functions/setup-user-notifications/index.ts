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
      -- Tabela de Notificações de Usuário
      CREATE TABLE IF NOT EXISTS public.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        link TEXT,
        type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

      -- Usuários só podem ver e gerenciar suas próprias notificações
      DO $$
      BEGIN
        DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
        CREATE POLICY "Users can manage own notifications" ON public.notifications 
        FOR ALL TO authenticated USING (auth.uid() = user_id);
      END
      $$;

      -- Habilitar Realtime para a nova tabela
      DO $$
      BEGIN
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        EXCEPTION WHEN others THEN NULL;
        END;
      END
      $$;

      NOTIFY pgrst, 'reload schema';
    `;
    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Sistema de notificações de usuário configurado!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});