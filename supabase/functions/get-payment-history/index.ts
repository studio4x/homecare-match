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

  console.log("[get-payment-history] Iniciando busca de histórico...");

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
      console.error("[get-payment-history] Erro ao validar usuário:", userError);
      throw new Error('Usuário não autenticado ou sessão expirada.');
    }

    // 2. Configurar Stripe
    const { data: config } = await supabaseAdmin
      .from('site_config')
      .select('stripe_mode')
      .eq('id', 1)
      .maybeSingle();
    
    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_\${mode}`);

    if (!stripeSecret) {
      console.error(`[get-payment-history] Chave STRIPE_SECRET_KEY_\${mode} não encontrada.`);
      throw new Error(`Configuração de pagamento (Secret \${mode}) ausente no servidor.`);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 3. Buscar Cliente no Stripe pelo e-mail
    console.log(`[get-payment-history] Buscando cliente Stripe para: \${user.email}`);
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      console.log("[get-payment-history] Cliente não possui registro no Stripe.");
      return new Response(JSON.stringify({ payments: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;

    // 4. Buscar Faturas (Assinaturas) e PaymentIntents (Cursos/Avulsos) em paralelo
    console.log(`[get-payment-history] Buscando faturas e pagamentos para customer: \${customerId}`);
    const [invoices, paymentIntents] = await Promise.all([
      stripe.invoices.list({ customer: customerId, limit: 50 }),
      stripe.paymentIntents.list({ customer: customerId, limit: 50 })
    ]);

    // 5. Formatar e Unificar
    const history = [];

    // Adiciona faturas de assinaturas
    invoices.data.forEach(inv => {
      if (inv.total > 0) { // Ignora faturas de valor zero (trials) se desejar, ou mantém
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
      }
    });

    // Adiciona pagamentos avulsos (como cursos) que não geraram fatura
    paymentIntents.data.forEach(pi => {
      const hasInvoice = invoices.data.some(inv => inv.payment_intent === pi.id);
      if (!hasInvoice && pi.status === 'succeeded' && pi.amount > 0) {
        history.push({
          id: pi.id,
          date: pi.created * 1000,
          amount: pi.amount / 100,
          currency: pi.currency,
          status: 'paid',
          description: pi.description || (pi.metadata?.courseSlug ? `Curso: \${pi.metadata.courseSlug}` : "Pagamento Avulso"),
          pdf_url: null,
          type: 'one_time'
        });
      }
    });

    // Ordenar por data decrescente
    const sortedHistory = history.sort((a, b) => b.date - a.date);

    console.log(`[get-payment-history] Sucesso. Encontrados \${sortedHistory.length} registros.`);

    return new Response(JSON.stringify({ payments: sortedHistory }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[get-payment-history] Erro crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});