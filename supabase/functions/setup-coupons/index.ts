import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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
    console.log("[setup-coupons] Ajustando referências de integridade e novas colunas...");
    
    client = new Client(SUPABASE_DB_URL);
    await client.connect();
    
    const sql = `
      -- 1. Tabela de Cupons
      CREATE TABLE IF NOT EXISTS public.coupons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        free_days INTEGER NOT NULL DEFAULT 30,
        max_uses INTEGER NOT NULL DEFAULT 100,
        current_uses INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        only_new_users BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Garantir que a coluna existe caso a tabela já tenha sido criada
      ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS only_new_users BOOLEAN DEFAULT TRUE;

      -- 2. Tabela de Uso
      CREATE TABLE IF NOT EXISTS public.coupon_usages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
        user_id UUID NOT NULL, 
        used_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(coupon_id, user_id)
      );

      -- 3. Função RPC para incremento seguro
      CREATE OR REPLACE FUNCTION public.increment_coupon_uses(coupon_id UUID)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        UPDATE public.coupons
        SET current_uses = current_uses + 1
        WHERE id = coupon_id;
      END;
      $$;

      -- 4. Ativar RLS
      ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

      -- 5. Políticas
      DO $$
      BEGIN
        DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
        CREATE POLICY "Admins manage coupons" ON public.coupons 
        FOR ALL TO authenticated USING (public.check_is_admin() = true);

        DROP POLICY IF EXISTS "Admins view usages" ON public.coupon_usages;
        CREATE POLICY "Admins view usages" ON public.coupon_usages 
        FOR SELECT TO authenticated USING (public.check_is_admin() = true);

        DROP POLICY IF EXISTS "Public read active coupons" ON public.coupons;
        CREATE POLICY "Public read active coupons" ON public.coupons 
        FOR SELECT TO authenticated USING (is_active = true);
      END
      $$;

      NOTIFY pgrst, 'reload schema';
    `;

    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Sistema de cupons atualizado com suporte a restrição de novos usuários!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (client) try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});