// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[record-referral] request received")

  let payload: { referrerId?: string; newUserId?: string } = {}
  try {
    payload = await req.json()
  } catch (e) {
    console.error("[record-referral] invalid json", e)
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { referrerId, newUserId } = payload

  if (!referrerId || !newUserId) {
    console.error("[record-referral] missing params", { referrerId, newUserId })
    return new Response(JSON.stringify({ error: "referrerId and newUserId are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    const path = `referrals/${referrerId}/${newUserId}.json`
    const data = { referrerId, newUserId, created_at: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
    const { error: uploadError } = await supabase.storage.from("uploads").upload(path, blob, { upsert: true })

    if (uploadError) {
      console.error("[record-referral] upload error", uploadError)
      return new Response(JSON.stringify({ error: "upload_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    console.log("[record-referral] referral recorded", { referrerId, newUserId })

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    console.error("[record-referral] unexpected error", e)
    return new Response(JSON.stringify({ error: "unexpected_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})