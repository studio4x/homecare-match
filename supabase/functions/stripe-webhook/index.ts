// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('No signature', { status: 400 });

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
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;
      const courseSlug = session.metadata?.courseSlug;

      const { data: userProfile } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', userId).single();

      if (userId && planId) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await supabaseAdmin.from('profiles').update({ 
          subscription_tier: planId,
          subscription_end_at: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString()
        }).eq('id', userId);

        // --- NOTIFICAÇÃO NO PAINEL ---
        await supabaseAdmin.from('admin_notifications').insert({
          title: "💰 Nova Assinatura Realizada",
          content: `${userProfile?.full_name || userProfile?.email} assinou o plano: ${planId}`,
          link: "/admin/usuarios",
          type: 'success'
        });
      } else if (userId && courseSlug) {
        await supabaseAdmin.from('academy_enrollments').upsert({ 
          user_id: userId, 
          course_slug: courseSlug,
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id,course_slug' });

        // --- NOTIFICAÇÃO NO PAINEL ---
        await supabaseAdmin.from('admin_notifications').insert({
          title: "🎓 Novo Curso Vendido",
          content: `${userProfile?.full_name || userProfile?.email} comprou o curso: ${courseSlug}`,
          link: "/admin/cursos",
          type: 'success'
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 400 });
  }
});