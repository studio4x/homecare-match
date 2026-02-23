// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  const supabasePublic = createClient(SUPABASE_URL, ANON)
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE)

  // Auth check (admin only)
  const authHeader = req.headers.get("Authorization") || ""
  const token = authHeader.replace("Bearer ", "")
  const { data: userData } = await supabasePublic.auth.getUser(token)
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, role")
    .eq("id", userData.user.id)
    .maybeSingle()

  const isAdmin = !!(profile?.is_admin || profile?.role === "admin")
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    // ignore
  }

  const action = body?.action || "get"
  const userId = body?.userId
  const path = userId ? `referrals/overrides/${userId}.json` : null

  if (action === "get") {
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const { data: file } = await supabaseAdmin.storage.from("uploads").download(path!)
    if (!file) {
      return new Response(JSON.stringify({ override: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const text = await file.text()
    let overrideJson = null
    try {
      overrideJson = JSON.parse(text)
    } catch {
      // ignore
    }
    return new Response(JSON.stringify({ override: overrideJson }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (action === "set") {
    if (!userId || !body?.tier) {
      return new Response(JSON.stringify({ error: "userId_and_tier_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    const blob = new Blob([JSON.stringify(body.tier)], { type: "application/json" })
    const { error } = await supabaseAdmin.storage.from("uploads").upload(path!, blob, { upsert: true })
    if (error) {
      return new Response(JSON.stringify({ error: "upload_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (action === "clear") {
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    await supabaseAdmin.storage.from("uploads").remove([path!])
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ error: "invalid_action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})