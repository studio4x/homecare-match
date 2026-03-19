// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import nodemailer from "npm:nodemailer";
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
import {
  enqueueWhatsappQueueEntry,
  enqueueUserWhatsappNotification,
  getConfiguredTemplateNameForEvent,
  getTemplateNameForTarget,
  getWhatsappTemplateConfig,
  getWhatsappTemplateVariation,
  isWhatsappEnabled,
  normalizeBrazilPhoneToE164,
} from "../_shared/whatsapp.ts";
import { logNotificationDelivery } from "../_shared/notification-log.ts";

const isValidEmail = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
const escapeHtml = (value: unknown) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
const resolveSiteUrl = () => String(Deno.env.get("SITE_URL") || "https://www.homecarematch.com.br").replace(/\/+$/, "");

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
      .limit(1)
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

const resolveAffiliateRecipientUserId = async (supabaseAdmin: any, email: string, fallbackUserId?: string | null) => {
  if (fallbackUserId) return fallbackUserId;
  if (!isValidEmail(email)) return null;

  const { data: profileByEmail, error } = await supabaseAdmin
    .from("profiles")
    .select("id,role")
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    console.warn("[affiliate-admin-review-application] falha ao resolver perfil de afiliado:", error.message);
    return null;
  }

  if (!profileByEmail?.id) return null;
  if (String(profileByEmail.role || "").toLowerCase() !== "affiliate") return null;
  return profileByEmail.id;
};

