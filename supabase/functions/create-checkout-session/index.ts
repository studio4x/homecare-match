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

    const { data: config } = await supabaseAdmin.from('site_config').select('stripe_mode').eq('id', 1).single();
    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_\${mode}`);

    if (!stripeSecret) throw new Error(`Configuração ausente: STRIPE_SECRET_KEY_\${mode}`);

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const authHeader = req.headers.get('Authorization');
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Usuário não encontrado.');

    const { planId } = await req.json();
    const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('id', planId).single();
    
    if (!plan) throw new Error(`Plano "\${planId}" não encontrado.`);

    let stripeId = config?.stripe_mode === 'live' ? plan.stripe_price_id_live : plan.stripe_price_id_test;
    
    if (!stripeId) throw new Error("ID do Stripe não configurado para este plano.");

    let finalPriceId = stripeId;

    // Lógica Inteligente: Se for ID de Produto, busca o preço padrão
    if (stripeId.startsWith('prod_')) {
      console.log(`[create-checkout-session] ID de produto detectado (\${stripeId}). Buscando preço padrão...`);
      try {
        const product = await stripe.products.retrieve(stripeId);
        if (!product.default_price) {
          throw new Error("O produto informado no Stripe não possui um 'Preço Padrão' configurado. Defina um preço padrão na Stripe ou use o ID do Preço (price_...).");
        }
        finalPriceId = typeof product.default_price === 'string' 
          ? product.default_price 
          : product.default_price.id;
      } catch (err) {
        throw new Error(`Erro ao buscar produto na Stripe: \${err.message}`);
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [{ price: finalPriceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `\${req.headers.get('origin')}/dashboard?success=true`,
      cancel_url: `\${req.headers.get('origin')}/dashboard?canceled=true`,
      metadata: { userId: user.id, planId: planId }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[create-checkout-session] Erro:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});