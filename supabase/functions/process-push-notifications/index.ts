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

    const { notificationId, action } = await req.json();

    if (action === 'send_now') {
      const { data: notification } = await supabaseAdmin
        .from('push_notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (!notification) throw new Error("Notificação não encontrada.");

      let subscriptions = [];

      // 1. Buscar inscrições
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

      console.log(`[Push] Processando envio para \${subscriptions.length} dispositivos.`);

      // 2. Enviar para a tabela de notificações interna (APENAS para quem tem user_id)
      const internalNotifications = subscriptions
        .filter(sub => sub.user_id !== null)
        .map(sub => ({
          user_id: sub.user_id,
          title: `🔔 \${notification.title}`,
          content: notification.body,
          link: notification.link,
          type: 'info'
        }));

      if (internalNotifications.length > 0) {
        await supabaseAdmin.from('notifications').insert(internalNotifications);
      }

      // 3. Atualizar status para disparar o Realtime (que os anônimos estão ouvindo)
      await supabaseAdmin
        .from('push_notifications')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      return new Response(JSON.stringify({ success: true, sentCount: subscriptions.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ message: "Ação processada" }), { headers: corsHeaders });
  } catch (error) {
    console.error("[Push Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});