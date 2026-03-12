// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { enqueueUserWhatsappNotification } from "../_shared/whatsapp.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { professional_id, sender_id } = await req.json();

    const { data: sender } = await supabaseAdmin.from('profiles').select('full_name, role').eq('id', sender_id).single();

    const senderType = sender.role === 'company' ? 'Uma empresa' : 'Uma família';
    await supabaseAdmin.from('notifications').insert({
      user_id: professional_id,
      title: "👤 Novo Interesse no seu Perfil!",
      content: `${senderType} (${sender.full_name}) salvou seu contato e pode te chamar no WhatsApp em breve.`,
      link: "/dashboard/contatos",
      type: 'info'
    });

    try {
      await enqueueUserWhatsappNotification({
        supabaseAdmin,
        userId: professional_id,
        eventType: "new_contact_interest_user",
        templateParams: [
          String(sender.full_name || "Um recrutador"),
          "demonstrou interesse no seu perfil",
          "/dashboard/contatos",
        ],
        payload: {
          professional_id,
          sender_id,
        },
      });
    } catch (waError) {
      console.warn("[notify-contact] falha ao enfileirar WhatsApp:", waError?.message || waError);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
