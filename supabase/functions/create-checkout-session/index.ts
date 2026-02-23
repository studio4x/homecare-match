// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
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

    const { data: config } = await supabaseAdmin.from('site_config').select('stripe_mode').eq('id', 1).maybeSingle();
    
    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_${mode}`);

    if (!stripeSecret) {
      throw new Error(`Configuração de pagamento ausente no servidor (Secret ${mode}).`);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const authHeader = req.headers.get('Authorization');
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));

    const { planId, courseSlug } = await req.json();
    
    let stripeId = "";
    let metadata = { userId: user.id };
    let checkoutMode = "subscription";
    let successUrl = `${req.headers.get('origin')}/dashboard?success=true`; // Default success URL

    if (courseSlug) {
      const { data: course } = await supabaseAdmin.from('academy_courses').select('title, stripe_price_id_test, stripe_price_id_live').eq('slug', courseSlug).maybeSingle();
      stripeId = config?.stripe_mode === 'live' ? course.stripe_price_id_live : course.stripe_price_id_test;
      metadata.courseSlug = courseSlug;
      metadata.courseTitle = course.title; // Pass course title for conversion page
      checkoutMode = "payment";
      successUrl = `${req.headers.get('origin')}/conversion/course?courseSlug=${courseSlug}&courseTitle=${encodeURIComponent(course.title)}`; // New conversion page for courses
    } else if (planId) {
      const { data: plan } = await supabaseAdmin.from('plans').select('name, stripe_price_id_test, stripe_price_id_live').eq('id', planId).maybeSingle();
      stripeId = config?.stripe_mode === 'live' ? plan.stripe_price_id_live : plan.stripe_price_id_test;
      metadata.planId = planId;
      metadata.planName = plan.name; // Pass plan name for conversion page
      checkoutMode = "subscription";
      successUrl = `${req.headers.get('origin')}/conversion/subscription?planId=${planId}&planName=${encodeURIComponent(plan.name)}`; // New conversion page for subscriptions
    }
    
    if (!stripeId) throw new Error("ID da Stripe não configurado para este item.");

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [{ price: stripeId, quantity: 1 }],
      mode: checkoutMode,
      success_url: successUrl,
      cancel_url: `${req.headers.get('origin')}/dashboard?canceled=true`,
      metadata: metadata
    });

    return new Response(JSON.stringify({ url: session.url }), {
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