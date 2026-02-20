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

    console.log(`[Push] Processando ação: \${action}`, { notificationId });

    if (action === 'clear_all_subscribers') {
      const { error, count } = await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      return new Response(JSON.stringify({ success: true, deletedCount: count }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

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
        const count = await processNotification(supabaseAdmin, notification);
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

async function processNotification(supabaseAdmin, notification) {
  // 1. BUSCAR TODOS OS USUÁRIOS DO PÚBLICO-ALVO (Para o Mural de Avisos)
  let userQuery = supabaseAdmin.from('profiles').select('id');
  if (notification.target_role !== 'all') {
    userQuery = userQuery.eq('role', notification.target_role);
  }
  const { data: targetUsers } = await userQuery;

  // 2. SALVAR NO MURAL DE TODOS (Mesmo sem Push aprovado)
  if (targetUsers && targetUsers.length > 0) {
    const internalNotifs = targetUsers.map(u => ({
      user_id: u.id,
      title: notification.title,
      content: notification.body,
      link: notification.link,
      type: 'broadcast' // TIPO ESPECIAL PARA O MURAL
    }));
    
    await supabaseAdmin.from('notifications').insert(internalNotifs);
    console.log(`[Push] Mural atualizado para \${targetUsers.length} usuários.`);
  }

  // 3. ENVIAR PUSH NATIVO (Apenas para quem tem dispositivo inscrito)
  let subQuery = supabaseAdmin.from('push_subscriptions').select('*');
  if (notification.target_role !== 'all') {
    const userIds = targetUsers?.map(u => u.id) || [];
    if (userIds.length === 0) return 0;
    subQuery = subQuery.in('user_id', userIds);
  }
  
  const { data: subs } = await subQuery;
  if (!subs || subs.length === 0) {
    await markAsSent(supabaseAdmin, notification.id);
    return 0;
  }

  const uniqueEndpoints = new Map();
  subs.forEach(s => {
    if (s.subscription?.endpoint) uniqueEndpoints.set(s.subscription.endpoint, s);
  });

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    link: notification.link,
    image: notification.image_url
  });

  let successCount = 0;
  for (const sub of uniqueEndpoints.values()) {
    if (VAPID_PUBLIC_KEY && sub.subscription?.endpoint) {
      try {
        await webpush.sendNotification(sub.subscription, payload);
        successCount++;
      } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  }

  await markAsSent(supabaseAdmin, notification.id);
  return successCount;
}

async function markAsSent(supabaseAdmin, id) {
  await supabaseAdmin.from('push_notifications').update({ 
    status: 'sent', 
    sent_at: new Date().toISOString() 
  }).eq('id', id);
}