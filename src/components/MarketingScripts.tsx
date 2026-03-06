"use client";

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSiteConfig } from "@/hooks/use-site-config";
import { supabase } from "@/integrations/supabase/client";

const LAST_CHECKOUT_STORAGE_KEY = "hcm_last_checkout_context";
const TRACKED_PURCHASE_PREFIX = "hcm_tracked_purchase:";
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "PAID", "SUCCEEDED"]);

type ConversionType = "course" | "subscription";

type ConversionPayload = {
  transactionId: string;
  value: number;
  currency: string;
  itemId: string | null;
  itemName: string;
  contentType: ConversionType;
};

type CheckoutContext = {
  checkoutId: string | null;
  planId: string | null;
  courseSlug: string | null;
  startedAt: string | null;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureScript = (id: string, create: () => HTMLScriptElement) => {
  if (document.getElementById(id)) return;
  const script = create();
  script.id = id;
  document.head.appendChild(script);
};

const injectGA = (measurementId: string) => {
  ensureScript("ga-lib", () => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    return script;
  });

  ensureScript("ga-init", () => {
    const script = document.createElement("script");
    script.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${measurementId}');
    `;
    return script;
  });
};

const injectGTM = (containerId: string) => {
  ensureScript("gtm-init", () => {
    const script = document.createElement("script");
    script.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${containerId}');
    `;
    return script;
  });

  if (!document.getElementById("gtm-noscript")) {
    const noScript = document.createElement("noscript");
    noScript.id = "gtm-noscript";
    noScript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.appendChild(noScript);
  }
};

const injectFBPixel = (pixelId: string) => {
  ensureScript("fb-pixel-lib", () => {
    const script = document.createElement("script");
    script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');
    `;
    return script;
  });

  if (!document.getElementById("fb-pixel-noscript")) {
    const noScript = document.createElement("noscript");
    noScript.id = "fb-pixel-noscript";
    noScript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
    document.body.appendChild(noScript);
  }
};

const readLastCheckoutContext = (): CheckoutContext => {
  if (typeof window === "undefined") {
    return { checkoutId: null, planId: null, courseSlug: null, startedAt: null };
  }

  try {
    const raw = window.sessionStorage.getItem(LAST_CHECKOUT_STORAGE_KEY);
    if (!raw) return { checkoutId: null, planId: null, courseSlug: null, startedAt: null };

    const parsed = JSON.parse(raw) as Partial<CheckoutContext>;
    return {
      checkoutId: typeof parsed?.checkoutId === "string" ? parsed.checkoutId : null,
      planId: typeof parsed?.planId === "string" ? parsed.planId : null,
      courseSlug: typeof parsed?.courseSlug === "string" ? parsed.courseSlug : null,
      startedAt: typeof parsed?.startedAt === "string" ? parsed.startedAt : null,
    };
  } catch {
    return { checkoutId: null, planId: null, courseSlug: null, startedAt: null };
  }
};

const isSameCheckoutContext = (
  context: CheckoutContext,
  conversionType: ConversionType,
  itemId: string | null,
) => {
  if (!context.checkoutId) return false;
  if (conversionType === "course") return context.courseSlug === itemId;
  return context.planId === itemId;
};

const wasPurchaseAlreadyTracked = (transactionId: string) => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(`${TRACKED_PURCHASE_PREFIX}${transactionId}`) === "1";
};

const markPurchaseTracked = (transactionId: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${TRACKED_PURCHASE_PREFIX}${transactionId}`, "1");
};

const normalizeStatus = (value: string | null | undefined) => String(value || "").trim().toUpperCase();

const isPaidStatus = (value: string | null | undefined) => PAID_STATUSES.has(normalizeStatus(value));

const resolveCurrency = (currency: string | null | undefined) => {
  const safe = String(currency || "BRL").trim().toUpperCase();
  return safe || "BRL";
};

const resolveItemName = (
  conversionType: ConversionType,
  itemName: string | null,
  itemId: string | null,
) => {
  const safeName = String(itemName || "").trim();
  if (safeName) return safeName;
  if (conversionType === "course") return `Curso ${itemId || "HomeCare Match"}`;
  return `Plano ${itemId || "HomeCare Match"}`;
};

const resolveConversionItemFromUrl = (path: string, params: URLSearchParams) => {
  if (path === "/conversion/course") {
    return {
      conversionType: "course" as ConversionType,
      itemId: params.get("courseSlug"),
      itemName: params.get("courseTitle"),
    };
  }

  if (path === "/conversion/subscription") {
    return {
      conversionType: "subscription" as ConversionType,
      itemId: params.get("planId"),
      itemName: params.get("planName"),
    };
  }

  return null;
};

const fetchPaidTransaction = async (
  conversionType: ConversionType,
  itemId: string | null,
  checkoutId: string | null,
) => {
  let query = supabase
    .from("payment_transactions")
    .select("payment_id,asaas_checkout_id,transaction_type,plan_id,course_slug,amount,currency,status,confirmed_at,payment_date,created_at")
    .in("status", Array.from(PAID_STATUSES))
    .order("confirmed_at", { ascending: false, nullsFirst: false })
    .order("payment_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(5);

  if (checkoutId) {
    query = query.or(`payment_id.eq.${checkoutId},asaas_checkout_id.eq.${checkoutId}`);
  } else if (conversionType === "course" && itemId) {
    query = query.eq("transaction_type", "course").eq("course_slug", itemId);
  } else if (conversionType === "subscription" && itemId) {
    query = query.eq("transaction_type", "plan").eq("plan_id", itemId);
  }

  const { data, error } = await query;
  if (error || !data?.length) return null;
  return data[0];
};

const fetchPaidSession = async (
  conversionType: ConversionType,
  itemId: string | null,
  checkoutId: string | null,
) => {
  let query = supabase
    .from("asaas_checkout_sessions")
    .select("checkout_id,payment_id,plan_id,course_slug,amount,payment_status,status,updated_at,created_at")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(5);

  if (checkoutId) {
    query = query.or(`checkout_id.eq.${checkoutId},payment_id.eq.${checkoutId}`);
  } else if (conversionType === "course" && itemId) {
    query = query.eq("course_slug", itemId);
  } else if (conversionType === "subscription" && itemId) {
    query = query.eq("plan_id", itemId);
  }

  const { data, error } = await query;
  if (error || !data?.length) return null;

  const paid = data.find((row) => isPaidStatus(row.payment_status) || isPaidStatus(row.status));
  return paid || null;
};

const resolveConversionPayload = async (
  conversionType: ConversionType,
  itemId: string | null,
  itemName: string | null,
  checkoutId: string | null,
): Promise<ConversionPayload | null> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const paidTx = await fetchPaidTransaction(conversionType, itemId, checkoutId);
    if (paidTx) {
      const transactionId =
        String(paidTx.payment_id || paidTx.asaas_checkout_id || "").trim() ||
        `${conversionType}-${itemId || "unknown"}-${Date.now()}`;

      return {
        transactionId,
        value: Number(paidTx.amount || 0),
        currency: resolveCurrency(paidTx.currency),
        itemId:
          conversionType === "course"
            ? String(paidTx.course_slug || itemId || "").trim() || null
            : String(paidTx.plan_id || itemId || "").trim() || null,
        itemName: resolveItemName(conversionType, itemName, itemId),
        contentType: conversionType,
      };
    }

    const paidSession = await fetchPaidSession(conversionType, itemId, checkoutId);
    if (paidSession) {
      const transactionId =
        String(paidSession.payment_id || paidSession.checkout_id || "").trim() ||
        `${conversionType}-${itemId || "unknown"}-${Date.now()}`;

      return {
        transactionId,
        value: Number(paidSession.amount || 0),
        currency: "BRL",
        itemId:
          conversionType === "course"
            ? String(paidSession.course_slug || itemId || "").trim() || null
            : String(paidSession.plan_id || itemId || "").trim() || null,
        itemName: resolveItemName(conversionType, itemName, itemId),
        contentType: conversionType,
      };
    }

    await delay(1200);
  }

  return null;
};

