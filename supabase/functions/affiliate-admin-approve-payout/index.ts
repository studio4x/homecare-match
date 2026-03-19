// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  getSupabaseAdmin,
  jsonResponse,
  parseBody,
  requireAdmin,
  requireUser,
  resolveToken,
} from "../_shared/affiliate.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await parseBody(req);
    const token = resolveToken(req, body);

    const userResult = await requireUser(supabaseAdmin, token);
    if (userResult.error) return userResult.error;

    const adminResult = await requireAdmin(supabaseAdmin, userResult.user.id);
    if (adminResult.error) return adminResult.error;

    const periodLabel = String(body?.period_label || new Date().toISOString().slice(0, 7));

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("approve_affiliate_payout_batch", {
      p_admin_user_id: userResult.user.id,
      p_period_label: periodLabel,
    });

    if (rpcError) throw rpcError;

    const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!result) {
      return jsonResponse({ created: false, message: "Nenhum resultado retornado pela aprovação de lote." });
    }

    if (result.created === true && result.batch_id) {
      try {
        await supabaseAdmin.from("admin_logs").insert({
          admin_id: userResult.user.id,
          action_type: "AFFILIATE_PAYOUT_BATCH_APPROVED",
          target_id: result.batch_id,
          details: `Aprovou lote de afiliados ${result.batch_id} (${result.total_affiliates || 0} afiliado(s), total R$ ${Number(result.total_amount || 0).toFixed(2)}).`,
        });
      } catch (auditError) {
        console.warn("[affiliate-admin-approve-payout] falha ao registrar auditoria:", auditError);
      }
    }

    return jsonResponse({
      created: result.created === true,
      batch_id: result.batch_id || null,
      total_affiliates: Number(result.total_affiliates || 0),
      total_entries: Number(result.total_entries || 0),
      total_amount: Number(result.total_amount || 0),
      message: result.message || null,
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao aprovar lote de payout" }, 500);
  }
});

