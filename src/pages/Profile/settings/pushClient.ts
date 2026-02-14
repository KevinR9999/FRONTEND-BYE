// src/pages/Profile/settings/pushClient.ts
import { supabase } from "../../../lib/supabaseClient";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isWebPushSupported() {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

async function saveSubscription(userId: string, sub: PushSubscription) {
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    console.error("Subscription incompleta:", json);
    return { ok: false as const, error: { code: "INCOMPLETE" } };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    { endpoint, user_id: userId, p256dh, auth, user_agent: navigator.userAgent },
    { onConflict: "endpoint" }
  );

  if (error) return { ok: false as const, error };
  return { ok: true as const };
}

export async function ensurePushSubscription(userId: string) {
  if (!isWebPushSupported()) {
    alert("Este dispositivo/navegador no soporta Push.");
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    alert("Debes permitir notificaciones para activar esta opción.");
    return false;
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    alert("Falta VITE_VAPID_PUBLIC_KEY en tu .env");
    return false;
  }

  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  // 1) Intento normal
  let result = await saveSubscription(userId, sub);

  // 2) Si falla por RLS (endpoint ya existente de otra cuenta), regeneramos endpoint y reintentamos
  if (!result.ok && (result.error as any)?.code === "42501") {
    try {
      await sub.unsubscribe();
    } catch {
      // ignore
    }

    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    result = await saveSubscription(userId, sub);
  }

  if (!result.ok) {
    console.error(result.error);
    alert("No se pudo guardar la suscripción push.");
    return false;
  }

  return true;
}
