// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  console.log("[sync-stripe-product] Início da execução");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Validar Admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado: Token ausente');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error('Sessão inválida ou expirada');
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin, role').eq('id', user.id).single();
    if (!profile?.is_admin && profile?.role !== 'admin') {
      throw new Error('Acesso negado: Apenas administradores podem sincronizar produtos');
    }

    const body = await req.json();
    const { courseSlug, title, price, mode } = body;
    
    const stripeMode = mode === 'live' ? 'LIVE' : 'TEST';
    const secretName = `STRIPE_SECRET_KEY_${stripeMode}`;
    const stripeSecret = Deno.env.get(secretName);

    if (!stripeSecret) {
      throw new Error(`Configuração Stripe ausente: Chave ${secretName} não encontrada nos Secrets do Supabase.`);
    }

    // Log de depuração (seguro)
    console.log(`[sync-stripe-product] Usando chave que começa com: ${stripeSecret.substring(0, 7)}...`);

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 2. Buscar ou Criar Produto
    let product;
    const products = await stripe.products.list({ limit: 100 });
    product = products.data.find(p => p.metadata.courseSlug === courseSlug);

    if (!product) {
      product = await stripe.products.create({
        name: `Curso: ${title}`,
        description: `Acesso vitalício ao curso ${title} na plataforma HomeCare Match.`,
        metadata: { courseSlug },
      });
    }

    // 3. Criar Novo Preço
    const amount = Math.round(Number(price) * 100);
    const priceObj = await stripe.prices.create({
      unit_amount: amount,
      currency: 'brl',
      product: product.id,
    });

    return new Response(JSON.stringify({ priceId: priceObj.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[sync-stripe-product] Erro:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});