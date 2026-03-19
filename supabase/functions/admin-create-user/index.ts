// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Valid roles that can be assigned
const VALID_ROLES = ['professional', 'company', 'family', 'affiliate'];

// Validate email format
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
};

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

    // Verificação de Admin REAL no servidor
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, role')
      .eq('id', caller.id)
      .single()

    if (!profile?.is_admin && profile?.role !== 'admin') {
      return new Response('Forbidden: Acesso restrito a administradores', { status: 403, headers: corsHeaders })
    }

    const { 
      email, 
      password, 
      fullName, 
      role,
      phone,
      avatar_url,
      company_name, // New field
      cnpj, // New field
      ans_registration, // New field
      is_verified,
      verification_sent,
      has_seen_onboarding,
      notifications_enabled
    } = await req.json()
    
    // Comprehensive input validation
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return new Response('Invalid email format', { status: 400, headers: corsHeaders })
    }
    if (!password || typeof password !== 'string' || password.length < 6 || password.length > 72) {
      return new Response('Password must be 6-72 characters', { status: 400, headers: corsHeaders })
    }
    if (fullName && (typeof fullName !== 'string' || fullName.length > 200)) {
      return new Response('Invalid fullName (max 200 characters)', { status: 400, headers: corsHeaders })
    }
    
    // Validate role against allowed values
    const sanitizedRole = role && VALID_ROLES.includes(role) ? role : 'professional';

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        full_name: fullName,
        role: sanitizedRole, // Pass role to metadata for handle_new_user
        phone,
        avatar_url,
        company_name, // Pass new field
        cnpj, // Pass new field
        ans_registration, // Pass new field
        is_verified,
        verification_sent,
        has_seen_onboarding,
        notifications_enabled
      }
    })

    if (createError) throw createError

    return new Response(JSON.stringify({ message: 'Usuário criado com sucesso' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error("[admin-create-user] Erro:", error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})
