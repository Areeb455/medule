// Medule PWA Service Worker
const CACHE_NAME = "medule-pwa-v3";
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

// Fetch event: Network-first, only fallback to index.html for navigation requests
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Skip API calls and external origins
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.includes(":8000") ||
    url.pathname.includes("onrender.com") ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // HTML page navigation: Network first, fallback to cached root
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets (JS, CSS, images): Network first, fallback to cached asset (NEVER return HTML for scripts)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

