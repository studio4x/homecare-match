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
const isUuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
const normalizeRole = (value: unknown) => {
  const role = String(value || "").toLowerCase();
  if (role === "professional" || role === "company" || role === "family" || role === "admin") return role;
  return "professional";
};

const getProfileCompleteness = (profile: any) => {
  if (!profile) {
    return {
      isComplete: false,
      missingFields: ["perfil_nao_encontrado"],
    };
  }

  const missingFields: string[] = [];
  const role = String(profile.role || "professional").toLowerCase();
  const ensure = (condition: boolean, key: string) => {
    if (!condition) missingFields.push(key);
  };

  ensure(hasText(profile.avatar_url), "avatar_url");
  ensure(hasText(profile.full_name), "full_name");
  ensure(hasDigitsBetween(profile.phone, 10, 13), "phone");
  ensure(hasText(profile.address_zip), "address_zip");
  ensure(hasText(profile.address_street), "address_street");
  ensure(hasText(profile.neighborhood), "neighborhood");
  ensure(hasText(profile.city), "city");
  ensure(hasText(profile.state), "state");
  ensure(hasText(profile.bio), "bio");

  if (role === "professional") {
    ensure(hasText(profile.specialty), "specialty");
    ensure(hasValidDigits(profile.cpf, 11), "cpf");
  }

  if (role === "company") {
    ensure(hasValidDigits(profile.cnpj, 14), "cnpj");
  }

  if (role === "family") {
    ensure(hasValidDigits(profile.cpf, 11), "cpf");
    ensure(hasText(profile.patient_name), "patient_name");
    ensure(Number(profile.patient_age || 0) > 0, "patient_age");
    ensure(hasText(profile.patient_medical_conditions), "patient_medical_conditions");
    ensure(Array.isArray(profile.availability) && profile.availability.length > 0, "availability");
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
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

    const profileFields = "*";

    const validReferredIds = referredIds.filter(isUuid);
    const profilesMap = new Map<string, any>();

    if (validReferredIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select(profileFields)
        .in("id", validReferredIds);

      if (!profilesError) {
        (profiles || []).forEach((profile) => profilesMap.set(profile.id, profile));
      } else {
        // Fallback defensivo: evita perder todos os dados caso o filtro em lote falhe.
        for (const userId of validReferredIds) {
          const { data: profile } = await supabaseAdmin.from("profiles").select(profileFields).eq("id", userId).maybeSingle();
          if (profile) {
            profilesMap.set(profile.id, profile);
          }
        }
      }
    }

    const authUsersMap = new Map<string, any>();
    const profilesByEmailMap = new Map<string, any>();
    const missingProfileIds = validReferredIds.filter((id) => !profilesMap.has(id));
    if (missingProfileIds.length > 0) {
      const authLookups = await Promise.allSettled(
        missingProfileIds.map((id) => supabaseAdmin.auth.admin.getUserById(id)),
      );

      authLookups.forEach((lookup, index) => {
        if (lookup.status !== "fulfilled") return;
        const authUser = lookup.value?.data?.user;
        if (!authUser?.id) return;
        authUsersMap.set(missingProfileIds[index], authUser);
      });

      const missingEmails = Array.from(
        new Set(
          missingProfileIds
            .map((id) => String(authUsersMap.get(id)?.email || "").trim().toLowerCase())
            .filter(Boolean),
        ),
      );

      if (missingEmails.length > 0) {
        const { data: profilesByEmail } = await supabaseAdmin
          .from("profiles")
          .select(profileFields)
          .in("email", missingEmails);

        (profilesByEmail || []).forEach((profile) => {
          const key = String(profile?.email || "").trim().toLowerCase();
          if (key) profilesByEmailMap.set(key, profile);
        });
      }

      // Backfill defensivo: cria perfil minimo para usuarios autenticados sem linha em profiles.
      const profilesToUpsert = missingProfileIds
        .map((id) => authUsersMap.get(id))
        .filter(Boolean)
        .map((authUser) => {
          const role = normalizeRole(authUser.user_metadata?.role || authUser.raw_user_meta_data?.role);
          const nameFromMeta =
            authUser.user_metadata?.full_name ||
            authUser.raw_user_meta_data?.full_name ||
            String(authUser.email || "").split("@")[0] ||
            "Usuario";

          return {
            id: authUser.id,
            full_name: nameFromMeta,
            email: authUser.email || null,
            role,
            is_admin: role === "admin",
            email_confirmed: Boolean(authUser.email_confirmed_at),
            subscription_tier: role === "professional" ? "free_trial" : null,
            trial_started_at: role === "professional" ? authUser.created_at || new Date().toISOString() : null,
            cancel_at_period_end: false,
          };
        });

      if (profilesToUpsert.length > 0) {
        const { error: backfillError } = await supabaseAdmin
          .from("profiles")
          .upsert(profilesToUpsert, { onConflict: "id" });

        if (!backfillError) {
          const { data: backfilledProfiles } = await supabaseAdmin
            .from("profiles")
            .select(profileFields)
            .in(
              "id",
              profilesToUpsert.map((row) => row.id),
            );

          (backfilledProfiles || []).forEach((profile) => profilesMap.set(profile.id, profile));
        }
      }
    }

    const registeredUsers = referralFiles
      .map((entry) => {
        const id = entry.name.replace(".json", "");
        const authUser = authUsersMap.get(id) || null;
        const profileById = profilesMap.get(id) || null;
        const profileByEmail =
          !profileById && authUser?.email
            ? profilesByEmailMap.get(String(authUser.email).trim().toLowerCase()) || null
            : null;
        const profile = profileById || profileByEmail || null;
        const role = String(profile?.role || authUser?.user_metadata?.role || "professional").toLowerCase();
        const emailConfirmed = Boolean(profile?.email_confirmed || authUser?.email_confirmed_at);
        const profileCompleteness = getProfileCompleteness(profile);
        const profileCompleted = profileCompleteness.isComplete;

        const stages = {
          signup_created: true,
          email_confirmed: emailConfirmed,
          profile_completed: profileCompleted,
          documents_verified: !!profile?.is_verified,
        };

        const isValidReferral = role === "professional" && stages.documents_verified;

        return {
          id,
          full_name:
            profile?.full_name ||
            authUser?.user_metadata?.full_name ||
            authUser?.email ||
            "Usuario em conclusao",
          email: profile?.email || authUser?.email || null,
          created_at:
            profile?.created_at ||
            authUser?.created_at ||
            entry.created_at ||
            new Date().toISOString(),
          role,
          stages,
          profile_missing_fields: profileCompleteness.missingFields,
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
