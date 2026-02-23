// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const signature = req.headers.get('stripe-signature');
  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { data: config } = await supabaseAdmin.from('site_config').select('stripe_mode').eq('id', 1).single();
    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_${mode}`);
    const webhookSecret = Deno.env.get(`STRIPE_WEBHOOK_SECRET_${mode}`);
    const stripe = new Stripe(stripeSecret || '', { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() });
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { userId, planId, courseSlug } = session.metadata || {};

      if (userId && planId) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await supabaseAdmin.from('profiles').update({ 
          subscription_tier: planId,
          subscription_end_at: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString()
        }).eq('id', userId);

        await supabaseAdmin.from('notifications').insert({
          user_id: userId,
          title: "💰 Pagamento Confirmado!",
          content: `Sua assinatura do plano ${planId} foi ativada com sucesso.`,
          link: "/dashboard",
          type: 'success'
        });

        await supabaseAdmin.from('admin_notifications').insert({ title: "💰 Nova Assinatura", content: `Um usuário assinou o plano: ${planId}`, link: "/admin/usuarios", type: 'success' });
      } else if (userId && courseSlug) {
        await supabaseAdmin.from('academy_enrollments').upsert({ user_id: userId, course_slug: courseSlug, created_at: new Date().toISOString() }, { onConflict: 'user_id,course_slug' });

        const { data: course } = await supabaseAdmin.from('academy_courses').select('title').eq('slug', courseSlug).single();
        await supabaseAdmin.from('notifications').insert({
          user_id: userId,
          title: "🎓 Curso Adquirido!",
          content: `Seu acesso ao curso "${course?.title || courseSlug}" foi liberado.`,
          link: `/cursos/${courseSlug}`,
          type: 'success'
        });

        await supabaseAdmin.from('admin_notifications').insert({ title: "🎓 Novo Curso Vendido", content: `Um usuário comprou o curso: ${courseSlug}`, link: "/admin/cursos", type: 'success' });
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 400 });
  }
});