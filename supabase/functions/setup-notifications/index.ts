import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
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
      -- Tabela de Notificações Administrativas
      CREATE TABLE IF NOT EXISTS public.admin_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        link TEXT,
        type TEXT DEFAULT 'info', 
        is_read BOOLEAN DEFAULT FALSE,
        is_completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

      -- Limpeza de políticas antigas
      DROP POLICY IF EXISTS "Admins can manage notifications" ON public.admin_notifications;
      DROP POLICY IF EXISTS "System can insert notifications" ON public.admin_notifications;

      -- Apenas administradores podem ver e gerenciar (marcar como lido/excluir)
      CREATE POLICY "Admins can manage notifications" ON public.admin_notifications 
      FOR ALL TO authenticated USING (check_is_admin());

      -- Permitir que qualquer usuário autenticado insira (para sugestões, indicações, etc)
      CREATE POLICY "System can insert notifications" ON public.admin_notifications
      FOR INSERT TO authenticated WITH CHECK (true);

      -- Habilitar Realtime
      DO $$
      BEGIN
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
        EXCEPTION WHEN others THEN NULL;
        END;
      END
      $$;

      NOTIFY pgrst, 'reload schema';
    `;
    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Sistema de notificações atualizado!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});