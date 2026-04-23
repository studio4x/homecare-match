// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHs256Jwt, getEnv, requireMappedExternalCourseId } from "../_shared/lms-integration.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Autenticacao ausente.");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error("Usuario nao autenticado.");

    const body = await req.json().catch(() => ({}));
    const courseSlug = String(body?.courseSlug || "").trim();
    if (!courseSlug) throw new Error("courseSlug obrigatorio.");

    const [{ data: profile }, { data: course }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,full_name,is_admin,role").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("academy_courses").select("slug,title,external_course_id,content_url").eq("slug", courseSlug).maybeSingle(),
    ]);

    if (!course) throw new Error("Curso nao encontrado.");
    const externalCourseId = requireMappedExternalCourseId(course);
    const isAdmin = profile?.is_admin || profile?.role === "admin";

    if (!isAdmin) {
      const { data: enrollment } = await supabaseAdmin
        .from("academy_enrollments")
        .select("id,access_status,external_reference_id")
        .eq("user_id", user.id)
        .eq("course_slug", courseSlug)
        .maybeSingle();

      if (!enrollment || enrollment.access_status === "revoked" || enrollment.access_status === "expired") {
        return new Response(JSON.stringify({ error: "Usuario sem direito ativo ao curso." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: enrollment } = await supabaseAdmin
      .from("academy_enrollments")
      .select("external_reference_id")
      .eq("user_id", user.id)
      .eq("course_slug", courseSlug)
      .maybeSingle();

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = Math.max(60, Math.min(Number(Deno.env.get("HCM_ACCESS_TOKEN_TTL_SECONDS") || 90), 120));
    const claims = {
      iss: Deno.env.get("HCM_ACCESS_TOKEN_ISSUER") || "homecarematch",
      aud: Deno.env.get("HCM_ACCESS_TOKEN_AUDIENCE") || "homecarematch-lms",
      sub: user.id,
      email: user.email || profile?.email || "",
      source_system: "homecare_match",
      external_user_id: user.id,
      external_course_id: externalCourseId,
      external_reference_id: enrollment?.external_reference_id || null,
      target: "course",
      redirect_path: null,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + expiresIn,
    };

    const jwt = await createHs256Jwt(claims, getEnv("HCM_ACCESS_TOKEN_SECRET"));
    const accessUrl = new URL(getEnv("LMS_HCM_ACCESS_URL", `${getEnv("LMS_BASE_URL")}/auth/hcm-access`));
    accessUrl.searchParams.set("token", jwt);

    return new Response(JSON.stringify({ url: accessUrl.toString() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Falha ao gerar acesso LMS." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
