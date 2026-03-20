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

const parseMetaError = async (response: Response) => {
  try {
    const json = await response.json();
    const message = typeof json?.error?.message === "string" && json.error.message.trim()
      ? json.error.message.trim()
      : typeof json?.message === "string" && json.message.trim()
      ? json.message.trim()
      : "";

    if (message) {
      return {
        message,
        details: json?.error || json || null,
      };
    }

    return {
      message: JSON.stringify(json),
      details: json || null,
    };
  } catch {
    try {
      const text = await response.text();
      return {
        message: text || "Unknown error while creating WhatsApp group.",
        details: null,
      };
    } catch {
      return {
        message: "Unknown error while creating WhatsApp group.",
        details: null,
      };
    }
  }
};

const normalizeSubject = (value: unknown) => String(value || "").trim().slice(0, 128);
const normalizeDescription = (value: unknown) => String(value || "").trim().slice(0, 2048);
const normalizeJoinMode = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approval_required") return "approval_required";
  if (normalized === "auto_approve") return "auto_approve";
  return null;
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

    const subject = normalizeSubject(body?.subject);
    const description = normalizeDescription(body?.description);
    const joinApprovalMode = normalizeJoinMode(body?.join_approval_mode);

    if (!subject) {
      return jsonResponse({ error: "subject is required." }, 400);
    }

    if (body?.join_approval_mode && !joinApprovalMode) {
      return jsonResponse({ error: "join_approval_mode must be auto_approve or approval_required." }, 400);
    }

    const apiVersion = String(Deno.env.get("WHATSAPP_API_VERSION") || "v23.0").trim();
    const phoneNumberId = String(body?.phone_number_id || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "")
      .trim();
    const accessToken = String(Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "").trim();

    if (!phoneNumberId || !accessToken) {
      return jsonResponse(
        { error: "Missing WhatsApp config (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)." },
        500,
      );
    }

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      subject,
    };

    if (description) payload.description = description;
    if (joinApprovalMode) payload.join_approval_mode = joinApprovalMode;

    const createResponse = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/groups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!createResponse.ok) {
      const parsed = await parseMetaError(createResponse);
      return jsonResponse(
        {
          error: parsed.message || "Failed to create WhatsApp group.",
          status: createResponse.status,
          details: parsed.details,
        },
        createResponse.status,
      );
    }

    const data = await createResponse.json().catch(() => ({}));

    try {
      await supabaseAdmin.from("admin_logs").insert({
        admin_id: userResult.user.id,
        action_type: "WHATSAPP_GROUP_CREATE",
        target_id: String(data?.group_id || data?.id || ""),
        details: `Created WhatsApp group with subject \"${subject}\".`,
      });
    } catch {
      // Ignore audit failure to avoid breaking the main flow.
    }

    return jsonResponse({ success: true, data });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Error while creating WhatsApp group." }, 500);
  }
});
