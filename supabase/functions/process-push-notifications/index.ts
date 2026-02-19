// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import webpush from "https://esm.sh/web-push@3.6.7?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Configuração VAPID
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = "mailto:contato@homecarematch.com.br";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { notificationId, action } = body;

    console.log(`[Push] Processando ação: \${action}`, { notificationId });

    if (action === 'send_now' || action === 'process_scheduled') {
      let notifications = [];
      
      if (action === 'send_now' && notificationId) {
        const { data } = await supabaseAdmin.from('push_notifications').select('*').eq('id', notificationId).single();
        if (data) notifications = [data];
      } else {
        const { data } = await supabaseAdmin.from('push_notifications').select('*').eq('status', 'scheduled').lte('scheduled_for', new Date().toISOString());
        notifications = data || [];
      }

      let totalSent = 0;
      for (const notification of notifications) {
        const count = await sendToAllSubscribers(supabaseAdmin, notification);
        totalSent += count;
      }

      return new Response(JSON.stringify({ success: true, processedCount: notifications.length, sentCount: totalSent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error("[Push Error]", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function sendToAllSubscribers(supabaseAdmin, notification) {
  let query = supabaseAdmin.from('push_subscriptions').select('*');
  
  if (notification.target_role !== 'all') {
    const { data: users } = await supabaseAdmin.from('profiles').select('id').eq('role', notification.target_role);
    const ids = users?.map(u => u.id) || [];
    if (ids.length === 0) return 0;
    query = query.in('user_id', ids);
  }
  
  const { data: subs } = await query;
  if (!subs || subs.length === 0) return 0;

  // --- DE-DUPLICAÇÃO ---
  // Usamos um Map para garantir que cada endpoint (aparelho único) receba apenas uma notificação
  const uniqueEndpoints = new Map();
  subs.forEach(s => {
    if (s.subscription?.endpoint) {
      uniqueEndpoints.set(s.subscription.endpoint, s);
    }
  });

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    link: notification.link,
    image: notification.image_url
  });

  let successCount = 0;
  const userIdsNotified = new Set();
  
  for (const sub of uniqueEndpoints.values()) {
    // 1. Envio Web Push (Barra do Sistema)
    if (VAPID_PUBLIC_KEY && sub.subscription?.endpoint) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        successCount++;
      } catch (e) {
        console.warn("[Push] Falha ao enviar para endpoint:", sub.id, e.message);
        // Se o endpoint não existe mais, removemos do banco
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    // 2. Preparar Notificação Interna (Sininho) - Apenas uma por usuário
    if (sub.user_id) {
      userIdsNotified.add(sub.user_id);
    }
  }

  // Enviar notificações internas em lote
  if (userIdsNotified.size > 0) {
    const internalNotifs = Array.from(userIdsNotified).map(uid => ({
      user_id: uid,
      title: `🔔 \${notification.title}`,
      content: notification.body,
      link: notification.link,
      type: 'info'
    }));
    await supabaseAdmin.from('notifications').insert(internalNotifs);
  }

  // Marcar como enviado
  await supabaseAdmin.from('push_notifications').update({ 
    status: 'sent', 
    sent_at: new Date().toISOString() 
  }).eq('id', notification.id);

  return successCount;
}