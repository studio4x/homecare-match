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

    // 1. Validar Usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Usuário não encontrado');

    // 2. Configurar Stripe
    const { data: config } = await supabaseAdmin.from('site_config').select('stripe_mode').eq('id', 1).single();
    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_\${mode}`);
    
    if (!stripeSecret) throw new Error('Configuração Stripe ausente no servidor.');

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 3. Buscar Cliente no Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum cliente Stripe encontrado para este e-mail.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const customerId = customers.data[0].id;

    // 4. Buscar Assinaturas Ativas
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      
      // Tenta encontrar qual plano do nosso banco corresponde ao produto do Stripe
      const productId = sub.items.data[0].price.product;
      const priceId = sub.items.data[0].price.id;

      const { data: plan } = await supabaseAdmin
        .from('plans')
        .select('id')
        .or(`stripe_price_id_test.eq.\${priceId},stripe_price_id_live.eq.\${priceId},stripe_price_id_test.eq.\${productId},stripe_price_id_live.eq.\${productId}`)
        .maybeSingle();

      const updateData = {
        subscription_end_at: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString()
      };

      if (plan) {
        updateData.subscription_tier = plan.id;
      }

      await supabaseAdmin.from('profiles').update(updateData).eq('id', user.id);

      return new Response(JSON.stringify({ success: true, message: 'Assinatura sincronizada!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ message: 'Nenhuma assinatura ativa encontrada no Stripe.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});