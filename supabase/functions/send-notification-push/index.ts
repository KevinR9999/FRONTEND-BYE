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

type SubRow = { endpoint: string; p256dh: string; auth: string; user_id: string };

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json(500, { error: "Missing SUPABASE envs" });
    }

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await authClient.auth.getUser();
    if (authErr || !authData?.user) {
      return json(401, { error: "Unauthorized" });
    }

    // Verify caller is admin using service role (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return json(403, { error: "Admin only" });
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const title = body?.title ?? "BYE";
    const message = body?.body ?? "";
    const url = body?.url ?? "/";
    const userIds: string[] = body?.user_ids ?? [];

    if (userIds.length === 0) {
      return json(200, { ok: true, sent: 0, reason: "No user_ids" });
    }

    // Get VAPID private key
    const privateJwkRaw = Deno.env.get("VAPID_PRIVATE_JWK");
    if (!privateJwkRaw) return json(500, { error: "Missing VAPID_PRIVATE_JWK" });

    let privateJWK: any;
    try {
      privateJWK = JSON.parse(privateJwkRaw);
    } catch {
      return json(500, { error: "VAPID_PRIVATE_JWK is not valid JSON" });
    }

    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@bye-app.com";

    // Get push subscriptions for target users (service role bypasses RLS)
    const { data: subs, error: subsErr } = await adminClient
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth,user_id")
      .in("user_id", userIds);

    if (subsErr) return json(400, { error: subsErr.message });

    const rows = (subs ?? []) as SubRow[];
    let sent = 0;
    let failed = 0;

    for (const s of rows) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };

      try {
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
          headers: reqBuilt.headers,
          body: reqBuilt.body,
        });

        if (res.ok) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          await adminClient
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint);
          failed++;
        } else {
          failed++;
        }
      } catch (e) {
        console.error("push send error:", e);
        failed++;
      }
    }

    return json(200, { ok: true, sent, failed, total: rows.length });
  } catch (e: any) {
    console.error("send-notification-push error:", e);
    return json(500, { error: e?.message ?? "Internal error" });
  }
});
