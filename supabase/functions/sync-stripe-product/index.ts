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

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Validar Admin
    const authHeader = req.headers.get('Authorization');
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin, role').eq('id', user.id).single();
    if (!profile?.is_admin && profile?.role !== 'admin') {
      throw new Error('Acesso negado.');
    }

    const { courseSlug, title, price, mode } = await req.json();
    const stripeMode = mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_\${stripeMode}`);

    if (!stripeSecret) throw new Error(`Chave Stripe \${stripeMode} não configurada.`);

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
        name: `Curso: \${title}`,
        description: `Acesso vitalício ao curso \${title} na plataforma HomeCare Match.`,
        metadata: { courseSlug },
      });
    }

    // 3. Criar Novo Preço (Preços na Stripe são imutáveis, então sempre criamos um novo se o valor mudar)
    const priceObj = await stripe.prices.create({
      unit_amount: Math.round(price * 100),
      currency: 'brl',
      product: product.id,
    });

    return new Response(JSON.stringify({ priceId: priceObj.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});