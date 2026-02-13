// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Resposta imediata para preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("[admin-delete-user] Iniciando processo de exclusão...");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validar quem está chamando a função
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error("[admin-delete-user] Token ausente");
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) {
      console.error("[admin-delete-user] Erro ao validar chamador:", authError);
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Verificação de Admin no banco
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, role')
      .eq('id', caller.id)
      .single()

    if (!profile?.is_admin && profile?.role !== 'admin') {
      console.error("[admin-delete-user] Acesso negado para:", caller.email);
      return new Response(JSON.stringify({ error: 'Acesso restrito a administradores' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const { targetUserId } = await req.json()
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'ID do usuário alvo é obrigatório' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Proteções de segurança
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', targetUserId)
      .single()

    if (caller.id === targetUserId) {
      return new Response(JSON.stringify({ error: 'Você não pode excluir sua própria conta por aqui' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (targetProfile?.email === "contato@homecarematch.com.br") {
      return new Response(JSON.stringify({ error: 'O administrador mestre não pode ser excluído' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`[admin-delete-user] Excluindo usuário: ${targetUserId} (${targetProfile?.email})`);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ message: 'Usuário excluído com sucesso' }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error("[admin-delete-user] Erro crítico:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})