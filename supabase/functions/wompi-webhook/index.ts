// @ts-nocheck
// Supabase Edge Function para recibir webhooks de Wompi
// Deploy: supabase functions deploy wompi-webhook --no-verify-jwt
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function getCors(req: Request) {
  return {
    "access-control-allow-origin": req.headers.get("origin") || "",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type, x-wompi-signature, x-wompi-timestamp",
  };
}

function json(status: number, payload: any, req: Request) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCors(req), "content-type": "application/json" },
  });
}

// HMAC-SHA256 using Web Crypto API (no external deps)
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCors(req) });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, req);

  try {
    // 1. Obtener el cuerpo del request
    const body = await req.text();
    const event = JSON.parse(body);

    // 2. Verificar firma de Wompi (OBLIGATORIO)
    const signature = req.headers.get("x-wompi-signature");
    const timestamp = req.headers.get("x-wompi-timestamp");
    const eventsSecret = Deno.env.get("WOMPI_EVENTS_SECRET");

    if (!eventsSecret || !signature || !timestamp) {
      return json(401, { error: "Missing security headers" }, req);
    }

    const expectedSignature = await hmacSha256(eventsSecret, `${timestamp}.${body}`);

    if (signature !== expectedSignature) {
      return json(401, { error: "Invalid signature" }, req);
    }

    // 3. Anti-replay: rechazar webhooks de más de 5 minutos
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return json(400, { error: "Webhook expired" }, req);
    }

    // 4. Procesar según el tipo de evento
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (event.event === "transaction.updated") {
      const transaction = event.data.transaction;

      // Idempotencia: verificar si ya procesamos este status
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("status")
        .eq("transaction_id", transaction.id)
        .single();

      if (existingPayment?.status === transaction.status) {
        return json(200, { received: true, skipped: "already_processed" }, req);
      }

      // Actualizar estado del pago en BD
      const { error } = await supabase
        .from("payments")
        .update({
          status: transaction.status,
          updated_at: new Date().toISOString(),
        })
        .eq("transaction_id", transaction.id);

      if (error) {
        console.error("Error actualizando pago:", error);
      }

      // Si fue aprobado, crear suscripción
      if (transaction.status === "APPROVED") {
        const { data: payment } = await supabase
          .from("payments")
          .select("user_id, plan_type, amount")
          .eq("transaction_id", transaction.id)
          .single();

        if (payment) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await supabase.from("subscriptions").upsert({
            user_id: payment.user_id,
            plan: payment.plan_type,
            amount: payment.amount,
            status: "active",
            expires_at: expiresAt.toISOString(),
          });
        }
      }

      // Si fue rechazado, actualizar suscripción
      if (transaction.status === "DECLINED" || transaction.status === "ERROR") {
        const { data: payment } = await supabase
          .from("payments")
          .select("user_id")
          .eq("transaction_id", transaction.id)
          .single();

        if (payment) {
          await supabase
            .from("subscriptions")
            .update({ status: "failed" })
            .eq("user_id", payment.user_id)
            .eq("status", "active");
        }
      }
    }

    return json(200, { received: true }, req);
  } catch (e: any) {
    console.error("wompi-webhook error:", e);
    return json(500, { error: "Webhook processing error" }, req);
  }
});
