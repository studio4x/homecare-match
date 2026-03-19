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

const isValidEmail = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const ensureAffiliateUserAccount = async (
  supabaseAdmin: any,
  req: Request,
  application: any,
  reviewedAt: string,
  sendAccessEmail: boolean,
) => {
  const email = String(application?.email || "").trim().toLowerCase();
  const fullName = String(application?.full_name || "").trim();
  const redirectTo = `${getBaseUrl(req).replace(/\/+$/, "")}/redefinir-senha`;

  if (!isValidEmail(email)) {
    throw new Error("Candidatura sem e-mail válido para criação de acesso.");
  }

  const findProfileByEmail = async () =>
    await supabaseAdmin
      .from("profiles")
      .select("id,role,is_admin,full_name,email")
      .ilike("email", email)
      .maybeSingle();

  let accountCreated = false;
  let accessEmailSent = false;
  let accessEmailError: string | null = null;

  let { data: existingProfile, error: existingProfileError } = await findProfileByEmail();
  if (existingProfileError) throw existingProfileError;

  if (existingProfile?.id && String(existingProfile.role || "").toLowerCase() !== "affiliate") {
    throw new Error(
      "Não é possível aprovar: o e-mail da candidatura já pertence a uma conta da plataforma. Afiliado deve ser parceiro dedicado.",
    );
  }

  let userId = existingProfile?.id || null;

  if (!userId) {
    const temporaryPassword = `${crypto.randomUUID()}Aa!`;
    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || null,
        role: "affiliate",
      },
    });

    if (createUserError) {
      const message = String(createUserError?.message || "").toLowerCase();
      const isDuplicated = message.includes("already registered") || message.includes("duplicate");

      if (!isDuplicated) throw createUserError;

      const { data: duplicatedProfile, error: duplicatedProfileError } = await findProfileByEmail();
      if (duplicatedProfileError) throw duplicatedProfileError;

      if (!duplicatedProfile?.id) {
        throw new Error(
          "Não foi possível vincular o acesso do afiliado. Conta já registrada sem perfil associado.",
        );
      }

      if (String(duplicatedProfile.role || "").toLowerCase() !== "affiliate") {
        throw new Error(
          "Não é possível aprovar: o e-mail da candidatura já pertence a uma conta da plataforma. Afiliado deve ser parceiro dedicado.",
        );
      }

      existingProfile = duplicatedProfile;
      userId = duplicatedProfile.id;
    } else {
      userId = createdUser?.user?.id || null;
      accountCreated = Boolean(userId);
    }
  }

  if (!userId) {
    throw new Error("Não foi possível identificar a conta de acesso do afiliado.");
  }

  const { error: profileUpsertError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName || existingProfile?.full_name || "Afiliado",
      email,
      role: "affiliate",
      is_admin: false,
      subscription_tier: null,
      subscription_end_at: null,
      trial_started_at: null,
      coupon_days: null,
      cancel_at_period_end: false,
      updated_at: reviewedAt,
    },
    { onConflict: "id" },
  );

  if (profileUpsertError) throw profileUpsertError;

  if (sendAccessEmail) {
    const { error: resetPasswordError } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
    accessEmailSent = !resetPasswordError;
    accessEmailError = resetPasswordError?.message || null;
  }

  return {
    userId,
    accountCreated,
    accessEmailSent,
    accessEmailError,
  };
};

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
    const sendAccessEmail = body?.send_access_email !== false;

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

    const alreadyApproved = application.status === "approved";
    const accountSetup = await ensureAffiliateUserAccount(supabaseAdmin, req, application, reviewedAt, sendAccessEmail);

    let partner = null;
    let existingPartner = null;
    if (application?.affiliate_partner_id) {
      const { data: partnerById } = await supabaseAdmin
        .from("affiliate_partners")
        .select("*")
        .eq("id", application.affiliate_partner_id)
        .maybeSingle();
      existingPartner = partnerById;
    }

    if (!existingPartner?.id) {
      const { data: partnerByEmail } = await supabaseAdmin
        .from("affiliate_partners")
        .select("*")
        .ilike("email", String(application.email || ""))
        .maybeSingle();
      existingPartner = partnerByEmail;
    }

    if (existingPartner?.id) {
      if (existingPartner.user_id && existingPartner.user_id !== accountSetup.userId) {
        return jsonResponse(
          {
            error: "Parceiro afiliado já vinculado a outro usuário. Revise o cadastro antes de aprovar novamente.",
          },
          409,
        );
      }

      const { data: updatedPartner, error: updatePartnerError } = await supabaseAdmin
        .from("affiliate_partners")
        .update({
          user_id: accountSetup.userId,
          display_name: existingPartner.display_name || application.full_name,
          phone: existingPartner.phone || application.phone || null,
          pix_key: existingPartner.pix_key || application.pix_key || null,
          pix_key_type: existingPartner.pix_key_type || application.pix_key_type || null,
          status: "active",
          is_external: false,
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
          user_id: accountSetup.userId,
          display_name: application.full_name,
          email: application.email,
          phone: application.phone || null,
          pix_key: application.pix_key || null,
          pix_key_type: application.pix_key_type || null,
          is_external: false,
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
      already_approved: alreadyApproved,
      account_created: accountSetup.accountCreated,
      access_email_sent: accountSetup.accessEmailSent,
      access_email_error: accountSetup.accessEmailError,
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao revisar candidatura de afiliado" }, 500);
  }
});
