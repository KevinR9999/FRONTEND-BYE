// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.1";

type SubRow = { endpoint: string; p256dh: string; auth: string; user_id: string };

function getCors(req: Request) {
  return {
    "access-control-allow-origin": req.headers.get("origin") || "",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type, x-application-name",
  };
}

function json(status: number, payload: any, req: Request) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCors(req), "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = getCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json(500, { error: "Missing SUPABASE envs" }, req);
    }

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await authClient.auth.getUser();
    if (authErr || !authData?.user) {
      return json(401, { error: "Unauthorized" }, req);
    }

    // Verify caller is admin using service role (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return json(403, { error: "Admin only" }, req);
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const title = (body?.title ?? "BYE").slice(0, 100);
    const message = (body?.body ?? "").slice(0, 500);
    const url = (body?.url ?? "/").slice(0, 500);
    const userIds: string[] = body?.user_ids ?? [];

    // Validar límite de user_ids
    if (!Array.isArray(userIds) || userIds.length > 10000) {
      return json(400, { error: "Invalid user_ids" }, req);
    }

    if (userIds.length === 0) {
      return json(200, { ok: true, sent: 0, reason: "No user_ids" }, req);
    }

    // Get VAPID private key
    const privateJwkRaw = Deno.env.get("VAPID_PRIVATE_JWK");
    if (!privateJwkRaw) return json(500, { error: "Missing VAPID_PRIVATE_JWK" }, req);

    let privateJWK: any;
    try {
      privateJWK = JSON.parse(privateJwkRaw);
    } catch {
      return json(500, { error: "VAPID_PRIVATE_JWK is not valid JSON" }, req);
    }

    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@bye-app.com";

    // Get push subscriptions for target users (service role bypasses RLS)
    const { data: subs, error: subsErr } = await adminClient
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth,user_id")
      .in("user_id", userIds);

    if (subsErr) return json(400, { error: subsErr.message }, req);

    const rows = (subs ?? []) as SubRow[];
    let sent = 0;
    let failed = 0;

    // Enviar en paralelo (batches de 10 para no saturar)
    const BATCH_SIZE = 10;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (s) => {
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

          const res = await fetch(reqBuilt.endpoint, {
            method: "POST",
            headers: {
              ...reqBuilt.headers,
              Urgency: "high",
              TTL: "60",
            },
            body: reqBuilt.body,
          });

          if (res.ok) return "ok";
          if (res.status === 404 || res.status === 410) {
            await adminClient
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", s.endpoint);
            return "dead";
          }
          return "fail";
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value === "ok") sent++;
        else failed++;
      }
    }

    return json(200, { ok: true, sent, failed, total: rows.length }, req);
  } catch (e: any) {
    console.error("send-notification-push error:", e);
    return json(500, { error: e?.message ?? "Internal error" }, req);
  }
});
