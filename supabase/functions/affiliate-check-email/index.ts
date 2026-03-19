// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase().slice(0, 200);
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Metodo nao permitido" }, 405);

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);

    if (!email || !isValidEmail(email)) {
      return jsonResponse(
        {
          available: false,
          reason: "invalid_format",
          message: "Digite um email valido.",
        },
        400,
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (existingProfile?.id) {
      return jsonResponse({
        available: false,
        reason: "profile_exists",
        message: "Este email ja possui conta ativa na plataforma.",
      });
    }

    const { data: existingPartner } = await supabaseAdmin
      .from("affiliate_partners")
      .select("id,status")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (existingPartner?.id) {
      return jsonResponse({
        available: false,
        reason: "affiliate_partner_exists",
        message: "Ja existe parceiro afiliado com este email.",
      });
    }

    const { data: existingApplication } = await supabaseAdmin
      .from("affiliate_applications")
      .select("id,status")
      .eq("email_normalized", email)
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingApplication?.id) {
      return jsonResponse({
        available: false,
        reason: "affiliate_application_exists",
        message:
          existingApplication.status === "approved"
            ? "Seu cadastro de afiliado para este email ja foi aprovado."
            : "Ja recebemos uma candidatura com este email.",
      });
    }

    return jsonResponse({
      available: true,
      message: "Email aceito para utilizacao.",
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao validar email" }, 500);
  }
});

