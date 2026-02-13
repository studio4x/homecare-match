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
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error('Não autorizado');

    // 2. Configurar Stripe
    const { data: config } = await supabaseAdmin.from('site_config').select('stripe_mode').eq('id', 1).maybeSingle();
    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_\${mode}`);

    const stripe = new Stripe(stripeSecret || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 3. Buscar Cliente
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ payments: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;

    // 4. Buscar Faturas (Assinaturas)
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 50,
    });

    // 5. Buscar PaymentIntents (Pagamentos avulsos/Cursos)
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 50,
    });

    // 6. Formatar e Unificar
    const history = [];

    // Adiciona faturas
    invoices.data.forEach(inv => {
      history.push({
        id: inv.id,
        date: inv.created * 1000,
        amount: inv.amount_paid / 100,
        currency: inv.currency,
        status: inv.status,
        description: inv.lines.data[0]?.description || "Assinatura",
        pdf_url: inv.invoice_pdf,
        type: 'subscription'
      });
    });

    // Adiciona pagamentos avulsos que não geraram fatura (evitando duplicatas)
    paymentIntents.data.forEach(pi => {
      const hasInvoice = invoices.data.some(inv => inv.payment_intent === pi.id);
      if (!hasInvoice && pi.status === 'succeeded') {
        history.push({
          id: pi.id,
          date: pi.created * 1000,
          amount: pi.amount / 100,
          currency: pi.currency,
          status: 'paid',
          description: pi.metadata?.courseSlug ? `Curso: \${pi.metadata.courseSlug}` : "Pagamento Avulso",
          pdf_url: null,
          type: 'one_time'
        });
      }
    });

    // Ordenar por data decrescente
    const sortedHistory = history.sort((a, b) => b.date - a.date);

    return new Response(JSON.stringify({ payments: sortedHistory }), {
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