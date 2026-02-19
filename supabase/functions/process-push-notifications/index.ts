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

      // 1. Buscar usuários alvo
      let query = supabaseAdmin.from('profiles').select('id');
      if (notification.target_role !== 'all') {
        query = query.eq('role', notification.target_role);
      }
      const { data: targetUsers } = await query;
      const userIds = targetUsers?.map(u => u.id) || [];

      // 2. Buscar inscrições de push para esses usuários
      const { data: subscriptions } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .in('user_id', userIds);

      console.log(`[Push] Enviando para \${subscriptions?.length || 0} dispositivos.`);

      // NOTA: Aqui entraria a integração real com FCM ou OneSignal.
      // Como não temos chaves externas, simulamos o envio e salvamos no histórico interno.
      
      // Simulando envio para a tabela de notificações interna também para garantir que o usuário veja
      for (const userId of userIds) {
        await supabaseAdmin.from('notifications').insert({
          user_id: userId,
          title: `🔔 \${notification.title}`,
          content: notification.body,
          link: notification.link,
          type: 'info'
        });
      }

      // Atualizar status da notificação push
      await supabaseAdmin
        .from('push_notifications')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      return new Response(JSON.stringify({ success: true, sentCount: subscriptions?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ message: "Ação processada" }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});