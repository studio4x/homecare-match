// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.error("[stripe-webhook] Assinatura ausente.");
    return new Response('No signature', { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { data: config } = await supabaseAdmin.from('site_config').select('stripe_mode').eq('id', 1).single();
    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';

    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_${mode}`);
    const webhookSecret = Deno.env.get(`STRIPE_WEBHOOK_SECRET_${mode}`);

    if (!webhookSecret) {
      console.error(`[stripe-webhook] ERRO: STRIPE_WEBHOOK_SECRET_${mode} não configurado.`);
      return new Response('Webhook secret missing', { status: 500 });
    }

    const stripe = new Stripe(stripeSecret || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await req.text();
    let event;

    try {
      // No Deno/Supabase, precisamos usar a versão ASYNC para evitar erros de Crypto
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error(`[stripe-webhook] Falha na assinatura: \${err.message}`);
      return new Response(`Webhook Error: \${err.message}`, { status: 400 });
    }

    console.log(`[stripe-webhook] Evento validado: \${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;

      console.log(`[stripe-webhook] Processando: User=\${userId}, Plan=\${planId}`);

      if (userId && planId) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            subscription_tier: planId,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          console.error(`[stripe-webhook] Erro DB: \${updateError.message}`);
          throw updateError;
        }
        console.log(`[stripe-webhook] SUCESSO: Plano \${planId} liberado para \${userId}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 200 
    });
  } catch (err) {
    console.error(`[stripe-webhook] Erro Crítico: \${err.message}`);
    return new Response(`Error: \${err.message}`, { status: 400 });
  }
});