import { supabase } from "@/integrations/supabase/client";

let syncInFlight: Promise<boolean> | null = null;

export const isMissingHiringStatusColumnError = (error: any): boolean => {
  const message = String(error?.message || "").toLowerCase();
  return (
    String(error?.code || "") === "PGRST204" &&
    message.includes("hiring_status") &&
    message.includes("company_patients")
  );
};

export const syncCompanyPatientsSchema = async (): Promise<boolean> => {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const { error } = await supabase.functions.invoke("setup-company-patients", { body: {} });
    return !error;
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
};

