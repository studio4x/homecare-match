// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  getBaseUrl,
  getSupabaseAdmin,
  jsonResponse,
  parseBody,
  requireUser,
  resolveToken,
  toMoney,
} from "../_shared/affiliate.ts";

const ensurePartner = async (supabaseAdmin: any, userId: string) => {
  const { data: existing } = await supabaseAdmin
    .from("affiliate_partners")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,email,phone")
    .eq("id", userId)
    .maybeSingle();

  const payload = {
    user_id: userId,
    display_name: String(profile?.full_name || profile?.email || "Afiliado"),
    email: profile?.email || null,
    phone: profile?.phone || null,
    is_external: false,
    status: "active",
    created_by: userId,
  };

  const { data: created, error } = await supabaseAdmin
    .from("affiliate_partners")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return created;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await parseBody(req);
    const token = resolveToken(req, body);

    const userResult = await requireUser(supabaseAdmin, token);
    if (userResult.error) return userResult.error;

    const user = userResult.user;
    const partner = await ensurePartner(supabaseAdmin, user.id);

    const [{ data: cfg }, { data: balance }, { data: linkRows }, { data: ledgerRows }, { data: payoutRows }] = await Promise.all([
      supabaseAdmin.from("affiliate_program_config").select("*").eq("id", 1).maybeSingle(),
      supabaseAdmin.from("affiliate_partner_balances").select("*").eq("affiliate_partner_id", partner.id).maybeSingle(),
      supabaseAdmin
        .from("affiliate_short_links")
        .select("id,short_link_id,created_at,marketing_short_links(id,slug,target_url,is_active,created_at)")
        .eq("affiliate_partner_id", partner.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("affiliate_commission_ledger")
        .select("id,referred_user_id,entry_type,direction,amount,currency,description,event_source,event_source_id,entry_status,payment_id,created_at")
        .eq("affiliate_partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("affiliate_payout_items")
        .select("id,amount,status,payment_reference,created_at,batch:affiliate_payout_batches(id,period_label,status,approved_at,paid_at,payment_reference,payment_proof_url)")
        .eq("affiliate_partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const referredIds = Array.from(new Set((ledgerRows || []).map((row: any) => row.referred_user_id).filter(Boolean)));
    let referredProfilesMap = new Map<string, any>();
    if (referredIds.length > 0) {
      const { data: referredProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id,full_name,email")
        .in("id", referredIds);
      (referredProfiles || []).forEach((profile: any) => referredProfilesMap.set(profile.id, profile));
    }

    const baseUrl = getBaseUrl(req).replace(/\/+$/, "");

    const links = (linkRows || []).map((row: any) => {
      const link = row.marketing_short_links;
      const slug = String(link?.slug || "").trim();
      return {
        id: row.id,
        short_link_id: row.short_link_id,
        slug,
        target_url: link?.target_url || null,
        is_active: link?.is_active !== false,
        short_url: slug ? `${baseUrl}/${slug}` : null,
        created_at: row.created_at,
      };
    });

    const ledger = (ledgerRows || []).map((row: any) => {
      const referred = referredProfilesMap.get(row.referred_user_id);
      return {
        ...row,
        signed_amount: row.direction === "debit" ? -toMoney(row.amount) : toMoney(row.amount),
        referred_name: referred?.full_name || "Indicado",
        referred_email: referred?.email || null,
      };
    });

    return jsonResponse({
      partner,
      config: cfg || {
        affiliate_program_enabled: false,
        affiliate_shadow_mode: true,
        signup_commission_amount: 50,
        recurring_commission_percent: 10,
        payout_minimum_amount: 100,
      },
      balances: {
        shadow_balance: toMoney(balance?.shadow_balance),
        available_balance: toMoney(balance?.available_balance),
        reserved_balance: toMoney(balance?.reserved_balance),
        paid_balance: toMoney(balance?.paid_balance),
        lifetime_balance: toMoney(balance?.lifetime_balance),
      },
      links,
      ledger,
      payouts: payoutRows || [],
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao carregar dashboard de afiliado" }, 500);
  }
});
