// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HTML escape function to prevent XSS in emails
const escapeHtml = (str: string): string => {
  if (!str) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return str.replace(/[&<>"']/g, char => map[char]);
};

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
    
    // Comprehensive input validation
    if (!userEmail || typeof userEmail !== 'string' || !userEmail.includes('@') || userEmail.length > 255) {
      return new Response('Invalid Email', { status: 400, headers: corsHeaders })
    }
    if (!['approved', 'rejected'].includes(status)) {
      return new Response('Invalid Status', { status: 400, headers: corsHeaders })
    }
    if (userName && (typeof userName !== 'string' || userName.length > 200)) {
      return new Response('Invalid userName', { status: 400, headers: corsHeaders })
    }
    if (reason && (typeof reason !== 'string' || reason.length > 500)) {
      return new Response('Invalid reason', { status: 400, headers: corsHeaders })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.warn("[verification-result] RESEND_API_KEY não configurada. Simulando sucesso.")
      return new Response(JSON.stringify({ success: true, warning: 'E-mail não enviado (falta chave)' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const isApproved = status === 'approved'
    const subject = isApproved ? "Seu perfil foi aprovado! 🎉" : "Ação necessária no seu perfil ⚠️"
    
    // Escape HTML to prevent XSS in email clients
    const safeUserName = escapeHtml(userName || 'Usuário')
    const safeReason = escapeHtml(reason || 'Motivo não especificado')
    
    const htmlContent = isApproved 
      ? `<p>Olá <strong>${safeUserName}</strong>,</p><p>Seu perfil foi verificado com sucesso!</p>`
      : `<p>Olá <strong>${safeUserName}</strong>,</p><p>Sua verificação não foi aprovada: <strong>${safeReason}</strong></p>`

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
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})
