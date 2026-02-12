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

  console.log("[sync-user-subscription] Iniciando sincronização...");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Validar Usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Cabeçalho de autorização ausente.');
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error("[sync-user-subscription] Erro ao validar usuário:", userError);
      throw new Error('Usuário não autenticado ou sessão expirada.');
    }

    console.log(`[sync-user-subscription] Sincronizando usuário: ${user.email} (${user.id})`);

    // 2. Configurar Stripe
    const { data: config, error: configError } = await supabaseAdmin
      .from('site_config')
      .select('stripe_mode')
      .eq('id', 1)
      .maybeSingle();
    
    if (configError) {
      console.error("[sync-user-subscription] Erro ao buscar site_config:", configError);
    }

    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_\${mode}`);
    
    console.log(`[sync-user-subscription] Modo Stripe: \${mode}`);

    if (!stripeSecret) {
      throw new Error(`Configuração Stripe (Secret \${mode}) ausente no servidor.`);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 3. Buscar Cliente no Stripe
    console.log("[sync-user-subscription] Buscando cliente no Stripe...");
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      console.log("[sync-user-subscription] Nenhum cliente encontrado no Stripe para este e-mail.");
      return new Response(JSON.stringify({ success: false, message: 'Nenhum registro de pagamento encontrado no Stripe para seu e-mail.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const customerId = customers.data[0].id;
    console.log(`[sync-user-subscription] Cliente Stripe ID: \${customerId}`);

    // 4. Buscar Assinaturas Ativas ou em Cancelamento
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all', // Pega todas para verificar o estado atual
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      console.log(`[sync-user-subscription] Assinatura encontrada: \${sub.id} (Status: \${sub.status})`);
      
      if (sub.status !== 'active' && sub.status !== 'trialing' && !sub.cancel_at_period_end) {
        console.log("[sync-user-subscription] Assinatura não está ativa.");
        return new Response(JSON.stringify({ success: false, message: `Sua assinatura está com status: \${sub.status}.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      const productId = sub.items.data[0].price.product;
      const priceId = sub.items.data[0].price.id;

      // Busca o plano correspondente no nosso banco
      const { data: plans } = await supabaseAdmin
        .from('plans')
        .select('id, stripe_price_id_test, stripe_price_id_live');

      const matchedPlan = plans?.find(p => 
        p.stripe_price_id_test === priceId || 
        p.stripe_price_id_live === priceId ||
        p.stripe_price_id_test === productId ||
        p.stripe_price_id_live === productId
      );

      const updateData = {
        subscription_end_at: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString()
      };

      if (matchedPlan) {
        updateData.subscription_tier = matchedPlan.id;
        console.log(`[sync-user-subscription] Plano identificado: \${matchedPlan.id}`);
      }

      const { error: updateError } = await supabaseAdmin.from('profiles').update(updateData).eq('id', user.id);
      
      if (updateError) {
        console.error("[sync-user-subscription] Erro ao atualizar perfil:", updateError);
        throw new Error("Erro ao salvar dados no banco de dados.");
      }

      console.log("[sync-user-subscription] Sincronização concluída com sucesso.");
      return new Response(JSON.stringify({ success: true, message: 'Assinatura sincronizada com sucesso!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log("[sync-user-subscription] Nenhuma assinatura encontrada.");
    return new Response(JSON.stringify({ success: false, message: 'Nenhuma assinatura ativa encontrada no Stripe.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error("[sync-user-subscription] Erro Crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});