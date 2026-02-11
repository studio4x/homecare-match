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
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Usuário não encontrado');

    const { planId } = await req.json();
    
    // MAPEAMENTO DE PREÇOS DO STRIPE (IDs Reais configurados)
    const priceMapping: Record<string, string> = {
      'monthly': 'price_1SzjOu0p7oPiMHmJdsA0VH0n',
      'yearly': 'price_1SzjPL0p7oPiMHmJklhNxP7P',
    };

    const priceId = priceMapping[planId];
    
    if (!priceId) {
      throw new Error(`ID de preço não configurado para o plano: \${planId}`);
    }

    console.log(`[Stripe Checkout] Iniciando sessão para \${user.email} - Plano: \${planId}`);

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