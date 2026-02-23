// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const authHeader = req.headers.get('Authorization')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: corsHeaders })

    const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin, role').eq('id', caller.id).single()
    if (!profile?.is_admin && profile?.role !== 'admin') return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: corsHeaders })

    const { targetUserId } = await req.json()
    const { data: targetProfile } = await supabaseAdmin.from('profiles').select('email, full_name').eq('id', targetUserId).single()

    // REGISTRO DE AUDITORIA
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: caller.id,
      action_type: 'USER_DELETED',
      target_id: targetUserId,
      details: `Excluiu permanentemente o usuário: \${targetProfile?.full_name} (\${targetProfile?.email})`
    })

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ message: 'Usuário excluído com sucesso' }), { status: 200, headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})