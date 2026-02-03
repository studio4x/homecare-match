// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Valida se quem está chamando é Admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', caller.id)
      .single()

    if (!profile?.is_admin) return new Response('Forbidden', { status: 403, headers: corsHeaders })

    // Lógica de criação
    const { email, password, fullName, role } = await req.json()

    console.log(`[admin-create-user] Criando usuário: ${email}`)

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Força o usuário a validar
      user_metadata: { full_name: fullName }
    })

    if (createError) throw createError

    // O trigger handle_new_user já criará o perfil, mas vamos garantir o role correto
    await supabaseAdmin
      .from('profiles')
      .update({ role: role })
      .eq('id', newUser.user.id)

    return new Response(
      JSON.stringify({ message: 'Usuário criado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("[admin-create-user] Erro:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})