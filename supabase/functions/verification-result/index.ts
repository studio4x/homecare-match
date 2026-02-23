// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import nodemailer from "npm:nodemailer"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    
    const authHeader = req.headers.get('Authorization')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: adminUser } } = await supabaseAdmin.auth.getUser(token)

    const { status, reason, userName, userEmail, userId } = await req.json()

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: status === 'approved' ? "✅ Documentos Aprovados!" : "⚠️ Documentos Rejeitados",
      content: status === 'approved' 
        ? "Parabéns! Seus documentos foram validados e você agora possui o selo de verificado." 
        : `Infelizmente sua verificação não foi aprovada. Motivo: ${reason}. Por favor, reenvie seus dados.`,
      link: "/dashboard/perfil",
      type: status === 'approved' ? 'success' : 'error'
    });

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminUser.id,
      action_type: status === 'approved' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      target_id: userId,
      details: status === 'approved' 
        ? `Aprovou os documentos de: ${userName} (${userEmail})` 
        : `Reprovou os documentos de: ${userName} (${userEmail}). Motivo: ${reason}`
    })

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})