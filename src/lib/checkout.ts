import { supabase } from "@/integrations/supabase/client";

type CheckoutPayload = {
  planId?: string;
  courseSlug?: string;
  paymentMethod?: "credit_card" | "pix";
  installmentCount?: number;
};

type CheckoutResponse = {
  url?: string;
  checkoutId?: string;
};

const CHECKOUT_TRACKING_STORAGE_KEY = "hcm_last_checkout_context";

const persistCheckoutTrackingContext = (
  payload: CheckoutPayload,
  response: CheckoutResponse,
) => {
  if (typeof window === "undefined" || !response.checkoutId) return;

  try {
    const trackingPayload = {
      checkoutId: response.checkoutId,
      planId: payload.planId || null,
      courseSlug: payload.courseSlug || null,
      startedAt: new Date().toISOString(),
    };
    window.sessionStorage.setItem(CHECKOUT_TRACKING_STORAGE_KEY, JSON.stringify(trackingPayload));
  } catch (error) {
    console.warn("[Checkout] Nao foi possivel salvar contexto de rastreamento:", error);
  }
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
  if (!error) {
    const safeData = (data || {}) as CheckoutResponse;
    persistCheckoutTrackingContext(payload, safeData);
    return safeData;
  }

  let parsedError = await parseCheckoutInvokeError(error);
  const shouldRefreshSession =
    parsedError.status === 401 || /invalid jwt/i.test(parsedError.message || "");

  if (shouldRefreshSession) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

    if (!refreshError && refreshed?.session) {
      ({ data, error } = await invokeCheckout());
      if (!error) {
        const safeData = (data || {}) as CheckoutResponse;
        persistCheckoutTrackingContext(payload, safeData);
        return safeData;
      }
      parsedError = await parseCheckoutInvokeError(error);
    }
  }

  throw new Error(parsedError.message || "Erro ao iniciar checkout.");
};
