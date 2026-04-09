// ✅ Mantiene el precache de Workbox (vite-plugin-pwa inyecta __WB_MANIFEST)
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

const ICON_192_URL = "/icon-192.png?v=20260409-1";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// ✅ Push notifications
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "BYE", body: "Tienes una notificación." };
  }

  const title = payload.title || "BYE";
  const options = {
    body: payload.body || "",
    icon: ICON_192_URL,
    badge: ICON_192_URL,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
