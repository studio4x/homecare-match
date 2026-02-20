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
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders });

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

      for (const notification of notifications) {
        await processNotification(supabaseAdmin, notification);
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function processNotification(supabaseAdmin, notification) {
  // 1. BUSCAR TODOS OS USUÁRIOS DO PÚBLICO-ALVO
  let userQuery = supabaseAdmin.from('profiles').select('id');
  if (notification.target_role !== 'all') {
    userQuery = userQuery.eq('role', notification.target_role);
  }
  const { data: targetUsers } = await userQuery;

  // 2. SALVAR NO MURAL DE TODOS (Com imagem)
  if (targetUsers && targetUsers.length > 0) {
    const internalNotifs = targetUsers.map(u => ({
      user_id: u.id,
      title: notification.title,
      content: notification.body,
      link: notification.link,
      image_url: notification.image_url,
      type: 'broadcast'
    }));
    
    await supabaseAdmin.from('notifications').insert(internalNotifs);
  }

  // 3. ENVIAR PUSH NATIVO
  let subQuery = supabaseAdmin.from('push_subscriptions').select('*');
  if (notification.target_role !== 'all') {
    const userIds = targetUsers?.map(u => u.id) || [];
    if (userIds.length > 0) subQuery = subQuery.in('user_id', userIds);
  }
  
  const { data: subs } = await subQuery;
  if (subs && subs.length > 0) {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      link: notification.link,
      image: notification.image_url
    });

    for (const sub of subs) {
      if (VAPID_PUBLIC_KEY && sub.subscription?.endpoint) {
        try {
          await webpush.sendNotification(sub.subscription, payload);
        } catch (e) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    }
  }

  await supabaseAdmin.from('push_notifications').update({ 
    status: 'sent', 
    sent_at: new Date().toISOString() 
  }).eq('id', notification.id);
}