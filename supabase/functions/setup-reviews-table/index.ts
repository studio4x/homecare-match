import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let client: Client | null = null;
  try {
    console.log("[setup-sync] Iniciando sincronização robusta de permissões...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    await client.queryObject(`
      -- 1. Garantir que as tabelas existam com RLS ativado
      ALTER TABLE IF EXISTS public.academy_enrollments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS public.academy_progress ENABLE ROW LEVEL SECURITY;

      -- 2. Limpeza total de políticas antigas para evitar conflitos
      DROP POLICY IF EXISTS "academy_enrollments_admin_all" ON public.academy_enrollments;
      DROP POLICY IF EXISTS "academy_enrollments_admin_select" ON public.academy_enrollments;
      DROP POLICY IF EXISTS "academy_enrollments_self_select" ON public.academy_enrollments;
      DROP POLICY IF EXISTS "academy_enrollments_owner" ON public.academy_enrollments;
      
      DROP POLICY IF EXISTS "academy_progress_admin_all" ON public.academy_progress;
      DROP POLICY IF EXISTS "academy_progress_admin_select" ON public.academy_progress;
      DROP POLICY IF EXISTS "academy_progress_owner" ON public.academy_progress;

      -- 3. Criar política de acesso TOTAL para Administradores (usando verificação direta no banco)
      -- Matrículas
      CREATE POLICY "admin_manage_enrollments" ON public.academy_enrollments
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR profiles.role = 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR profiles.role = 'admin')
        )
      );

      -- Progresso
      CREATE POLICY "admin_manage_progress" ON public.academy_progress
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR profiles.role = 'admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR profiles.role = 'admin')
        )
      );

      -- 4. Restaurar políticas básicas para usuários comuns
      CREATE POLICY "users_view_own_enrollments" ON public.academy_enrollments
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);

      CREATE POLICY "users_manage_own_progress" ON public.academy_progress
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

      -- 5. Notificar recarregamento de esquema
      NOTIFY pgrst, 'reload schema';
    `);

    await client.end();
    return new Response(JSON.stringify({ ok: true, message: "Permissões administrativas resetadas e configuradas com sucesso!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});