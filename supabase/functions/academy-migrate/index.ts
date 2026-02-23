import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://rkjvtnadqkbwomgzyswr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[academy-migrate] Request received");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Check admin
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.is_admin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action || "create_tables";

  if (action === "create_tables") {
    const client = new Client(SUPABASE_DB_URL);
    try {
      await client.connect();

      const sql = `
      CREATE TABLE IF NOT EXISTS public.academy_courses (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        level TEXT,
        duration_minutes INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        hero_asset_url TEXT,
        content_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        price NUMERIC DEFAULT 0
      );

      ALTER TABLE public.academy_courses ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
      ALTER TABLE public.academy_courses ADD COLUMN IF NOT EXISTS video_source TEXT DEFAULT 'url';
      ALTER TABLE public.academy_courses ADD COLUMN IF NOT EXISTS video_url TEXT;
      ALTER TABLE public.academy_courses ADD COLUMN IF NOT EXISTS video_storage_path TEXT;
      ALTER TABLE public.academy_courses ADD COLUMN IF NOT EXISTS video_mime TEXT;

      CREATE TABLE IF NOT EXISTS public.academy_modules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_slug TEXT NOT NULL REFERENCES public.academy_courses(slug) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        position INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS public.academy_lessons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module_id UUID NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        duration_minutes INTEGER,
        resource_url TEXT,
        position INTEGER DEFAULT 1,
        storage_path TEXT,
        mime_type TEXT,
        content TEXT
      );

      ALTER TABLE public.academy_lessons ADD COLUMN IF NOT EXISTS content TEXT;

      ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
      `;

      await client.queryObject(sql);
      await client.end();
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      try { await client.end(); } catch {}
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});