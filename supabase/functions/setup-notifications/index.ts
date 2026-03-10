import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let client: Client | null = null;
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.replace("Bearer ", "").trim() || "";

    let bodyToken = "";
    try {
      const body = await req.clone().json();
      bodyToken = typeof body?.access_token === "string" ? body.access_token.trim() : "";
    } catch {
      bodyToken = "";
    }

    const token = bearerToken || bodyToken;
    if (!token) {
      return new Response(JSON.stringify({ error: "Nao autorizado: token ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Nao autorizado: token invalido." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: "Falha ao validar permissao de admin." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = Boolean(profile?.is_admin || profile?.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas admin." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    client = new Client(SUPABASE_DB_URL);
    await client.connect();

    const sql = `
      -- Tabela de Notificacoes Administrativas
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

      -- Configurar REPLICA IDENTITY FULL
      ALTER TABLE public.admin_notifications REPLICA IDENTITY FULL;

      ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'admin_notifications'
            AND policyname = 'admin_notifications_admin_read'
        ) THEN
          CREATE POLICY "admin_notifications_admin_read"
          ON public.admin_notifications
          FOR SELECT TO authenticated
          USING (check_is_admin());
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'admin_notifications'
            AND policyname = 'admin_notifications_admin_update'
        ) THEN
          CREATE POLICY "admin_notifications_admin_update"
          ON public.admin_notifications
          FOR UPDATE TO authenticated
          USING (check_is_admin())
          WITH CHECK (check_is_admin());
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'admin_notifications'
            AND policyname = 'admin_notifications_admin_delete'
        ) THEN
          CREATE POLICY "admin_notifications_admin_delete"
          ON public.admin_notifications
          FOR DELETE TO authenticated
          USING (check_is_admin());
        END IF;
      END $$;

      -- Habilitar Realtime
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'admin_notifications'
        ) THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
        END IF;
      END $$;

      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();
    client = null;

    return new Response(
      JSON.stringify({ ok: true, message: "Sistema de notificacoes admin atualizado com Realtime robusto!" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    if (client) {
      try {
        await client.end();
      } catch {
        // ignore
      }
    }

    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
