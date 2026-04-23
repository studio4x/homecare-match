import { supabase } from "@/integrations/supabase/client";

const parseInvokeError = async (error: any, fallback: string) => {
  let status: number | undefined;
  const context = error?.context as Response | undefined;
  if (context) {
    status = context.status;

    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string" && body.error.trim()) {
        return { message: body.error, status };
      }
    } catch {
      // fallback below
    }
  }

  return {
    message: typeof error?.message === "string" && error.message.trim() ? error.message : fallback,
    status,
  };
};

const invokeLmsFunction = async <T>(functionName: string, body: Record<string, unknown>, fallback: string) => {
  const invoke = () => supabase.functions.invoke(functionName, { body });

  let { data, error } = await invoke();
  if (!error) return data as T;

  let parsedError = await parseInvokeError(error, fallback);
  const shouldRefreshSession =
    parsedError.status === 401 || /invalid jwt|jwt expired|unauthorized/i.test(parsedError.message || "");

  if (shouldRefreshSession) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

    if (!refreshError && refreshed?.session) {
      ({ data, error } = await invoke());
      if (!error) return data as T;
      parsedError = await parseInvokeError(error, fallback);
    }
  }

  throw new Error(parsedError.message || fallback);
};

export const enrollFreeCourse = async (courseSlug: string) => {
  await invokeLmsFunction("enroll-free-course", { courseSlug }, "Falha ao inscrever no curso.");
};

export const createLmsCourseAccessUrl = async (courseSlug: string) => {
  const data = await invokeLmsFunction<{ url?: string }>(
    "access-lms-course",
    { courseSlug },
    "Falha ao gerar acesso ao LMS.",
  );

  if (!data?.url) throw new Error("URL de acesso ao LMS nao retornada.");
  return String(data.url);
};
