import { supabase } from "@/integrations/supabase/client";

type CheckoutPayload = {
  planId?: string;
  courseSlug?: string;
};

type CheckoutResponse = {
  url?: string;
  checkoutId?: string;
};

const parseCheckoutInvokeError = async (
  error: any,
  fallbackMessage = "Erro ao iniciar checkout.",
): Promise<{ message: string; status?: number }> => {
  let message = fallbackMessage;
  let status: number | undefined;

  const context = error?.context as Response | undefined;
  if (context) {
    status = context.status;

    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string" && body.error.trim()) {
        message = body.error;
      } else if (typeof body?.message === "string" && body.message.trim()) {
        message = body.message;
      }
    } catch {
      // ignore and fallback to text/message below
    }

    if (message === fallbackMessage) {
      try {
        const rawText = await context.text();
        if (rawText?.trim()) {
          try {
            const parsed = JSON.parse(rawText);
            if (typeof parsed?.error === "string" && parsed.error.trim()) {
              message = parsed.error;
            } else if (typeof parsed?.message === "string" && parsed.message.trim()) {
              message = parsed.message;
            } else {
              message = rawText;
            }
          } catch {
            message = rawText;
          }
        }
      } catch {
        // ignore and fallback to error.message
      }
    }
  }

  if (message === fallbackMessage && typeof error?.message === "string" && error.message.trim()) {
    message = error.message;
  }

  return { message, status };
};

export const createCheckoutSession = async (payload: CheckoutPayload): Promise<CheckoutResponse> => {
  const invokeCheckout = () =>
    supabase.functions.invoke("create-checkout-session", {
      body: payload,
    });

  let { data, error } = await invokeCheckout();
  if (!error) return data || {};

  let parsedError = await parseCheckoutInvokeError(error);
  const shouldRefreshSession =
    parsedError.status === 401 || /invalid jwt/i.test(parsedError.message || "");

  if (shouldRefreshSession) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

    if (!refreshError && refreshed?.session) {
      ({ data, error } = await invokeCheckout());
      if (!error) return data || {};
      parsedError = await parseCheckoutInvokeError(error);
    }
  }

  throw new Error(parsedError.message || "Erro ao iniciar checkout.");
};
