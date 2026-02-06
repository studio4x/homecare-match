import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://rkjvtnadqkbwomgzyswr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJranZ0bmFkcWtid29tZ3p5c3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNjI3NTAsImV4cCI6MjA4NTYzODc1MH0.Xc1l3rYeR3zs-9ZRsAtvYDrhnXHvyydf6VmpCoLNeFI";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PRIVATE_BUCKET = "academy-private";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[academy-storage-setup] Request received");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.error("[academy-storage-setup] Missing Authorization header");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    console.error("[academy-storage-setup] Invalid token", { userErr });
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Check admin
  const { data: profile, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id,is_admin,role")
    .eq("id", userData.user.id)
    .single();

  if (profErr || !profile?.is_admin) {
    console.error("[academy-storage-setup] Not admin", { profErr });
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action || "setup";

  if (action !== "setup") {
    console.warn("[academy-storage-setup] Unknown action", action);
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Create private bucket if needed
  try {
    const { data: existing } = await supabaseAdmin.storage.getBucket(PRIVATE_BUCKET);
    if (!existing) {
      console.log("[academy-storage-setup] Creating private bucket:", PRIVATE_BUCKET);
      const { error: createErr } = await supabaseAdmin.storage.createBucket(PRIVATE_BUCKET, { public: false });
      if (createErr) {
        console.error("[academy-storage-setup] Bucket create error", createErr);
        return new Response(JSON.stringify({ error: "Bucket create failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      console.log("[academy-storage-setup] Bucket already exists");
    }
  } catch (e) {
    console.error("[academy-storage-setup] Bucket check/create error", e);
    return new Response(JSON.stringify({ error: "Bucket check/create failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Create RLS policies on storage.objects
  const client = new Client(SUPABASE_DB_URL);
  try {
    await client.connect();

    const sql = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'academy_private_read_enrolled'
      ) THEN
        CREATE POLICY "academy_private_read_enrolled" ON storage.objects
        FOR SELECT TO authenticated
        USING (
          (bucket_id = '${PRIVATE_BUCKET}')
          AND EXISTS (
            SELECT 1 FROM public.academy_enrollments e
            WHERE e.user_id = auth.uid()
              AND e.course_slug = split_part(name, '/', 2)
          )
        );
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'academy_private_admin_write'
      ) THEN
        CREATE POLICY "academy_private_admin_write" ON storage.objects
        FOR ALL TO authenticated
        USING (check_is_admin())
        WITH CHECK (check_is_admin());
      END IF;
    END
    $$;
    `;

    await client.queryObject(sql);
    await client.end();

    console.log("[academy-storage-setup] Bucket and policies ready");
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[academy-storage-setup] Policy create error", e);
    try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: "Policy setup failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});