// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import webpush from "https://esm.sh/web-push@3.6.7";

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
  // Resposta obrigatória para o navegador liberar o acesso (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { notificationId, action } = body;

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

      return new Response(JSON.stringify({ success: true, totalSent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error("[Push Error]", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
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
  if (!subs) return 0;

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    link: notification.link,
    image: notification.image_url
  });

  const internalNotifs = [];
  
  for (const sub of subs) {
    if (VAPID_PUBLIC_KEY && sub.subscription?.endpoint) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (e) {
        console.warn("[Push] Falha ao enviar para endpoint:", sub.id);
        if (e.statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    if (sub.user_id) {
      internalNotifs.push({
        user_id: sub.user_id,
        title: `🔔 ${notification.title}`,
        content: notification.body,
        link: notification.link,
        type: 'info'
      });
    }
  }

  if (internalNotifs.length > 0) {
    await supabaseAdmin.from('notifications').insert(internalNotifs);
  }

  await supabaseAdmin.from('push_notifications').update({ 
    status: 'sent', 
    sent_at: new Date().toISOString() 
  }).eq('id', notification.id);

  return subs.length;
}