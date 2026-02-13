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
      throw new Error('Usuário não autenticado ou sessão expirada.');
    }

    // 2. Configurar Stripe
    const { data: config } = await supabaseAdmin
      .from('site_config')
      .select('stripe_mode')
      .eq('id', 1)
      .maybeSingle();
    
    const mode = config?.stripe_mode === 'live' ? 'LIVE' : 'TEST';
    const stripeSecret = Deno.env.get(`STRIPE_SECRET_KEY_${mode}`);

    if (!stripeSecret) {
      throw new Error(`Configuração de pagamento (Secret ${mode}) ausente no servidor.`);
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 3. Buscar TODOS os clientes associados a este e-mail (prevenção de duplicatas de registro)
    const customers = await stripe.customers.list({ email: user.email });
    
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ payments: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const history = [];

    // 4. Iterar por todos os IDs de cliente encontrados para este e-mail
    for (const customer of customers.data) {
      const customerId = customer.id;
      
      // Buscar Faturas e Pagamentos Únicos
      const [invoices, paymentIntents] = await Promise.all([
        stripe.invoices.list({ customer: customerId, limit: 50 }),
        stripe.paymentIntents.list({ customer: customerId, limit: 50 })
      ]);

      // Processar Faturas (Assinaturas)
      invoices.data.forEach(inv => {
        if (inv.total > 0) {
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

      // Processar PaymentIntents (Cursos / Pagamentos Avulsos)
      paymentIntents.data.forEach(pi => {
        // Evita duplicar se o PI já estiver em uma fatura processada acima
        const hasInvoice = invoices.data.some(inv => inv.payment_intent === pi.id);
        if (!hasInvoice && (pi.status === 'succeeded' || pi.status === 'paid') && pi.amount > 0) {
          
          // Tenta extrair o nome do curso do metadata ou descrição
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
            pdf_url: null, // PIs avulsos geralmente não geram PDF de fatura automático no Stripe
            type: 'one_time'
          });
        }
      });
    }

    // 5. Remover duplicatas de ID (caso o mesmo PI apareça em buscas diferentes) e ordenar
    const uniqueHistory = Array.from(new Map(history.map(item => [item.id, item])).values());
    const sortedHistory = uniqueHistory.sort((a, b) => b.date - a.date);

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