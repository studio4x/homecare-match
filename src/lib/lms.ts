import { supabase } from "@/integrations/supabase/client";

const parseInvokeError = async (error: any, fallback: string) => {
  const context = error?.context as Response | undefined;
  if (context) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
    } catch {
      // fallback below
    }
  }

  return typeof error?.message === "string" && error.message.trim() ? error.message : fallback;
};

export const enrollFreeCourse = async (courseSlug: string) => {
  const { error } = await supabase.functions.invoke("enroll-free-course", {
    body: { courseSlug },
  });

  if (error) throw new Error(await parseInvokeError(error, "Falha ao inscrever no curso."));
};

export const createLmsCourseAccessUrl = async (courseSlug: string) => {
  const { data, error } = await supabase.functions.invoke("access-lms-course", {
    body: { courseSlug },
  });

  if (error) throw new Error(await parseInvokeError(error, "Falha ao gerar acesso ao LMS."));
  if (!data?.url) throw new Error("URL de acesso ao LMS nao retornada.");
  return String(data.url);
};
