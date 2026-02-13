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

  console.log("[get-payment-history] Iniciando busca corrigida...");

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) throw new Error('Usuário não autenticado.');

    const { data: config } = await supabaseAdmin.from('site_config').select('stripe_mode').eq('id', 1).maybeSingle();
    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_${mode}`);

    if (!stripeSecret) throw new Error(`Configuração Stripe (${mode}) ausente.`);

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const history = [];
    const processedIds = new Set();

    // 1. Buscar Clientes pelo e-mail
    // Usamos search para garantir que pegamos todos os clientes com este email
    const customers = await stripe.customers.search({
      query: `email:"${user.email}"`,
      limit: 10
    });

    // Para cada cliente encontrado (pode haver mais de um se comprou como guest antes)
    for (const customer of customers.data) {
      // Buscar Faturas (Invoices) -> Principalmente para Assinaturas
      const invoices = await stripe.invoices.list({ customer: customer.id, limit: 50 });
      invoices.data.forEach(inv => {
        if (inv.total > 0 && !processedIds.has(inv.id)) {
          history.push({
            id: inv.id,
            date: inv.created * 1000,
            amount: inv.amount_paid / 100,
            currency: inv.currency,
            status: inv.status,
            description: inv.lines.data[0]?.description || "Assinatura HomeCare Match",
            pdf_url: inv.invoice_pdf,
            type: 'subscription'
          });
          processedIds.add(inv.id);
          if (inv.payment_intent) processedIds.add(inv.payment_intent);
        }
      });

      // Buscar PaymentIntents vinculados ao Customer -> Para compras avulsas
      const customerPIs = await stripe.paymentIntents.list({ customer: customer.id, limit: 50 });
      customerPIs.data.forEach(pi => {
        if (!processedIds.has(pi.id) && (pi.status === 'succeeded' || pi.status === 'paid') && pi.amount > 0) {
          let description = pi.description || "Pagamento Avulso";
          if (pi.metadata?.courseSlug) {
            description = `Curso: ${pi.metadata.courseSlug.replace(/-/g, ' ')}`;
          } else if (pi.metadata?.planId) {
            description = `Plano: ${pi.metadata.planId}`;
          }

          history.push({
            id: pi.id,
            date: pi.created * 1000,
            amount: pi.amount / 100,
            currency: pi.currency,
            status: 'paid',
            description: description,
            pdf_url: null,
            type: 'one_time'
          });
          processedIds.add(pi.id);
        }
      });
    }

    // 2. Buscar PaymentIntents pelo 'receipt_email'
    // Isso pega compras feitas como Guest (onde o email do recibo bate, mas talvez o customer não tenha sido linkado ou encontrado acima)
    // O campo 'receipt_email' É suportado no paymentIntents.search
    try {
      const piSearch = await stripe.paymentIntents.search({
        query: `status:'succeeded' AND receipt_email:"${user.email}"`,
        limit: 20
      });

      piSearch.data.forEach(pi => {
        if (!processedIds.has(pi.id) && pi.amount > 0) {
          let description = pi.description || "Pagamento Avulso";
          if (pi.metadata?.courseSlug) {
            description = `Curso: ${pi.metadata.courseSlug.replace(/-/g, ' ')}`;
          }

          history.push({
            id: pi.id,
            date: pi.created * 1000,
            amount: pi.amount / 100,
            currency: pi.currency,
            status: 'paid',
            description: description,
            pdf_url: null,
            type: 'one_time'
          });
          processedIds.add(pi.id);
        }
      });
    } catch (searchErr) {
      console.warn("[get-payment-history] Erro na busca por receipt_email (pode não estar indexado ainda):", searchErr.message);
    }

    // Ordenar por data decrescente
    const sortedHistory = history.sort((a, b) => b.date - a.date);

    return new Response(JSON.stringify({ payments: sortedHistory }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[get-payment-history] Erro:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});