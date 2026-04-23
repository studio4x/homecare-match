// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireMappedExternalCourseId, syncLmsRelease } from "../_shared/lms-integration.ts";

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

    const { courseSlug } = await req.json().catch(() => ({}));
    const cleanCourseSlug = String(courseSlug || "").trim();
    if (!cleanCourseSlug) throw new Error("courseSlug obrigatorio.");

    const [{ data: profile }, { data: course }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,email,full_name,subscription_tier,is_admin,role")
        .eq("id", user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("academy_courses")
        .select("slug,title,price,external_course_id")
        .eq("slug", cleanCourseSlug)
        .maybeSingle(),
    ]);

    if (!course) throw new Error("Curso nao encontrado.");
    if (Number(course.price || 0) > 0 && !(profile?.is_admin || profile?.role === "admin")) {
      throw new Error("Curso pago deve seguir pelo checkout.");
    }

    const isAdmin = profile?.is_admin || profile?.role === "admin";
    const isYearly = profile?.subscription_tier === "yearly";
    if (!isAdmin && !isYearly) {
      return new Response(JSON.stringify({ error: "Cursos gratuitos sao exclusivos para assinantes do Plano Anual." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalCourseId = requireMappedExternalCourseId(course);
    const referenceId = `free:${user.id}:${cleanCourseSlug}`;
    const requestId = `free-enrollment:${user.id}:${cleanCourseSlug}`;
    const now = new Date().toISOString();

    const { error: enrollmentError } = await supabaseAdmin
      .from("academy_enrollments")
      .upsert(
        {
          user_id: user.id,
          course_slug: cleanCourseSlug,
          access_status: "active",
          release_source: "free_enrollment",
          external_reference_id: referenceId,
          created_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,course_slug" },
      );

    if (enrollmentError) throw enrollmentError;

    await syncLmsRelease(supabaseAdmin, {
      request_id: requestId,
      source_system: "homecare_match",
      release_source: "free_enrollment",
      external_reference_id: referenceId,
      user: {
        external_user_id: user.id,
        email: user.email || profile?.email || "",
        full_name: profile?.full_name || user.email || "Aluno HomeCare Match",
      },
      course: { external_course_id: externalCourseId },
      access: {
        status: "active",
        starts_at: now,
        ends_at: null,
        revoked_reason: null,
      },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Falha ao inscrever no curso." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