const notifyAffiliateDecision = async ({
  supabaseAdmin,
  application,
  decision,
  recipientUserId,
  accessEmailSent = false,
}: {
  supabaseAdmin: any;
  application: any;
  decision: "approved" | "rejected";
  recipientUserId?: string | null;
  accessEmailSent?: boolean;
}) => {
  const fullName = String(application?.full_name || "Afiliado").trim() || "Afiliado";
  const email = String(application?.email || "").trim().toLowerCase();
  const eventType =
    decision === "approved" ? "affiliate_application_approved_user" : "affiliate_application_rejected_user";
  const detailsPath = decision === "approved" ? "/dashboard/afiliados" : "/afiliados";
  const widgetType = decision === "approved" ? "success" : "error";
  const widgetTitle =
    decision === "approved" ? "Candidatura de afiliado aprovada" : "Candidatura de afiliado rejeitada";
  const widgetContent =
    decision === "approved"
      ? "Sua candidatura foi aprovada. Acesse o painel de afiliados para acompanhar o link e os ganhos."
      : "Sua candidatura nao foi aprovada neste momento. Voce pode enviar um novo cadastro no futuro.";

  const finalRecipientUserId = await resolveAffiliateRecipientUserId(supabaseAdmin, email, recipientUserId);

  if (finalRecipientUserId) {
    try {
      const { error: widgetError } = await supabaseAdmin.from("notifications").insert({
        user_id: finalRecipientUserId,
        title: widgetTitle,
        content: widgetContent,
        link: detailsPath,
        type: widgetType,
      });

      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        channel: "widget",
        status: widgetError ? "failed" : "sent",
        recipientKind: "user",
        recipientUserId: finalRecipientUserId,
        recipientContact: email || null,
        title: widgetTitle,
        content: widgetContent,
        errorMessage: widgetError?.message || null,
        metadata: {
          application_id: application?.id || null,
          decision,
        },
      });
    } catch (error: any) {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        channel: "widget",
        status: "failed",
        recipientKind: "user",
        recipientUserId: finalRecipientUserId,
        recipientContact: email || null,
        title: widgetTitle,
        content: widgetContent,
        errorMessage: error?.message || String(error),
        metadata: {
          application_id: application?.id || null,
          decision,
        },
      });
    }
  } else {
    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      channel: "widget",
      status: "skipped",
      recipientKind: "external",
      recipientContact: email || null,
      title: widgetTitle,
      content: widgetContent,
      errorMessage: "missing_recipient_user_id",
      metadata: {
        application_id: application?.id || null,
        decision,
      },
    });
  }

  if (finalRecipientUserId) {
    try {
      const waConfig = await getWhatsappTemplateConfig(supabaseAdmin, eventType, "user");
      const statusText = getWhatsappTemplateVariation(
        waConfig,
        "status_text",
        String(
          waConfig?.var2Default ||
            (decision === "approved"
              ? "sua candidatura de afiliado foi aprovada"
              : "sua candidatura de afiliado foi rejeitada"),
        ),
      );
      const detailsValue = getWhatsappTemplateVariation(
        waConfig,
        "details_path",
        String(waConfig?.var3Default || detailsPath),
      );

      const queued = await enqueueUserWhatsappNotification({
        supabaseAdmin,
        userId: finalRecipientUserId,
        eventType,
        templateParams: [
          String(fullName || waConfig?.var1Default || "Afiliado"),
          statusText,
          detailsValue,
        ],
        payload: {
          application_id: application?.id || null,
          decision,
        },
      });

      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        channel: "whatsapp",
        status: queued?.queued
          ? "queued"
          : queued?.reason === "whatsapp_disabled" ||
              queued?.reason === "opt_in_disabled" ||
              queued?.reason === "invalid_phone" ||
              queued?.reason === "profile_not_found" ||
              queued?.reason === "missing_user_id"
            ? "skipped"
            : "failed",
        recipientKind: "user",
        recipientUserId: finalRecipientUserId,
        recipientContact: email || null,
        title: widgetTitle,
        content: widgetContent,
        errorMessage: queued?.queued ? null : queued?.reason || null,
        metadata: {
          application_id: application?.id || null,
          decision,
        },
      });
    } catch (error: any) {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        channel: "whatsapp",
        status: "failed",
        recipientKind: "user",
        recipientUserId: finalRecipientUserId,
        recipientContact: email || null,
        title: widgetTitle,
        content: widgetContent,
        errorMessage: error?.message || String(error),
        metadata: {
          application_id: application?.id || null,
          decision,
        },
      });
    }
  } else {
    try {
      if (!isWhatsappEnabled()) {
        await logNotificationDelivery({
          supabaseAdmin,
          eventType,
          channel: "whatsapp",
          status: "skipped",
          recipientKind: "external",
          recipientContact: email || null,
          title: widgetTitle,
          content: widgetContent,
          errorMessage: "whatsapp_disabled",
          metadata: {
            application_id: application?.id || null,
            decision,
          },
        });
      } else {
        const externalPhoneE164 = normalizeBrazilPhoneToE164(application?.phone || "");

        if (!externalPhoneE164) {
          await logNotificationDelivery({
            supabaseAdmin,
            eventType,
            channel: "whatsapp",
            status: "skipped",
            recipientKind: "external",
            recipientContact: email || null,
            title: widgetTitle,
            content: widgetContent,
            errorMessage: "invalid_candidate_phone",
            metadata: {
              application_id: application?.id || null,
              decision,
            },
          });
        } else {
          const waConfig = await getWhatsappTemplateConfig(supabaseAdmin, eventType, "user");
          const statusText = getWhatsappTemplateVariation(
            waConfig,
            "status_text",
            String(
              waConfig?.var2Default ||
                (decision === "approved"
                  ? "sua candidatura de afiliado foi aprovada"
                  : "sua candidatura de afiliado foi rejeitada"),
            ),
          );
          const detailsValue = getWhatsappTemplateVariation(
            waConfig,
            "details_path",
            String(waConfig?.var3Default || detailsPath),
          );
          const configuredTemplateName = await getConfiguredTemplateNameForEvent(supabaseAdmin, "user", eventType);

          const queued = await enqueueWhatsappQueueEntry({
            supabaseAdmin,
            eventType,
            targetKind: "user",
            recipientPhoneE164: externalPhoneE164,
            templateName: configuredTemplateName || getTemplateNameForTarget("user", eventType),
            templateParams: [
              String(fullName || waConfig?.var1Default || "Afiliado"),
              statusText,
              detailsValue,
            ],
            payload: {
              application_id: application?.id || null,
              decision,
              source: "affiliate_application_review_external",
            },
          });

          await logNotificationDelivery({
            supabaseAdmin,
            eventType,
            channel: "whatsapp",
            status: queued?.queued ? "queued" : queued?.reason === "whatsapp_disabled" ? "skipped" : "failed",
            recipientKind: "external",
            recipientContact: email || null,
            title: widgetTitle,
            content: widgetContent,
            errorMessage: queued?.queued ? null : queued?.reason || null,
            metadata: {
              application_id: application?.id || null,
              decision,
              recipient_phone_e164: externalPhoneE164,
            },
          });
        }
      }
    } catch (error: any) {
      await logNotificationDelivery({
        supabaseAdmin,
        eventType,
        channel: "whatsapp",
        status: "failed",
        recipientKind: "external",
        recipientContact: email || null,
        title: widgetTitle,
        content: widgetContent,
        errorMessage: error?.message || String(error),
        metadata: {
          application_id: application?.id || null,
          decision,
        },
      });
    }
  }

  if (!isValidEmail(email)) {
    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      channel: "email",
      status: "skipped",
      recipientKind: "external",
      recipientContact: email || null,
      title: widgetTitle,
      errorMessage: "invalid_candidate_email",
      metadata: {
        application_id: application?.id || null,
        decision,
      },
    });
    return;
  }

  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpPort = Deno.env.get("SMTP_PORT") || "587";
  const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass);

  if (!hasSmtp) {
    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      channel: "email",
      status: "skipped",
      recipientKind: finalRecipientUserId ? "user" : "external",
      recipientUserId: finalRecipientUserId,
      recipientContact: email,
      title: widgetTitle,
      errorMessage: "smtp_not_configured",
      metadata: {
        application_id: application?.id || null,
        decision,
      },
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number.parseInt(smtpPort, 10),
    secure: smtpPort === "465",
    auth: { user: smtpUser, pass: smtpPass },
  });

  const siteUrl = resolveSiteUrl();
  const emailSubject =
    decision === "approved" ? "Sua candidatura de afiliado foi aprovada" : "Atualizacao da sua candidatura de afiliado";

  const emailHtml =
    decision === "approved"
      ? `
        <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 680px; margin: 0 auto; padding: 20px;">
          <h2 style="margin: 0 0 12px; color: #16a34a;">Candidatura aprovada</h2>
          <p style="margin: 0 0 12px;">Ola, ${escapeHtml(fullName)}.</p>
          <p style="margin: 0 0 12px;">Sua candidatura para o programa de afiliados foi aprovada.</p>
          <p style="margin: 0 0 16px;">
            ${accessEmailSent
              ? "Enviamos tambem um e-mail de acesso para definir sua senha e entrar no painel."
              : "Seu acesso esta ativo. Caso necessario, utilize a recuperacao de senha para entrar no painel."}
          </p>
          <a href="${siteUrl}/dashboard/afiliados" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
            Acessar painel do afiliado
          </a>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; color: #1f2937; max-width: 680px; margin: 0 auto; padding: 20px;">
          <h2 style="margin: 0 0 12px; color: #dc2626;">Candidatura nao aprovada</h2>
          <p style="margin: 0 0 12px;">Ola, ${escapeHtml(fullName)}.</p>
          <p style="margin: 0 0 12px;">
            No momento, sua candidatura para o programa de afiliados nao foi aprovada.
          </p>
          <p style="margin: 0 0 16px;">
            Voce pode revisar seus dados e enviar uma nova candidatura futuramente.
          </p>
          <a href="${siteUrl}/afiliados" style="display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px;">
            Ver pagina de afiliados
          </a>
        </div>
      `;

  try {
    await transporter.sendMail({
      from: `"HomeCare Match" <${smtpUser}>`,
      to: email,
      subject: emailSubject,
      html: emailHtml,
    });

    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      channel: "email",
      status: "sent",
      recipientKind: finalRecipientUserId ? "user" : "external",
      recipientUserId: finalRecipientUserId,
      recipientContact: email,
      title: emailSubject,
      metadata: {
        application_id: application?.id || null,
        decision,
      },
    });
  } catch (error: any) {
    await logNotificationDelivery({
      supabaseAdmin,
      eventType,
      channel: "email",
      status: "failed",
      recipientKind: finalRecipientUserId ? "user" : "external",
      recipientUserId: finalRecipientUserId,
      recipientContact: email,
      title: emailSubject,
      errorMessage: error?.message || String(error),
      metadata: {
        application_id: application?.id || null,
        decision,
      },
    });
  }
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

      if (application.status !== "rejected") {
        try {
          await notifyAffiliateDecision({
            supabaseAdmin,
            application: {
              ...application,
              status: "rejected",
              reviewed_at: reviewedAt,
            },
            decision: "rejected",
          });
        } catch (notifyError: any) {
          console.warn(
            "[affiliate-admin-review-application] falha ao notificar rejeicao:",
            notifyError?.message || notifyError,
          );
        }
      }

      try {
        await supabaseAdmin.from("admin_logs").insert({
          admin_id: userResult.user.id,
          action_type: "AFFILIATE_APPLICATION_REJECTED",
          target_id: application.id,
          details: `Rejeitou candidatura de afiliado (${application.email || "sem-email"}).`,
        });
      } catch (auditError) {
        console.warn(
          "[affiliate-admin-review-application] falha ao registrar auditoria de rejeicao:",
          auditError,
        );
      }

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
        .limit(1)
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

    if (!alreadyApproved) {
      try {
        await notifyAffiliateDecision({
          supabaseAdmin,
          application: {
            ...application,
            status: "approved",
            reviewed_at: reviewedAt,
          },
          decision: "approved",
          recipientUserId: accountSetup.userId,
          accessEmailSent: accountSetup.accessEmailSent,
        });
      } catch (notifyError: any) {
        console.warn(
          "[affiliate-admin-review-application] falha ao notificar aprovacao:",
          notifyError?.message || notifyError,
        );
      }
    }

    try {
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: userResult.user.id,
        action_type: alreadyApproved ? "AFFILIATE_APPLICATION_ACCESS_RESEND" : "AFFILIATE_APPLICATION_APPROVED",
        target_id: application.id,
        details: alreadyApproved
          ? `Reenviou acesso para afiliado aprovado (${application.email || "sem-email"}).`
          : `Aprovou candidatura de afiliado (${application.email || "sem-email"}) e vinculou parceiro ${partner.id}.`,
      });
    } catch (auditError) {
      console.warn(
        "[affiliate-admin-review-application] falha ao registrar auditoria de aprovacao:",
        auditError,
      );
    }

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
