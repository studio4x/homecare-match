const CACHE_VERSION = "hcm-pwa-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = ["/", OFFLINE_URL, "/favicon.png", "/placeholder.svg"];

const isAssetPath = (url) => url.pathname.startsWith("/assets/");

const contentTypeOf = (response) => String(response?.headers?.get("content-type") || "").toLowerCase();

const isExpectedAssetContentType = (request, response) => {
  const contentType = contentTypeOf(response);
  if (!contentType || contentType.includes("text/html")) return false;

  switch (request.destination) {
    case "script":
      return contentType.includes("javascript");
    case "style":
      return contentType.includes("text/css");
    case "image":
      return contentType.startsWith("image/");
    case "font":
      return contentType.includes("font/") || contentType.includes("application/font");
    default:
      return true;
  }
};

const shouldCacheResponse = (request, response) => {
  if (!response || !response.ok) return false;
  if (request.mode === "navigate") return true;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;

  if (isAssetPath(url)) {
    return isExpectedAssetContentType(request, response);
  }

  return true;
};

const isValidCachedResponse = (request, response) => {
  if (!response) return false;
  const url = new URL(request.url);
  if (!isAssetPath(url)) return true;
  return isExpectedAssetContentType(request, response);
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined)
      .finally(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .finally(() => clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigation: network-first with cache/offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (shouldCacheResponse(request, response)) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone)).catch(() => undefined);
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const offlinePage = await caches.match(OFFLINE_URL);
          return offlinePage || Response.error();
        }),
    );
    return;
  }

  // Same-origin hashed assets: network-first, never cache HTML fallback.
  if (url.origin === self.location.origin && isAssetPath(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (shouldCacheResponse(request, response)) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone)).catch(() => undefined);
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached && isValidCachedResponse(request, cached)) return cached;
          return Response.error();
        }),
    );
    return;
  }

  // Other same-origin resources: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (shouldCacheResponse(request, response)) {
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone)).catch(() => undefined);
            }
            return response;
          })
          .catch(() => cached);

        if (cached && !isValidCachedResponse(request, cached)) {
          return networkFetch;
        }

        return cached || networkFetch;
      }),
    );
  }
});

// Push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      image: data.image || null,
      vibrate: [100, 50, 100],
      data: {
        url: data.link || "/",
      },
      tag: `hcm-notification-${Date.now()}`,
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (error) {
    console.error("[SW] Erro ao processar push event:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }

      return undefined;
    }),
  );
});
