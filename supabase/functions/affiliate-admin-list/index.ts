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

    const [{ data: config }, { data: partners }, { data: balances }, { data: attributions }, { data: batches }, { data: applications }] = await Promise.all([
      supabaseAdmin.from("affiliate_program_config").select("*").eq("id", 1).maybeSingle(),
      supabaseAdmin
        .from("affiliate_partners")
        .select("id,user_id,display_name,email,phone,pix_key,pix_key_type,status,is_external,notes,created_at,updated_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("affiliate_partner_balances").select("*"),
      supabaseAdmin.from("affiliate_attributions").select("id,affiliate_partner_id,referred_user_id,is_valid,attributed_at"),
      supabaseAdmin
        .from("affiliate_payout_batches")
        .select("id,period_label,period_start,period_end,status,minimum_amount,total_affiliates,total_entries,total_amount,approved_at,paid_at,payment_reference")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("affiliate_applications")
        .select("id,full_name,email,phone,city,state,pix_key,pix_key_type,audience,experience,message,status,affiliate_partner_id,reviewed_at,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const balanceMap = new Map<string, any>();
    (balances || []).forEach((row: any) => balanceMap.set(row.affiliate_partner_id, row));

    const statsByPartner = new Map<string, { total: number; valid: number }>();
    (attributions || []).forEach((row: any) => {
      const current = statsByPartner.get(row.affiliate_partner_id) || { total: 0, valid: 0 };
      current.total += 1;
      if (row.is_valid !== false) current.valid += 1;
      statsByPartner.set(row.affiliate_partner_id, current);
    });

    const partnerList = (partners || []).map((partner: any) => {
      const b = balanceMap.get(partner.id);
      const a = statsByPartner.get(partner.id) || { total: 0, valid: 0 };
      return {
        ...partner,
        attribution_total: a.total,
        attribution_valid: a.valid,
        shadow_balance: toMoney(b?.shadow_balance),
        available_balance: toMoney(b?.available_balance),
        reserved_balance: toMoney(b?.reserved_balance),
        paid_balance: toMoney(b?.paid_balance),
        lifetime_balance: toMoney(b?.lifetime_balance),
      };
    });

    return jsonResponse({
      config: config || {
        affiliate_program_enabled: false,
        affiliate_shadow_mode: true,
        signup_commission_amount: 50,
        recurring_commission_percent: 10,
        payout_minimum_amount: 100,
      },
      partners: partnerList,
      batches: batches || [],
      applications: applications || [],
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao listar afiliados" }, 500);
  }
});
