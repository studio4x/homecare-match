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

    // 1. Buscar modo atual do Stripe
    const { data: config } = await supabaseAdmin.from('site_config').select('stripe_mode').eq('id', 1).single();
    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_\${mode}`);
    if (!stripeSecret) throw new Error(`Chave secreta Stripe (\${mode}) não configurada nos Secrets.`);

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error('Usuário não encontrado');

    const { planId } = await req.json();
    
    // 2. Buscar ID do preço no banco de dados
    const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('id', planId).single();
    const priceId = config?.stripe_mode === 'live' ? plan?.stripe_price_id_live : plan?.stripe_price_id_test;
    
    if (!priceId) {
      throw new Error(`ID de preço não configurado para o plano \${planId} no modo \${mode}`);
    }

    console.log(`[Stripe Checkout] Iniciando sessão (\${mode}) para \${user.email} - Plano: \${planId}`);

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `\${req.headers.get('origin')}/dashboard?success=true`,
      cancel_url: `\${req.headers.get('origin')}/dashboard?canceled=true`,
      metadata: {
        userId: user.id,
        planId: planId
      }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("[Stripe Checkout] Erro:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});