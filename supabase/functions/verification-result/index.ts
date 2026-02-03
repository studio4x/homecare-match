// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validar se quem chama é ADMIN
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !caller) return new Response('Invalid session', { status: 401, headers: corsHeaders })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, role')
      .eq('id', caller.id)
      .single()

    if (!profile?.is_admin && profile?.role !== 'admin') {
      return new Response('Forbidden: Admin access required', { status: 403, headers: corsHeaders })
    }

    const { status, reason, userName, userEmail } = await req.json()
    if (!userEmail || !status) return new Response('Missing data', { status: 400, headers: corsHeaders })

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) return new Response('Mail config missing', { status: 500, headers: corsHeaders })

    const isApproved = status === 'approved'
    const subject = isApproved ? "Seu perfil foi aprovado! 🎉" : "Ação necessária no seu perfil ⚠️"
    
    const htmlContent = isApproved 
      ? `<p>Olá <strong>${userName}</strong>,</p><p>Seu perfil foi verificado com sucesso!</p>`
      : `<p>Olá <strong>${userName}</strong>,</p><p>Sua verificação não foi aprovada: <strong>${reason}</strong></p>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'HomeCareMatch <onboarding@resend.dev>',
        to: [userEmail],
        subject: subject,
        html: htmlContent,
      }),
    })

    return new Response(JSON.stringify({ success: res.ok }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[verification-result] Erro:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})