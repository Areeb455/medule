// Medule PWA Service Worker
const CACHE_NAME = "medule-pwa-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/medule-logo.svg",
  "/favicon.ico"
];

// Install event: Pre-cache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Service worker cache prefetch note:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event: Clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Network-first with cache fallback
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and skip chrome-extension/external API calls
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // For API endpoints, prefer fresh network response
  if (url.pathname.startsWith("/api") || url.pathname.includes(":8000") || url.pathname.includes("onrender.com")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful page/script/style responses
        if (response.status === 200 && (url.origin === self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/");
        });
      })
  );
});
