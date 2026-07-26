const CACHE = "planirov-shell-v2";
const SCOPE = self.registration.scope;
const SHELL = [
  new URL("./", SCOPE).href,
  new URL("manifest.webmanifest", SCOPE).href,
  new URL("favicon.svg", SCOPE).href,
  new URL("icon-192.png", SCOPE).href,
  new URL("icon-512.png", SCOPE).href,
];
const SHELL_PATHS = new Set(SHELL.map((entry) => new URL(entry).pathname));
const ASSETS_PATH = new URL("assets/", SCOPE).pathname;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("planirov-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.includes("/api/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(SHELL[0], copy));
          }
          return response;
        })
        .catch(() => caches.match(SHELL[0])),
    );
    return;
  }

  const staticAsset =
    url.pathname.startsWith(ASSETS_PATH) ||
    url.pathname.startsWith("/_next/") ||
    SHELL_PATHS.has(url.pathname);
  if (!staticAsset) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
