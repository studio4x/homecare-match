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

const normalizeText = (value: unknown, max = 500) => String(value || "").trim().slice(0, max);
const normalizeEmail = (value: unknown) => normalizeText(value, 200).toLowerCase();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return jsonResponse({ error: "Metodo nao permitido" }, 405);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));

    const fullName = normalizeText(body?.full_name, 180);
    const email = normalizeEmail(body?.email);
    const phone = normalizeText(body?.phone, 40);
    const city = normalizeText(body?.city, 120) || null;
    const state = normalizeText(body?.state, 80) || null;
    const pixKey = normalizeText(body?.pix_key, 160) || null;
    const pixKeyType = normalizeText(body?.pix_key_type, 20) || null;
    const audience = normalizeText(body?.audience, 120) || null;
    const experience = normalizeText(body?.experience, 120) || null;
    const message = normalizeText(body?.message, 2000) || null;

    if (!fullName || !email || !phone) {
      return jsonResponse({ error: "Nome, email e telefone sao obrigatorios." }, 400);
    }

    const { data: existingApplication } = await supabaseAdmin
      .from("affiliate_applications")
      .select("id,status")
      .eq("email_normalized", email)
      .in("status", ["pending", "approved"])
      .maybeSingle();

    if (existingApplication?.id) {
      return jsonResponse({
        success: true,
        already_exists: true,
        status: existingApplication.status,
        message:
          existingApplication.status === "approved"
            ? "Seu cadastro de afiliado ja foi aprovado."
            : "Ja recebemos seu cadastro. Retornaremos em breve.",
      });
    }

    const { data: existingPartner } = await supabaseAdmin
      .from("affiliate_partners")
      .select("id,status")
      .ilike("email", email)
      .maybeSingle();

    if (existingPartner?.id) {
      return jsonResponse({
        success: true,
        already_exists: true,
        status: existingPartner.status || "active",
        message: "Ja existe um parceiro afiliado com este email.",
      });
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id,role")
      .ilike("email", email)
      .maybeSingle();

    if (existingProfile?.id) {
      return jsonResponse(
        {
          error: "Este email ja possui conta ativa na plataforma. O programa de afiliados e exclusivo para parceiros dedicados.",
        },
        409,
      );
    }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("affiliate_applications")
      .insert({
        full_name: fullName,
        email,
        email_normalized: email,
        phone,
        city,
        state,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        audience,
        experience,
        message,
        status: "pending",
      })
      .select("id,status,created_at")
      .single();

    if (insertError) throw insertError;

    return jsonResponse({
      success: true,
      application: created,
      message: "Cadastro recebido. Nossa equipe vai analisar e entrar em contato.",
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Erro ao registrar interesse de afiliado" }, 500);
  }
});
