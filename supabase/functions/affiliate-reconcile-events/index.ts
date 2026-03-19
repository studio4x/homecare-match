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

const PAID_STATUSES = ["RECEIVED", "CONFIRMED", "PAID", "SUCCEEDED"];
const INACTIVE_STATUSES = [
  "REFUND_PENDING",
  "REFUNDED",
  "CANCELED",
  "CANCELLED",
  "VOID",
  "DELETED",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
];

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

    const limit = Math.max(50, Math.min(Number(body?.limit || 1000), 5000));

    const { data: attributions, error: attrError } = await supabaseAdmin
      .from("affiliate_attributions")
      .select("referred_user_id")
      .eq("is_valid", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (attrError) throw attrError;

    let signupProcessed = 0;
    let signupInserted = 0;

    for (const row of attributions || []) {
      signupProcessed += 1;
      const { data } = await supabaseAdmin.rpc("generate_affiliate_signup_commission", {
        p_referred_user_id: row.referred_user_id,
        p_event_source: "profile_verification",
        p_event_source_id: String(row.referred_user_id),
      });
      if (data) signupInserted += 1;
    }

    const { data: paidTx, error: paidError } = await supabaseAdmin
      .from("payment_transactions")
      .select("id")
      .eq("transaction_type", "plan")
      .in("status", PAID_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (paidError) throw paidError;

    let recurringProcessed = 0;
    let recurringInserted = 0;

    for (const tx of paidTx || []) {
      recurringProcessed += 1;
      const { data } = await supabaseAdmin.rpc("generate_affiliate_recurring_commission", {
        p_payment_transaction_id: tx.id,
      });
      if (data) recurringInserted += 1;
    }

    const { data: inactiveTx, error: inactiveError } = await supabaseAdmin
      .from("payment_transactions")
      .select("id")
      .eq("transaction_type", "plan")
      .in("status", INACTIVE_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (inactiveError) throw inactiveError;

    let clawbackProcessed = 0;
    let clawbackInserted = 0;

    for (const tx of inactiveTx || []) {
      clawbackProcessed += 1;
      const { data } = await supabaseAdmin.rpc("generate_affiliate_clawback", {
        p_payment_transaction_id: tx.id,
      });
      if (data) clawbackInserted += 1;
    }

    return jsonResponse({
      success: true,
      limit,
      signup: { processed: signupProcessed, inserted: signupInserted },
      recurring: { processed: recurringProcessed, inserted: recurringInserted },
      clawback: { processed: clawbackProcessed, inserted: clawbackInserted },
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro na reconciliação de afiliados" }, 500);
  }
});

