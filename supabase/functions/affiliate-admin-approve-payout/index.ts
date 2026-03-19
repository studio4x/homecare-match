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
  toMoney,
} from "../_shared/affiliate.ts";

type LedgerRow = {
  id: string;
  affiliate_partner_id: string;
  direction: "credit" | "debit";
  amount: number;
};

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

    const { data: config } = await supabaseAdmin
      .from("affiliate_program_config")
      .select("payout_minimum_amount")
      .eq("id", 1)
      .maybeSingle();

    const minimumAmount = Number(config?.payout_minimum_amount || 100);

    const { data: ledgerRows, error: ledgerError } = await supabaseAdmin
      .from("affiliate_commission_ledger")
      .select("id,affiliate_partner_id,direction,amount")
      .eq("entry_status", "available")
      .is("payout_item_id", null)
      .order("created_at", { ascending: true })
      .limit(10000);

    if (ledgerError) throw ledgerError;

    const grouped = new Map<string, LedgerRow[]>();
    for (const row of (ledgerRows || []) as LedgerRow[]) {
      const arr = grouped.get(row.affiliate_partner_id) || [];
      arr.push(row);
      grouped.set(row.affiliate_partner_id, arr);
    }

    const partnerIds = Array.from(grouped.keys());
    if (partnerIds.length === 0) {
      return jsonResponse({ message: "Nenhuma comissão disponível para pagamento.", created: false });
    }

    const { data: partners } = await supabaseAdmin
      .from("affiliate_partners")
      .select("id,display_name,pix_key,pix_key_type,status")
      .in("id", partnerIds);

    const partnerMap = new Map<string, any>();
    (partners || []).forEach((p: any) => partnerMap.set(p.id, p));

    const eligible: Array<{ partner: any; entries: LedgerRow[]; amount: number }> = [];

    for (const [partnerId, entries] of grouped.entries()) {
      const partner = partnerMap.get(partnerId);
      if (!partner || partner.status !== "active") continue;

      const net = entries.reduce((acc, row) => acc + (row.direction === "debit" ? -Number(row.amount || 0) : Number(row.amount || 0)), 0);
      const amount = toMoney(net);
      if (amount < minimumAmount) continue;
      if (!partner.pix_key) continue;

      eligible.push({ partner, entries, amount });
    }

    if (eligible.length === 0) {
      return jsonResponse({
        message: "Nenhum afiliado elegível para lote (mínimo, status, ou PIX ausente).",
        created: false,
      });
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("affiliate_payout_batches")
      .insert({
        period_label: String(body?.period_label || new Date().toISOString().slice(0, 7)),
        status: "approved",
        minimum_amount: minimumAmount,
        approved_by: userResult.user.id,
        approved_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (batchError) throw batchError;

    let totalAmount = 0;
    let totalEntries = 0;

    for (const item of eligible) {
      const { data: payoutItem, error: itemError } = await supabaseAdmin
        .from("affiliate_payout_items")
        .insert({
          batch_id: batch.id,
          affiliate_partner_id: item.partner.id,
          amount: item.amount,
          entry_count: item.entries.length,
          status: "reserved",
          pix_key: item.partner.pix_key,
          pix_key_type: item.partner.pix_key_type || null,
        })
        .select("id")
        .single();

      if (itemError) throw itemError;

      const ledgerIds = item.entries.map((entry) => entry.id);
      const { error: reserveError } = await supabaseAdmin
        .from("affiliate_commission_ledger")
        .update({ entry_status: "reserved", payout_item_id: payoutItem.id, updated_at: new Date().toISOString() })
        .in("id", ledgerIds);

      if (reserveError) throw reserveError;

      totalAmount += item.amount;
      totalEntries += item.entries.length;
    }

    const { error: updateBatchError } = await supabaseAdmin
      .from("affiliate_payout_batches")
      .update({
        total_affiliates: eligible.length,
        total_entries: totalEntries,
        total_amount: toMoney(totalAmount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    if (updateBatchError) throw updateBatchError;

    return jsonResponse({
      created: true,
      batch_id: batch.id,
      total_affiliates: eligible.length,
      total_entries: totalEntries,
      total_amount: toMoney(totalAmount),
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao aprovar lote de payout" }, 500);
  }
});

