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
  sanitizeSlug,
} from "../_shared/affiliate.ts";

const getPartnerForUser = async (supabaseAdmin: any, userId: string) => {
  const { data: partner } = await supabaseAdmin
    .from("affiliate_partners")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!partner?.id) {
    throw new Error("Conta sem perfil de afiliado habilitado.");
  }

  return partner;
};

const buildTargetUrl = (baseUrl: string, targetPath: string) => {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const rawPath = String(targetPath || "/convite").trim();
  const safePath = rawPath.replace(/^https?:\/\/[^/]+/i, "");
  const normalizedPath = safePath.startsWith("/") ? safePath : `/${safePath}`;
  return `${base}${normalizedPath}`;
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
    const partner = await getPartnerForUser(supabaseAdmin, user.id);

    const forceNew = body?.force_new === true;
    const targetPath = String(body?.target_path || "/convite");
    const baseUrl = getBaseUrl(req);

    if (!forceNew) {
      const { data: existingRows } = await supabaseAdmin
        .from("affiliate_short_links")
        .select("id,marketing_short_links(id,slug,target_url,is_active,created_at)")
        .eq("affiliate_partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const existing = existingRows?.[0]?.marketing_short_links;
      if (existing?.slug) {
        return jsonResponse({
          reused: true,
          short_link_id: existing.id,
          slug: existing.slug,
          target_url: existing.target_url,
          short_url: `${baseUrl.replace(/\/+$/, "")}/${existing.slug}`,
        });
      }
    }

    const preferredSlug = sanitizeSlug(
      String(body?.slug || "") ||
        `af-${partner.display_name || user.id.slice(0, 8)}-${Date.now().toString().slice(-5)}`,
    );

    const campaignId = String(partner.id || "").slice(0, 8);
    const targetUrl = buildTargetUrl(baseUrl, targetPath);
    const linkName = String(body?.name || `Afiliado - ${partner.display_name || "Parceiro"}`).trim();

    let createdLink: any = null;
    let finalSlug = preferredSlug;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = attempt === 0 ? preferredSlug : `${preferredSlug}-${Math.floor(Math.random() * 900 + 100)}`;

      const { data, error } = await supabaseAdmin
        .from("marketing_short_links")
        .insert({
          name: linkName,
          slug: candidate,
          target_url: targetUrl,
          utm_source: "affiliate",
          utm_medium: "partner",
          utm_campaign: `affiliate-${campaignId}`,
          is_active: true,
          created_by: user.id,
        })
        .select("*")
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
      throw new Error("Não foi possível gerar slug único para o link de afiliado.");
    }

    const { error: mapError } = await supabaseAdmin.from("affiliate_short_links").insert({
      affiliate_partner_id: partner.id,
      short_link_id: createdLink.id,
    });

    if (mapError) throw mapError;

    return jsonResponse({
      reused: false,
      short_link_id: createdLink.id,
      slug: finalSlug,
      target_url: targetUrl,
      short_url: `${baseUrl.replace(/\/+$/, "")}/${finalSlug}`,
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao gerar link afiliado" }, 500);
  }
});
