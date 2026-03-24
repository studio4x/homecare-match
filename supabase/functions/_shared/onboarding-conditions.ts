import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function getProfessionalProfileCompletion(
  supabase: SupabaseClient,
  userId: string,
) {
  let percentage = 0;
  const missingItems: string[] = [];
  
  // 1. Fetch profile basics
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) {
    return { percentage: 0, isComplete: false, isReady: false, missingItems: ["profile_not_found"] };
  }

  // Check basic fields common in prof profiles
  const checks = [
    { key: "full_name", weight: 20 },
    { key: "avatar_url", weight: 15 },
    { key: "bio", weight: 15 },
    { key: "phone", weight: 15 },
    { key: "cpf", weight: 10 },
  ];

  for (const check of checks) {
    if (profile[check.key]) {
      percentage += check.weight;
    } else {
      missingItems.push(check.key);
    }
  }

  // 2. Check email verified via auth.users using an RPC or fallback
  // Since we use the service role, we can query auth.users directly or rely on a verified flag
  // Let's assume there's a custom logic if needed, but for now we skip auth directly here
  // and do it in evaluateOnboardingCondition since this is just profile data.
  
  // 3. Assume remaining 25% comes from documents or verification status
  if (profile.verification_status === "approved" || profile.is_verified) {
    percentage += 25;
  } else {
    missingItems.push("verification_status");
  }

  const isComplete = percentage >= 100;
  // Let's define ready as > 70% and having a bio/photo
  const isReady = percentage >= 70 && !missingItems.includes("full_name") && !missingItems.includes("avatar_url");

  return { percentage, isComplete, isReady, missingItems, profile };
}

export async function evaluateOnboardingCondition(
  supabase: SupabaseClient,
  userId: string,
  conditionType: string,
  conditionConfig: any,
): Promise<boolean> {
  const completion = await getProfessionalProfileCompletion(supabase, userId);

  switch (conditionType) {
    case "email_not_verified": {
      // Check auth.users for email_confirmed_at
      const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
      if (error || !user) return false; // if no user, condition false
      // Se não tem confirmed_at, a condição 'email_not_verified' é verdadeira
      return !user.email_confirmed_at;
    }

    case "profile_incomplete": {
      // isComplete false -> incomplete -> true
      return !completion.isComplete;
    }

    case "documents_not_sent": {
      // check if verification_status exists and is not submitted/approved
      const status = completion.profile?.verification_status || "pending";
      return status === "pending" || status === "rejected";
    }

    case "profile_not_validated": {
      const status = completion.profile?.verification_status;
      return status !== "approved";
    }

    case "professional_profile_not_ready": {
      return !completion.isReady;
    }

    default:
      // Unknown condition, default to false
      console.warn(`[evaluateOnboardingCondition] Unknown conditionType: ${conditionType}`);
      return false;
  }
}
