import { supabase } from "@/integrations/supabase/client";

let syncInFlight: Promise<boolean> | null = null;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SCHEMA_NOT_READY_MESSAGE =
  "A estrutura de pacientes ainda não foi sincronizada. Abra Painel Admin > Configurações > Manutenção e clique em 'Pacientes da Empresa'.";

export const isMissingHiringStatusColumnError = (error: any): boolean => {
  const message = String(error?.message || "").toLowerCase();
  return (
    String(error?.code || "") === "PGRST204" &&
    message.includes("hiring_status") &&
    message.includes("company_patients")
  );
};

const isHiringStatusColumnReady = async (): Promise<boolean> => {
  const { error } = await supabase.from("company_patients").select("id,hiring_status").limit(1);
  if (!error) return true;
  if (isMissingHiringStatusColumnError(error)) return false;
  throw error;
};

export const syncCompanyPatientsSchema = async (): Promise<boolean> => {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const { error } = await supabase.functions.invoke("setup-company-patients", { body: {}, headers });
    if (error) return false;

    // PostgREST pode demorar alguns segundos para recarregar o schema cache após NOTIFY.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (await isHiringStatusColumnReady()) return true;
      await wait(700);
    }

    return false;
  })();

  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
};

export const persistWithCompanyPatientsSchemaRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (!isMissingHiringStatusColumnError(error)) throw error;

    const synced = await syncCompanyPatientsSchema();
    if (!synced) throw new Error(SCHEMA_NOT_READY_MESSAGE);

    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await wait(600 * (attempt + 1));
      try {
        return await operation();
      } catch (retryError: any) {
        if (!isMissingHiringStatusColumnError(retryError)) throw retryError;
        lastError = retryError;
      }
    }

    throw lastError || new Error(SCHEMA_NOT_READY_MESSAGE);
  }
};
