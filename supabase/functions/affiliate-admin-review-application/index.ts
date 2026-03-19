// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  getBaseUrl,
  getSupabaseAdmin,
  jsonResponse,
  parseBody,
  requireAdmin,
  requireUser,
  resolveToken,
  sanitizeSlug,
} from "../_shared/affiliate.ts";

const createShortLinkForPartner = async (supabaseAdmin: any, req: Request, partner: any, adminUserId: string) => {
  const { data: existingRows } = await supabaseAdmin
    .from("affiliate_short_links")
    .select("id,marketing_short_links(id,slug,target_url,is_active)")
    .eq("affiliate_partner_id", partner.id)
    .limit(1);

  const existing = existingRows?.[0]?.marketing_short_links;
  if (existing?.id && existing?.slug) {
    return {
      short_link_id: existing.id,
      slug: existing.slug,
      short_url: `${getBaseUrl(req).replace(/\/+$/, "")}/${existing.slug}`,
      reused: true,
    };
  }

  const preferredSlug = sanitizeSlug(
    `af-${partner.display_name || "parceiro"}-${Math.floor(Math.random() * 9000 + 1000)}`,
  );
  const campaignId = String(partner.id || "").slice(0, 8);
  const targetUrl = `${getBaseUrl(req).replace(/\/+$/, "")}/convite`;

  let createdLink: any = null;
  let finalSlug = preferredSlug;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? preferredSlug : `${preferredSlug}-${Math.floor(Math.random() * 900 + 100)}`;

    const { data, error } = await supabaseAdmin
      .from("marketing_short_links")
      .insert({
        name: `Afiliado - ${partner.display_name || "Parceiro"}`,
        slug: candidate,
        target_url: targetUrl,
        utm_source: "affiliate",
        utm_medium: "partner",
        utm_campaign: `affiliate-${campaignId}`,
        is_active: true,
        created_by: adminUserId,
      })
      .select("id,slug")
      .maybeSingle();

    if (!error && data?.id) {
      createdLink = data;
      finalSlug = candidate;
      break;
    }

    const isDuplicate = String(error?.message || "").toLowerCase().includes("duplicate");
    if (!isDuplicate) throw error;
  }

  if (!createdLink?.id) {
    throw new Error("Não foi possível criar link curto único para o afiliado.");
  }

  const { error: mapError } = await supabaseAdmin.from("affiliate_short_links").insert({
    affiliate_partner_id: partner.id,
    short_link_id: createdLink.id,
  });

  if (mapError) throw mapError;

  return {
    short_link_id: createdLink.id,
    slug: finalSlug,
    short_url: `${getBaseUrl(req).replace(/\/+$/, "")}/${finalSlug}`,
    reused: false,
  };
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

    const applicationId = String(body?.application_id || "").trim();
    const decision = String(body?.decision || "approved").trim().toLowerCase();

    if (!applicationId) return jsonResponse({ error: "application_id obrigatório" }, 400);
    if (!["approved", "rejected"].includes(decision)) {
      return jsonResponse({ error: "decision deve ser approved ou rejected" }, 400);
    }

    const { data: application, error: appError } = await supabaseAdmin
      .from("affiliate_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError) throw appError;
    if (!application?.id) return jsonResponse({ error: "Aplicação não encontrada" }, 404);

    const reviewedAt = new Date().toISOString();

    if (decision === "rejected") {
      const { error: rejectError } = await supabaseAdmin
        .from("affiliate_applications")
        .update({
          status: "rejected",
          reviewed_by: userResult.user.id,
          reviewed_at: reviewedAt,
          updated_at: reviewedAt,
        })
        .eq("id", application.id);

      if (rejectError) throw rejectError;
      return jsonResponse({ success: true, application_id: application.id, status: "rejected" });
    }

    let partner = null;

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id,role")
      .ilike("email", String(application.email || ""))
      .maybeSingle();

    if (existingProfile?.id) {
      return jsonResponse(
        {
          error:
            "Não é possível aprovar: o e-mail da candidatura já pertence a uma conta da plataforma. Afiliado deve ser parceiro dedicado.",
        },
        409,
      );
    }

    const { data: existingPartner } = await supabaseAdmin
      .from("affiliate_partners")
      .select("*")
      .ilike("email", String(application.email || ""))
      .maybeSingle();

    if (existingPartner?.id) {
      const { data: updatedPartner, error: updatePartnerError } = await supabaseAdmin
        .from("affiliate_partners")
        .update({
          display_name: existingPartner.display_name || application.full_name,
          phone: existingPartner.phone || application.phone || null,
          pix_key: existingPartner.pix_key || application.pix_key || null,
          pix_key_type: existingPartner.pix_key_type || application.pix_key_type || null,
          status: "active",
          is_external: true,
          updated_at: reviewedAt,
        })
        .eq("id", existingPartner.id)
        .select("*")
        .single();

      if (updatePartnerError) throw updatePartnerError;
      partner = updatedPartner;
    } else {
      const { data: createdPartner, error: createPartnerError } = await supabaseAdmin
        .from("affiliate_partners")
        .insert({
          user_id: null,
          display_name: application.full_name,
          email: application.email,
          phone: application.phone || null,
          pix_key: application.pix_key || null,
          pix_key_type: application.pix_key_type || null,
          is_external: true,
          status: "active",
          notes: application.message || null,
          created_by: userResult.user.id,
        })
        .select("*")
        .single();

      if (createPartnerError) throw createPartnerError;
      partner = createdPartner;
    }

    const link = await createShortLinkForPartner(supabaseAdmin, req, partner, userResult.user.id);

    const { error: approveError } = await supabaseAdmin
      .from("affiliate_applications")
      .update({
        status: "approved",
        reviewed_by: userResult.user.id,
        reviewed_at: reviewedAt,
        affiliate_partner_id: partner.id,
        updated_at: reviewedAt,
      })
      .eq("id", application.id);

    if (approveError) throw approveError;

    return jsonResponse({
      success: true,
      application_id: application.id,
      status: "approved",
      partner_id: partner.id,
      short_link_id: link.short_link_id,
      short_url: link.short_url,
      reused_link: link.reused,
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao revisar candidatura de afiliado" }, 500);
  }
});
