// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeError = (error: any) => ({
  message: error?.message || "Erro desconhecido",
  code: error?.code || null,
  details: error?.details || null,
  hint: error?.hint || null,
});

const shouldIgnoreCleanupError = (error: any) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42P01" || // relation does not exist
    code === "42703" || // column does not exist
    code.startsWith("PGRST") || // postgrest schema mismatch
    message.includes("does not exist") ||
    message.includes("not found")
  );
};

const cleanupCandidates: Array<{ table: string; columns: string[] }> = [
  { table: "interactions", columns: ["sender_id", "professional_id", "company_id", "family_id", "user_id"] },
  { table: "referrals", columns: ["referrer_id", "referred_user_id", "user_id"] },
  { table: "support_tickets", columns: ["user_id"] },
  { table: "support_ticket_messages", columns: ["sender_id", "user_id"] },
  { table: "chatbot_sessions", columns: ["user_id"] },
  { table: "chatbot_usage_logs", columns: ["user_id", "last_user_id"] },
  { table: "chatbot_unanswered_questions", columns: ["last_user_id"] },
  { table: "concierge_requests", columns: ["user_id"] },
  { table: "push_subscriptions", columns: ["user_id"] },
  { table: "push_notifications", columns: ["created_by"] },
  { table: "notification_delivery_logs", columns: ["recipient_user_id", "user_id"] },
  { table: "whatsapp_notification_queue", columns: ["recipient_user_id", "user_id"] },
  { table: "user_notifications", columns: ["user_id"] },
  { table: "notifications", columns: ["user_id", "recipient_user_id"] },
  { table: "profile_views", columns: ["profile_id", "viewer_id", "user_id"] },
  { table: "profile_clicks", columns: ["profile_id", "clicker_id", "user_id"] },
  { table: "asaas_subscriptions", columns: ["user_id"] },
  { table: "asaas_payments", columns: ["user_id"] },
  { table: "payments", columns: ["user_id"] },
  { table: "subscriptions", columns: ["user_id"] },
  { table: "reports", columns: ["reporter_id", "reported_id", "user_id"] },
  { table: "course_enrollments", columns: ["user_id"] },
  { table: "certificates", columns: ["user_id"] },
  { table: "company_patients", columns: ["company_id", "professional_id", "family_id", "user_id"] },
];

const cleanupUserDependencies = async (supabaseAdmin: any, targetUserId: string) => {
  const warnings: any[] = [];
  let operations = 0;

  for (const candidate of cleanupCandidates) {
    for (const column of candidate.columns) {
      const { error } = await supabaseAdmin
        .from(candidate.table)
        .delete()
        .eq(column, targetUserId);

      if (!error) {
        operations += 1;
        continue;
      }

      if (shouldIgnoreCleanupError(error)) continue;

      warnings.push({
        table: candidate.table,
        column,
        ...normalizeError(error),
      });
    }
  }

  return { operations, warnings };
};

const extractBearerToken = (headerValue: string | null) => {
  if (!headerValue) return "";
  const trimmed = headerValue.trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  return (match?.[1] || "").trim();
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const tokenFromHeader = extractBearerToken(authHeader);
    const tokenFromBody = typeof payload?.access_token === "string" ? payload.access_token.trim() : "";
    const token = tokenFromHeader || tokenFromBody;
    if (!token) {
      return jsonResponse({ error: "Sessao invalida (token ausente)" }, 401);
    }

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return jsonResponse({ error: "Sessao invalida", auth: normalizeError(authError) }, 401);
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile?.is_admin && callerProfile?.role !== "admin") {
      return jsonResponse({ error: "Acesso negado" }, 403);
    }

    const targetUserId = typeof payload?.targetUserId === "string" ? payload.targetUserId.trim() : "";
    if (!targetUserId) return jsonResponse({ error: "targetUserId obrigatorio" }, 400);
    if (targetUserId === caller.id) {
      return jsonResponse({ error: "Nao e permitido excluir o proprio usuario admin por este endpoint" }, 400);
    }

    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", targetUserId)
      .single();

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: caller.id,
      action_type: "USER_DELETED",
      target_id: targetUserId,
      details: `Excluiu permanentemente o usuario: ${targetProfile?.full_name || "Sem nome"} (${targetProfile?.email || "Sem e-mail"})`,
    });

    const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    if (getUserError) {
      console.warn("[admin-delete-user] getUserById warning:", normalizeError(getUserError));
    }

    if (authUser?.user?.id) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

      if (deleteError) {
        const cleanup = await cleanupUserDependencies(supabaseAdmin, targetUserId);
        const { error: retryDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

        if (retryDeleteError) {
          return jsonResponse(
            {
              error: "Falha ao excluir usuario no auth",
              phase: "auth.admin.deleteUser",
              firstDeleteError: normalizeError(deleteError),
              retryDeleteError: normalizeError(retryDeleteError),
              cleanup,
              targetUserId,
              targetEmail: targetProfile?.email || null,
            },
            500,
          );
        }
      }
    } else {
      const cleanup = await cleanupUserDependencies(supabaseAdmin, targetUserId);
      const { error: profileDeleteError } = await supabaseAdmin.from("profiles").delete().eq("id", targetUserId);

      if (profileDeleteError) {
        return jsonResponse(
          {
            error: "Usuario ausente em auth.users e falha ao excluir perfil orfao",
            phase: "profiles.delete",
            profileDeleteError: normalizeError(profileDeleteError),
            cleanup,
            targetUserId,
            targetEmail: targetProfile?.email || null,
          },
          500,
        );
      }
    }

    return jsonResponse({ message: "Usuario excluido com sucesso", targetUserId }, 200);
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro interno inesperado" }, 500);
  }
});
