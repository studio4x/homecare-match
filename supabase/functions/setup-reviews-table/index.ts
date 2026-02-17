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
    console.log("[setup-sync] Iniciando limpeza e reconstrução de políticas...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    await client.queryObject(`
      -- 1. Garantir RLS ativado
      ALTER TABLE IF EXISTS public.academy_enrollments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE IF EXISTS public.academy_progress ENABLE ROW LEVEL SECURITY;

      -- 2. Limpeza agressiva de TODAS as políticas possíveis (evita conflitos de nomes)
      DO $$ 
      DECLARE 
        pol record;
      BEGIN
        FOR pol IN 
          SELECT policyname, tablename 
          FROM pg_policies 
          WHERE schemaname = 'public' 
          AND tablename IN ('academy_enrollments', 'academy_progress')
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
        END LOOP;
      END $$;

      -- 3. Criar políticas definitivas para academy_enrollments
      
      -- ADMIN: Acesso total
      CREATE POLICY "admin_full_access_enrollments" ON public.academy_enrollments
      FOR ALL TO authenticated
      USING (check_is_admin())
      WITH CHECK (check_is_admin());

      -- USUÁRIO: Ver apenas as próprias matrículas
      CREATE POLICY "user_select_own_enrollments" ON public.academy_enrollments
      FOR SELECT TO authenticated
      USING (auth.uid() = user_id);

      -- USUÁRIO: Inserir apenas a própria matrícula
      CREATE POLICY "user_insert_own_enrollments" ON public.academy_enrollments
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);

      -- 4. Criar políticas definitivas para academy_progress
      
      -- ADMIN: Acesso total
      CREATE POLICY "admin_full_access_progress" ON public.academy_progress
      FOR ALL TO authenticated
      USING (check_is_admin())
      WITH CHECK (check_is_admin());

      -- USUÁRIO: Gerenciar apenas o próprio progresso
      CREATE POLICY "user_manage_own_progress" ON public.academy_progress
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

      -- 5. Notificar recarregamento
      NOTIFY pgrst, 'reload schema';
    `);

    await client.end();
    return new Response(JSON.stringify({ ok: true, message: "Políticas reconstruídas com sucesso!" }), {
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