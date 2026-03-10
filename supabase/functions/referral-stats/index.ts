// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const hasText = (value: unknown) => String(value || "").trim().length > 0;
const countDigits = (value: unknown) => String(value || "").replace(/\D/g, "").length;
const hasValidDigits = (value: unknown, length: number) => countDigits(value) === length;
const hasDigitsBetween = (value: unknown, min: number, max: number) => {
  const total = countDigits(value);
  return total >= min && total <= max;
};

const isProfileCompleted = (profile: any) => {
  if (!profile) return false;

  const role = String(profile.role || "professional").toLowerCase();
  const hasBase =
    hasText(profile.avatar_url) &&
    hasText(profile.full_name) &&
    hasDigitsBetween(profile.phone, 10, 11) &&
    hasText(profile.address_zip) &&
    hasText(profile.address_street) &&
    hasText(profile.neighborhood) &&
    hasText(profile.city) &&
    hasText(profile.state) &&
    hasText(profile.bio);

  if (!hasBase) return false;

  if (role === "professional") {
    return hasText(profile.specialty) && hasValidDigits(profile.cpf, 11);
  }

  if (role === "company") {
    return hasValidDigits(profile.cnpj, 14);
  }

  if (role === "family") {
    return (
      hasValidDigits(profile.cpf, 11) &&
      hasText(profile.patient_name) &&
      Number(profile.patient_age || 0) > 0 &&
      hasText(profile.patient_medical_conditions) &&
      Array.isArray(profile.availability) &&
      profile.availability.length > 0
    );
  }

  return true;
};

const getCurrentStatusLabel = (stages: {
  documents_verified: boolean;
  profile_completed: boolean;
  email_confirmed: boolean;
}) => {
  if (stages.documents_verified) return "Validou documentos";
  if (stages.profile_completed) return "Preencheu perfil";
  if (stages.email_confirmed) return "Validou e-mail";
  return "Criou cadastro";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE);

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // ignore
    }

    const referrerId = body?.referrerId;
    if (!referrerId) {
      return new Response(JSON.stringify({ error: "referrerId_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: files, error: listError } = await supabaseAdmin.storage
      .from("uploads")
      .list(`referrals/${referrerId}`, { limit: 1000 });

    if (listError) {
      return new Response(JSON.stringify({ error: "list_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const referralFiles = (files || []).filter((entry) => entry.name.endsWith(".json"));
    const referredIds = referralFiles.map((entry) => entry.name.replace(".json", ""));

    const profilesMap = new Map<string, any>();
    if (referredIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select(
          [
            "id",
            "full_name",
            "email",
            "created_at",
            "role",
            "email_confirmed",
            "is_verified",
            "avatar_url",
            "phone",
            "specialty",
            "cpf",
            "cnpj",
            "address_zip",
            "address_street",
            "neighborhood",
            "city",
            "state",
            "bio",
            "patient_name",
            "patient_age",
            "patient_medical_conditions",
            "availability",
          ].join(","),
        )
        .in("id", referredIds);

      (profiles || []).forEach((profile) => profilesMap.set(profile.id, profile));
    }

    const registeredUsers = referralFiles
      .map((entry) => {
        const id = entry.name.replace(".json", "");
        const profile = profilesMap.get(id) || null;
        const role = String(profile?.role || "professional").toLowerCase();

        const stages = {
          signup_created: true,
          email_confirmed: !!profile?.email_confirmed,
          profile_completed: isProfileCompleted(profile),
          documents_verified: !!profile?.is_verified,
        };

        const isValidReferral = role === "professional" && stages.documents_verified;

        return {
          id,
          full_name: profile?.full_name || "Usuario em conclusao",
          email: profile?.email || null,
          created_at: profile?.created_at || entry.created_at || new Date().toISOString(),
          role,
          stages,
          current_status: getCurrentStatusLabel(stages),
          is_valid_referral: isValidReferral,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const validCount = registeredUsers.filter((user) => user.is_valid_referral).length;

    let tiers: any[] = [];
    const { data: tiersFile } = await supabaseAdmin.storage.from("uploads").download("referrals/tiers.json");
    if (tiersFile) {
      try {
        tiers = JSON.parse(await tiersFile.text());
      } catch {
        tiers = [];
      }
    }

    let currentTier = null;
    let nextTier = null;

    const { data: overrideFile } = await supabaseAdmin.storage
      .from("uploads")
      .download(`referrals/overrides/${referrerId}.json`);
    if (overrideFile) {
      try {
        const overrideTier = JSON.parse(await overrideFile.text());
        if (overrideTier?.badge_label) {
          currentTier = overrideTier;
        }
      } catch {
        // ignore invalid override
      }
    }

    if (!currentTier && Array.isArray(tiers) && tiers.length > 0) {
      const sorted = [...tiers].sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
      for (const tier of sorted) {
        if (validCount >= tier.threshold) {
          currentTier = tier;
        } else if (!nextTier) {
          nextTier = tier;
        }
      }
    }

    if (!nextTier && Array.isArray(tiers) && tiers.length > 0) {
      const sorted = [...tiers].sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
      for (const tier of sorted) {
        if (validCount < tier.threshold) {
          nextTier = tier;
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        count: validCount,
        totalRegistered: registeredUsers.length,
        currentTier,
        nextTier,
        registeredUsers,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "unexpected_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