const trackConversion = (payload: ConversionPayload) => {
  if (wasPurchaseAlreadyTracked(payload.transactionId)) return;

  let sent = false;
  const category = payload.contentType === "subscription" ? "assinatura" : "curso";

  if (window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: payload.transactionId,
      value: payload.value,
      currency: payload.currency,
      items: [
        {
          item_id: payload.itemId,
          item_name: payload.itemName,
          price: payload.value,
          quantity: 1,
          item_category: payload.contentType,
        },
      ],
    });
    sent = true;
  }

  if (window.fbq) {
    window.fbq("track", "Purchase", {
      value: payload.value,
      currency: payload.currency,
      content_name: payload.itemName,
      content_ids: payload.itemId ? [payload.itemId] : [],
      content_type: payload.contentType,
      content_category: category,
      category,
    });
    sent = true;
  }

  if (sent) {
    markPurchaseTracked(payload.transactionId);
  }
};

const MarketingScripts = () => {
  const { data: config } = useSiteConfig();
  const location = useLocation();

  useEffect(() => {
    if (!config) return;

    if (config.ga_enabled && config.ga_measurement_id) {
      injectGA(config.ga_measurement_id);
    }
    if (config.gtm_enabled && config.gtm_container_id) {
      injectGTM(config.gtm_container_id);
    }
    if (config.fb_pixel_enabled && config.fb_pixel_id) {
      injectFBPixel(config.fb_pixel_id);
    }
  }, [config]);

  useEffect(() => {
    if (!config) return;

    const conversionData = resolveConversionItemFromUrl(location.pathname, new URLSearchParams(location.search));
    if (!conversionData) return;

    const hasAnyTracker =
      (config.ga_enabled && config.ga_measurement_id) || (config.fb_pixel_enabled && config.fb_pixel_id);

    if (!hasAnyTracker) return;

    let cancelled = false;
    const queryParams = new URLSearchParams(location.search);

    const run = async () => {
      const lastCheckout = readLastCheckoutContext();
      const checkoutFromUrl = queryParams.get("checkoutId");
      const contextCheckoutId = isSameCheckoutContext(
        lastCheckout,
        conversionData.conversionType,
        conversionData.itemId,
      )
        ? lastCheckout.checkoutId
        : null;
      const checkoutId = checkoutFromUrl || contextCheckoutId;

      const payload = await resolveConversionPayload(
        conversionData.conversionType,
        conversionData.itemId,
        conversionData.itemName,
        checkoutId,
      );

      if (!cancelled && payload) {
        trackConversion(payload);
      }

    };

    run();

    return () => {
      cancelled = true;
    };
  }, [config, location.pathname, location.search]);

  return null;
};

export default MarketingScripts;
