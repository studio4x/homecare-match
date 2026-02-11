// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar modo atual do Stripe
    const { data: config, error: configError } = await supabaseAdmin
      .from('site_config')
      .select('stripe_mode')
      .eq('id', 1)
      .single();

    if (configError) throw new Error("Falha ao carregar configuração do site.");

    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_\${mode}`);

    if (!stripeSecret) {
      throw new Error(`A chave secreta STRIPE_SECRET_KEY_\${mode} não foi encontrada nos Secrets do Supabase.`);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Usuário não autenticado.');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error('Usuário não encontrado.');

    const { planId } = await req.json();
    if (!planId) throw new Error('ID do plano não fornecido.');
    
    // 2. Buscar ID do preço no banco de dados
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();
    
    if (planError || !plan) throw new Error(`Plano "\${planId}" não encontrado no banco de dados.`);

    const priceId = config?.stripe_mode === 'live' ? plan.stripe_price_id_live : plan.stripe_price_id_test;
    
    if (!priceId) {
      throw new Error(`O ID de preço da Stripe não foi configurado para o plano "\${planId}" no modo \${mode}. Vá em Admin > Planos e configure.`);
    }

    console.log(`[create-checkout-session] Iniciando sessão para \${user.email} no modo \${mode}`);

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
    console.error("[create-checkout-session] Erro crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});