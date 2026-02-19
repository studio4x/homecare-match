// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

    const body = await req.json();
    const { notificationId, action } = body;

    // AÇÃO 1: Enviar uma notificação específica agora
    if (action === 'send_now' && notificationId) {
      const { data: notification } = await supabaseAdmin
        .from('push_notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (!notification) throw new Error("Notificação não encontrada.");
      
      const sentCount = await sendNotification(supabaseAdmin, notification);
      return new Response(JSON.stringify({ success: true, sentCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // AÇÃO 2: Processar todas as notificações agendadas que já passaram do horário
    if (action === 'process_scheduled') {
      console.log("[Push] Verificando notificações agendadas...");
      
      const { data: scheduled, error: fetchError } = await supabaseAdmin
        .from('push_notifications')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_for', new Date().toISOString());

      if (fetchError) throw fetchError;

      let totalSent = 0;
      for (const notification of (scheduled || [])) {
        const count = await sendNotification(supabaseAdmin, notification);
        totalSent += count;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        processedCount: scheduled?.length || 0,
        totalDevicesReached: totalSent 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error("[Push Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

// Função auxiliar para realizar o envio
async function sendNotification(supabaseAdmin, notification) {
  let subscriptions = [];

  // 1. Buscar inscrições baseadas no alvo
  if (notification.target_role === 'all') {
    const { data } = await supabaseAdmin.from('push_subscriptions').select('*');
    subscriptions = data || [];
  } else {
    const { data: targetUsers } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', notification.target_role);
    
    const userIds = targetUsers?.map(u => u.id) || [];
    if (userIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .in('user_id', userIds);
      subscriptions = data || [];
    }
  }

  // 2. Enviar para a tabela de notificações interna (para usuários logados)
  const internalNotifications = subscriptions
    .filter(sub => sub.user_id !== null)
    .map(sub => ({
      user_id: sub.user_id,
      title: `🔔 ${notification.title}`,
      content: notification.body,
      link: notification.link,
      type: 'info'
    }));

  if (internalNotifications.length > 0) {
    await supabaseAdmin.from('notifications').insert(internalNotifications);
  }

  // 3. Atualizar status para 'sent' (isso dispara o Realtime para os navegadores ativos)
  await supabaseAdmin
    .from('push_notifications')
    .update({ 
      status: 'sent', 
      sent_at: new Date().toISOString() 
    })
    .eq('id', notification.id);

  return subscriptions.length;
}