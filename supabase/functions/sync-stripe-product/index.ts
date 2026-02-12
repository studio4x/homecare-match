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
    
    console.log("[sync-stripe-product] Dados recebidos:", { courseSlug, title, price, mode });

    if (!courseSlug || !title || price === undefined) {
      throw new Error('Parâmetros obrigatórios ausentes (slug, título ou preço)');
    }

    const stripeMode = mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_\${stripeMode}`);

    if (!stripeSecret) {
      throw new Error(`Configuração Stripe ausente: Chave secreta para \${stripeMode} não encontrada nos Secrets.`);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 2. Buscar ou Criar Produto
    let product;
    try {
      const products = await stripe.products.list({ limit: 100 });
      product = products.data.find(p => p.metadata.courseSlug === courseSlug);

      if (!product) {
        console.log("[sync-stripe-product] Criando novo produto na Stripe...");
        product = await stripe.products.create({
          name: `Curso: \${title}`,
          description: `Acesso vitalício ao curso \${title} na plataforma HomeCare Match.`,
          metadata: { courseSlug },
        });
      } else {
        console.log("[sync-stripe-product] Produto já existe:", product.id);
      }
    } catch (err) {
      console.error("[sync-stripe-product] Erro ao gerenciar produto na Stripe:", err);
      throw new Error(`Erro na Stripe (Produto): \${err.message}`);
    }

    // 3. Criar Novo Preço
    try {
      const amount = Math.round(Number(price) * 100);
      if (isNaN(amount) || amount <= 0) throw new Error('Valor do preço inválido');

      console.log("[sync-stripe-product] Criando novo preço de R$", amount / 100);
      const priceObj = await stripe.prices.create({
        unit_amount: amount,
        currency: 'brl',
        product: product.id,
      });

      console.log("[sync-stripe-product] Sucesso! Price ID:", priceObj.id);
      return new Response(JSON.stringify({ priceId: priceObj.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (err) {
      console.error("[sync-stripe-product] Erro ao criar preço na Stripe:", err);
      throw new Error(`Erro na Stripe (Preço): \${err.message}`);
    }

  } catch (error) {
    console.error("[sync-stripe-product] Erro crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});