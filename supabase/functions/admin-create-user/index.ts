// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Valid roles that can be assigned
const VALID_ROLES = ['professional', 'company', 'family'];

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
      registration,
      specialty,
      city,
      state,
      neighborhood,
      experience,
      professional_experiences,
      bio,
      avatar_url,
      phone,
      hourly_rate,
      id_document_url,
      prof_registration_url,
      company_name,
      cnpj,
      ans_registration, // New field
      availability,
      patient_profiles,
      address_zip,
      address_street,
      address_number,
      address_complement,
      lat,
      lng,
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
        registration,
        specialty,
        city,
        state,
        neighborhood,
        experience,
        professional_experiences,
        bio,
        avatar_url,
        phone,
        hourly_rate,
        id_document_url,
        prof_registration_url,
        company_name,
        cnpj,
        ans_registration, // New field
        availability,
        patient_profiles,
        address_zip,
        address_street,
        address_number,
        address_complement,
        lat,
        lng,
        is_verified,
        verification_sent,
        has_seen_onboarding,
        notifications_enabled
      }
    })

    if (createError) throw createError

    // The role is now set via the handle_new_user trigger using metadata,
    // so this direct update is no longer strictly necessary for the role itself,
    // but keeping it for other potential profile updates if needed.
    // For now, we rely on the trigger for initial profile population.
    // await supabaseAdmin.from('profiles').update({ role: sanitizedRole }).eq('id', newUser.user.id)

    return new Response(JSON.stringify({ message: 'Usuário criado com sucesso' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error("[admin-create-user] Erro:", error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})