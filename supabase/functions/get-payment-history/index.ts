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

  console.log("[get-payment-history] Iniciando busca profunda corrigida...");

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
    const userEmail = user.email.toLowerCase();

    // 1. Buscar Clientes e suas Faturas/Pagamentos (Para Assinaturas e Clientes Registrados)
    // Usamos listagem direta para evitar delay de indexação da Search API
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    
    for (const customer of customers.data) {
      // Buscar Faturas (Invoices)
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

      // Buscar PaymentIntents diretos deste cliente
      const paymentIntents = await stripe.paymentIntents.list({ customer: customer.id, limit: 50 });
      paymentIntents.data.forEach(pi => {
        if (!processedIds.has(pi.id) && pi.status === 'succeeded' && pi.amount > 0) {
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
            pdf_url: null, // PaymentIntents puros não têm PDF fácil sem Invoice
            type: 'one_time'
          });
          processedIds.add(pi.id);
        }
      });
    }

    // 2. BUSCA "FORÇA BRUTA": Listar Checkout Sessions recentes e filtrar por e-mail manualmente
    // Isso pega compras feitas como "Convidado" (Guest) que ainda não foram indexadas na busca ou não têm customer fixo
    const sessions = await stripe.checkout.sessions.list({ limit: 100 });
    
    const matchedSessions = sessions.data.filter(s => {
      const customerEmail = s.customer_details?.email || s.customer_email;
      return customerEmail && customerEmail.toLowerCase() === userEmail && s.payment_status === 'paid';
    });

    for (const session of matchedSessions) {
      // Usa o ID do PaymentIntent ou da Sessão para evitar duplicatas
      const uniqueId = session.payment_intent || session.id;
      
      if (!processedIds.has(uniqueId) && !processedIds.has(session.invoice)) {
        let description = "Pagamento via Checkout";
        let type = session.mode === 'subscription' ? 'subscription' : 'one_time';

        if (session.metadata?.courseSlug) {
          description = `Curso: ${session.metadata.courseSlug.replace(/-/g, ' ')}`;
        } else if (session.metadata?.planId) {
          description = `Plano: ${session.metadata.planId}`;
        } else if (session.mode === 'payment') {
           description = "Compra de Curso/Serviço";
        }

        // Se for assinatura, tentamos pegar o PDF da fatura se disponível no objeto invoice (se expandido) ou deixamos null
        // Checkout sessions geralmente não retornam a URL do PDF diretamente no list, mas o recibo sim se disponível no charge
        // Para simplificar, assumimos recibo digital se não tivermos invoice object
        
        history.push({
          id: uniqueId,
          date: session.created * 1000,
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || 'brl',
          status: 'paid',
          description: description,
          pdf_url: null, // O front exibirá "Recibo Digital"
          type: type
        });
        processedIds.add(uniqueId);
      }
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