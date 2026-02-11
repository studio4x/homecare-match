// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("[create-checkout-session] Requisição recebida");

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar configuração do site
    const { data: config, error: configError } = await supabaseAdmin.from('site_config').select('stripe_mode').eq('id', 1).maybeSingle();
    
    if (configError) {
      console.error("[create-checkout-session] Erro ao buscar site_config:", configError);
      throw new Error("Erro interno ao buscar configurações do site.");
    }

    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_\${mode}`);

    console.log(`[create-checkout-session] Modo: \${mode}`);

    if (!stripeSecret) {
      console.error(`[create-checkout-session] Secret STRIPE_SECRET_KEY_\${mode} não encontrada`);
      throw new Error(`Configuração de pagamento ausente no servidor (Secret \${mode}).`);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 2. Validar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Usuário não autenticado.');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      console.error("[create-checkout-session] Erro ao validar usuário:", userError);
      throw new Error('Sessão de usuário inválida ou expirada.');
    }

    // 3. Buscar plano
    const { planId } = await req.json();
    console.log(`[create-checkout-session] Iniciando checkout para plano: \${planId}`);

    const { data: plan, error: planError } = await supabaseAdmin.from('plans').select('*').eq('id', planId).maybeSingle();
    
    if (planError || !plan) {
      console.error("[create-checkout-session] Plano não encontrado:", planId, planError);
      throw new Error(`O plano "\${planId}" não foi encontrado no banco de dados.`);
    }

    let stripeId = config?.stripe_mode === 'live' ? plan.stripe_price_id_live : plan.stripe_price_id_test;
    
    if (!stripeId) {
      throw new Error(`O ID da Stripe para o plano "\${planId}" não foi configurado no modo \${mode}.`);
    }

    let finalPriceId = stripeId;

    // Lógica para ID de Produto
    if (stripeId.startsWith('prod_')) {
      console.log(`[create-checkout-session] Buscando preço padrão para produto: \${stripeId}`);
      try {
        const product = await stripe.products.retrieve(stripeId);
        if (!product.default_price) {
          throw new Error("O produto na Stripe não tem um 'Preço Padrão' definido.");
        }
        finalPriceId = typeof product.default_price === 'string' 
          ? product.default_price 
          : product.default_price.id;
      } catch (err) {
        console.error("[create-checkout-session] Erro Stripe Product:", err);
        throw new Error(`Erro ao buscar produto na Stripe: \${err.message}`);
      }
    }

    console.log(`[create-checkout-session] Criando sessão com Price ID: \${finalPriceId}`);

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [{ price: finalPriceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `\${req.headers.get('origin')}/dashboard?success=true`,
      cancel_url: `\${req.headers.get('origin')}/dashboard?canceled=true`,
      metadata: { userId: user.id, planId: planId }
    });

    console.log("[create-checkout-session] Sessão criada com sucesso");

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[create-checkout-session] Erro Crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});