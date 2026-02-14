// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.1";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, x-application-name",
};

type SubRow = { endpoint: string; p256dh: string; auth: string };

function json(status: number, payload: any) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return json(500, { error: "Missing SUPABASE envs" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) {
      return json(401, { error: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const title = body?.title ?? "BYE";
    const message = body?.body ?? "Notificación de prueba";
    const url = body?.url ?? "/";

    const privateJwkRaw = Deno.env.get("VAPID_PRIVATE_JWK");
    if (!privateJwkRaw) return json(500, { error: "Missing VAPID_PRIVATE_JWK" });

    let privateJWK: any;
    try {
      privateJWK = JSON.parse(privateJwkRaw);
    } catch {
      return json(500, { error: "VAPID_PRIVATE_JWK is not valid JSON" });
    }

    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", user.id);

    if (subsErr) return json(400, { error: subsErr.message });

    const rows = (subs ?? []) as SubRow[];
    let sent = 0;

    for (const s of rows) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };

      const reqBuilt = await buildPushHTTPRequest({
        privateJWK,
        subscription,
        message: {
          payload: { title, body: message, url },
          adminContact: subject,
        },
      });

      // ✅ FIX DEFINITIVO: WebPush siempre es POST (y con body)
      let res: Response;
      try {
        res = await fetch(reqBuilt.endpoint, {
          method: "POST",
          headers: reqBuilt.headers,
          body: reqBuilt.body,
        });
      } catch (e) {
        console.error("push fetch failed:", e);
        continue;
      }

      if (res.ok) {
        sent++;
        continue;
      }

      // Si la subs murió, la borramos
      if (res.status === 404 || res.status === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        const txt = await res.text().catch(() => "");
        console.error("push failed:", res.status, txt);
      }
    }

    return json(200, { ok: true, sent });
  } catch (e: any) {
    console.error("push-test error:", e);
    return json(500, { error: e?.message ?? "Internal error" });
  }
});
