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

  console.log("[get-payment-history] Iniciando busca profunda por e-mail...");

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

    // 1. BUSCA PODEROSA: Pesquisar todas as cobranças (Charges) pelo e-mail do usuário
    // Isso encontra tanto clientes registrados quanto convidados (Guest)
    console.log(`[get-payment-history] Pesquisando cobranças para: ${user.email}`);
    const chargeSearch = await stripe.charges.search({
      query: `email:"${user.email}"`,
    });

    for (const charge of chargeSearch.data) {
      if (charge.paid && charge.amount > 0) {
        // Tenta identificar se é curso ou assinatura
        let type = 'one_time';
        let description = charge.description || "Pagamento HomeCare Match";
        
        // Se houver fatura, é provavelmente uma assinatura
        if (charge.invoice) {
          type = 'subscription';
        }

        // Tenta pegar detalhes do curso no metadata do PaymentIntent associado
        if (charge.payment_intent) {
          try {
            const pi = await stripe.paymentIntents.retrieve(charge.payment_intent);
            if (pi.metadata?.courseSlug) {
              description = `Curso: ${pi.metadata.courseSlug.replace(/-/g, ' ')}`;
            } else if (pi.metadata?.planId) {
              description = `Plano: ${pi.metadata.planId}`;
              type = 'subscription';
            }
          } catch (e) {
            console.warn("[get-payment-history] Falha ao recuperar metadata do PI");
          }
        }

        history.push({
          id: charge.id,
          date: charge.created * 1000,
          amount: charge.amount / 100,
          currency: charge.currency,
          status: charge.status === 'succeeded' ? 'paid' : charge.status,
          description: description,
          pdf_url: charge.receipt_url, // Recibo direto do Stripe para pagamentos avulsos
          type: type
        });
        processedIds.add(charge.id);
        if (charge.payment_intent) processedIds.add(charge.payment_intent);
      }
    }

    // 2. FALLBACK: Buscar faturas específicas (para garantir PDFs de faturas de assinatura)
    const customers = await stripe.customers.list({ email: user.email, limit: 5 });
    for (const customer of customers.data) {
      const invoices = await stripe.invoices.list({ customer: customer.id, limit: 20 });
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
        }
      });
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