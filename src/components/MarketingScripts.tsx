"use client";

import { useEffect } from "react";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useLocation } from "react-router-dom"; // Import useLocation

// Utilitário para evitar duplicatas
const ensureScript = (id: string, create: () => HTMLScriptElement) => {
  if (document.getElementById(id)) return;
  const s = create();
  s.id = id;
  document.head.appendChild(s);
};

// GA: gtag.js
const injectGA = (measurementId: string) => {
  // Carrega a lib
  ensureScript("ga-lib", () => {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    return s;
  });
  // Configuração básica
  ensureScript("ga-init", () => {
    const s = document.createElement("script");
    s.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${measurementId}');
    `;
    return s;
  });
};

// GTM: container
const injectGTM = (containerId: string) => {
  ensureScript("gtm-init", () => {
    const s = document.createElement("script");
    s.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${containerId}');
    `;
    return s;
  });
  // Noscript iframe (para quando JS estiver desativado) — renderiza de forma oculta
  if (!document.getElementById("gtm-noscript")) {
    const nos = document.createElement("noscript");
    nos.id = "gtm-noscript";
    nos.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.appendChild(nos);
  }
};

// Facebook Pixel
const injectFBPixel = (pixelId: string) => {
  ensureScript("fb-pixel-lib", () => {
    const s = document.createElement("script");
    s.innerHTML = `
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
    return s;
  });
  // Noscript image fallback
  if (!document.getElementById("fb-pixel-noscript")) {
    const nos = document.createElement("noscript");
    nos.id = "fb-pixel-noscript";
    nos.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/>`;
    document.body.appendChild(nos);
  }
};

const MarketingScripts = () => {
  const { data: config } = useSiteConfig();
  const location = useLocation(); // Get current location

  useEffect(() => {
    if (!config) return;

    // Inject base scripts
    if (config.ga_enabled && config.ga_measurement_id) {
      injectGA(config.ga_measurement_id);
    }
    if (config.gtm_enabled && config.gtm_container_id) {
      injectGTM(config.gtm_container_id);
    }
    if (config.fb_pixel_enabled && config.fb_pixel_id) {
      injectFBPixel(config.fb_pixel_id);
    }

    // Handle conversion events based on URL
    const path = location.pathname;
    const queryParams = new URLSearchParams(location.search);

    if (path === "/conversion/course") {
      const courseSlug = queryParams.get("courseSlug");
      const courseTitle = queryParams.get("courseTitle");
      // Example: Trigger a purchase event for GA
      if (window.gtag && config.ga_enabled && config.ga_measurement_id) {
        window.gtag('event', 'purchase', {
          transaction_id: `course-${courseSlug}-${Date.now()}`,
          value: 1.0, // You might need to fetch actual course price
          currency: 'BRL',
          items: [{
            item_id: courseSlug,
            item_name: courseTitle,
            price: 1.0,
            quantity: 1
          }]
        });
      }
      // Example: Trigger a purchase event for FB Pixel
      if (window.fbq && config.fb_pixel_enabled && config.fb_pixel_id) {
        window.fbq('track', 'Purchase', {
          value: 1.0, // You might need to fetch actual course price
          currency: 'BRL'
        });
      }
      // Clear query params after tracking to avoid re-firing on refresh
      window.history.replaceState({}, document.title, path);
    } else if (path === "/conversion/subscription") {
      const planId = queryParams.get("planId");
      const planName = queryParams.get("planName");
      // Example: Trigger a purchase event for GA
      if (window.gtag && config.ga_enabled && config.ga_measurement_id) {
        window.gtag('event', 'purchase', {
          transaction_id: `subscription-${planId}-${Date.now()}`,
          value: 1.0, // You might need to fetch actual plan price
          currency: 'BRL',
          items: [{
            item_id: planId,
            item_name: planName,
            price: 1.0,
            quantity: 1
          }]
        });
      }
      // Example: Trigger a purchase event for FB Pixel
      if (window.fbq && config.fb_pixel_enabled && config.fb_pixel_id) {
        window.fbq('track', 'Purchase', {
          value: 1.0, // You might need to fetch actual plan price
          currency: 'BRL'
        });
      }
      // Clear query params after tracking to avoid re-firing on refresh
      window.history.replaceState({}, document.title, path);
    }

  }, [config, location.pathname, location.search]);

  return null;
};

export default MarketingScripts;