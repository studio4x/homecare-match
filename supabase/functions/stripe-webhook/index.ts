// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.error("[stripe-webhook] Assinatura ausente no cabeçalho.");
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
      console.error(`[stripe-webhook] STRIPE_WEBHOOK_SECRET_${mode} não configurado no Supabase.`);
    }

    const stripe = new Stripe(stripeSecret || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await req.text();
    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret || '');
    } catch (err) {
      console.error(`[stripe-webhook] Erro na validação da assinatura: ${err.message}`);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`[stripe-webhook] Evento recebido: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;

      console.log(`[stripe-webhook] Processando conclusão. User: ${userId}, Plan: ${planId}`);

      if (userId && planId) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            subscription_tier: planId,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          console.error(`[stripe-webhook] Erro ao atualizar perfil: ${updateError.message}`);
          throw updateError;
        }
        console.log(`[stripe-webhook] Perfil atualizado com sucesso para o plano: ${planId}`);
      } else {
        console.warn("[stripe-webhook] Metadados (userId ou planId) ausentes na sessão.");
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 200 
    });
  } catch (err) {
    console.error(`[stripe-webhook] Erro crítico: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});