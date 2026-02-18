// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const { referrerId, newUserId } = await req.json()
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    const path = `referrals/${referrerId}/${newUserId}.json`
    const data = { referrerId, newUserId, created_at: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
    await supabase.storage.from("uploads").upload(path, blob, { upsert: true })

    const { data: newUser } = await supabase.from('profiles').select('full_name').eq('id', newUserId).single();
    
    await supabase.from('notifications').insert({
      user_id: referrerId,
      title: "🤝 Indicação Convertida!",
      content: `${newUser?.full_name || 'Um novo usuário'} acabou de se cadastrar usando seu link. Você está mais perto do próximo selo!`,
      link: "/dashboard/indicacoes",
      type: 'success'
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})