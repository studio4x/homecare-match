import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = "https://rkjvtnadqkbomgzyswr.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[setup-kyc-storage] Iniciando configuração...");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const client = new Client(SUPABASE_DB_URL);
  try {
    // 1. Criar bucket 'documents' como privado
    const { data: bucket, error: bucketErr } = await supabaseAdmin.storage.getBucket('documents');
    if (bucketErr || !bucket) {
      console.log("[setup-kyc-storage] Criando bucket 'documents'...");
      await supabaseAdmin.storage.createBucket('documents', { public: false });
    } else if (bucket.public) {
      console.log("[setup-kyc-storage] Alterando bucket para privado...");
      await supabaseAdmin.storage.updateBucket('documents', { public: false });
    }

    // 2. Configurar RLS no Storage via SQL
    await client.connect();
    const sql = `
      -- Permitir que usuários façam upload apenas para sua própria pasta
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload their own documents') THEN
          CREATE POLICY "Users can upload their own documents" ON storage.objects
          FOR INSERT TO authenticated
          WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
        END IF;

        -- Permitir que usuários vejam seus próprios documentos
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own documents') THEN
          CREATE POLICY "Users can view their own documents" ON storage.objects
          FOR SELECT TO authenticated
          USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
        END IF;

        -- Permitir que administradores vejam tudo
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all documents') THEN
          CREATE POLICY "Admins can view all documents" ON storage.objects
          FOR SELECT TO authenticated
          USING (bucket_id = 'documents' AND check_is_admin());
        END IF;
      END
      $$;
    `;
    await client.queryObject(sql);
    await client.end();

    return new Response(JSON.stringify({ ok: true, message: "Segurança de arquivos configurada!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[setup-kyc-storage] Erro:", e);
    try { await client.end(); } catch {}
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});