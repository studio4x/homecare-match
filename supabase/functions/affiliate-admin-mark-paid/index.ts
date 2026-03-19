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

    const batchId = String(body?.batch_id || "").trim();
    if (!batchId) return jsonResponse({ error: "batch_id obrigatório" }, 400);

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("affiliate_payout_batches")
      .select("id,status")
      .eq("id", batchId)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch?.id) return jsonResponse({ error: "Lote não encontrado" }, 404);
    if (batch.status === "paid") return jsonResponse({ message: "Lote já estava pago", already_paid: true });

    const paidAt = new Date().toISOString();
    const paymentReference = String(body?.payment_reference || "").trim() || null;
    const paymentProofUrl = String(body?.payment_proof_url || "").trim() || null;
    const notes = String(body?.notes || "").trim() || null;

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("affiliate_payout_items")
      .select("id")
      .eq("batch_id", batchId);

    if (itemsError) throw itemsError;

    const itemIds = (items || []).map((item: any) => item.id).filter(Boolean);

    if (itemIds.length > 0) {
      const { error: itemsUpdateError } = await supabaseAdmin
        .from("affiliate_payout_items")
        .update({
          status: "paid",
          payment_reference: paymentReference,
          payment_proof_url: paymentProofUrl,
          updated_at: paidAt,
        })
        .in("id", itemIds);

      if (itemsUpdateError) throw itemsUpdateError;

      const { error: ledgerUpdateError } = await supabaseAdmin
        .from("affiliate_commission_ledger")
        .update({ entry_status: "paid", updated_at: paidAt })
        .in("payout_item_id", itemIds);

      if (ledgerUpdateError) throw ledgerUpdateError;
    }

    const { error: batchUpdateError } = await supabaseAdmin
      .from("affiliate_payout_batches")
      .update({
        status: "paid",
        paid_by: userResult.user.id,
        paid_at: paidAt,
        payment_reference: paymentReference,
        payment_proof_url: paymentProofUrl,
        notes,
        updated_at: paidAt,
      })
      .eq("id", batchId);

    if (batchUpdateError) throw batchUpdateError;

    return jsonResponse({ success: true, batch_id: batchId, item_count: itemIds.length, paid_at: paidAt });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao marcar lote como pago" }, 500);
  }
});

