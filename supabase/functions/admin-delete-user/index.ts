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

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    // Verificação rigorosa de Admin no servidor
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, role')
      .eq('id', caller.id)
      .single()

    if (!profile?.is_admin && profile?.role !== 'admin') {
      return new Response('Forbidden: Acesso restrito a administradores', { status: 403, headers: corsHeaders })
    }

    const { targetUserId } = await req.json()
    if (!targetUserId) return new Response('ID do usuário não fornecido', { status: 400, headers: corsHeaders })

    // Impedir que o admin se exclua ou exclua o master admin via API
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', targetUserId)
      .single()

    if (caller.id === targetUserId) {
      return new Response('Você não pode excluir sua própria conta por aqui', { status: 400, headers: corsHeaders })
    }

    if (targetProfile?.email === "contato@homecarematch.com.br") {
      return new Response('O administrador mestre não pode ser excluído', { status: 400, headers: corsHeaders })
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ message: 'Usuário excluído com sucesso' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error("[admin-delete-user] Erro:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})