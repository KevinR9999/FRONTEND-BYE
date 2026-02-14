/// <reference lib="webworker" />

import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";

// Para TS + Workbox
declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any[] };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// ✅ Tu runtime caching (igual a tu config)
registerRoute(
  ({ url }) => /\/(icon-192|icon-512|apple-touch-icon)\.png$/i.test(url.pathname),
  new NetworkFirst({
    cacheName: "app-icons",
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new CacheFirst({
    cacheName: "google-fonts-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// ✅ PUSH: aquí va la lógica real de notificaciones
self.addEventListener("push", (event) => {
  let payload: any = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "BYE", body: "Tienes una notificación." };
  }

  const title = payload.title || "BYE";
  const options: NotificationOptions = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification?.data as any)?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});

self.addEventListener("activate", (event) => {
  console.log("✅ SW BYE activo con push");
  event.waitUntil(self.clients.claim());
});
