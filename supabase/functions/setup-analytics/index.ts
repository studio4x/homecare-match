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
      -- Tabela de Visualizações de Perfil
      CREATE TABLE IF NOT EXISTS public.profile_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Tabela de Cliques no WhatsApp
      CREATE TABLE IF NOT EXISTS public.whatsapp_clicks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        clicker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        clicker_role TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.whatsapp_clicks ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
        -- Permissões para Inserção (Público/Autenticado)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow insert profile views') THEN
          CREATE POLICY "Allow insert profile views" ON public.profile_views FOR INSERT WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow insert whatsapp clicks') THEN
          CREATE POLICY "Allow insert whatsapp clicks" ON public.whatsapp_clicks FOR INSERT TO authenticated WITH CHECK (auth.uid() = clicker_id);
        END IF;

        -- Permissões para Admin ler
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read analytics') THEN
          CREATE POLICY "Admins can read analytics" ON public.profile_views FOR SELECT TO authenticated USING (check_is_admin());
          CREATE POLICY "Admins can read clicks analytics" ON public.whatsapp_clicks FOR SELECT TO authenticated USING (check_is_admin());
        END IF;
      END
      $$;
    `;
    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Tabelas de analytics configuradas!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});