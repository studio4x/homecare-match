// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // A chave de serviço é necessária para excluir usuários de auth.users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Pegar o token de quem está chamando para validar a identidade
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Não autorizado', { status: 401, headers: corsHeaders })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error("[delete-user] Erro de autenticação:", authError)
      return new Response('Usuário não autenticado', { status: 401, headers: corsHeaders })
    }

    console.log(`[delete-user] Iniciando exclusão definitiva do usuário: ${user.id}`)

    // Excluir o usuário do auth.users (isso disparará o CASCADE no banco para o perfil)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error("[delete-user] Erro ao excluir:", deleteError)
      throw deleteError
    }

    return new Response(
      JSON.stringify({ message: 'Conta excluída com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("[delete-user] Erro crítico:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})