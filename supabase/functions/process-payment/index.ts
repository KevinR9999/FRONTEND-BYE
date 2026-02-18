// @ts-nocheck
// Supabase Edge Function para procesar pagos con Wompi
// Deploy: supabase functions deploy process-payment --no-verify-jwt
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const WOMPI_API_URL = "https://production.wompi.co/v1";

interface PaymentRequest {
  cardToken: string;
  amount: number;
  email: string;
  planType: string;
  userId: string;
}

function getCors(req: Request) {
  return {
    "access-control-allow-origin": req.headers.get("origin") || "",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

function json(status: number, payload: any, req: Request) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...getCors(req), "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCors(req) });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, req);

  try {
    // 1. Verificar autenticación JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, { success: false, error: "No autorizado" }, req);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !authData?.user) {
      return json(401, { success: false, error: "Token inválido" }, req);
    }

    // 2. Obtener datos del request
    const paymentData: PaymentRequest = await req.json();
    const { cardToken, amount, email, planType, userId } = paymentData;

    // 3. Validaciones
    if (!cardToken || !amount || !email || !userId) {
      return json(400, { success: false, error: "Datos incompletos" }, req);
    }

    // 4. Verificar que el userId coincide con el usuario autenticado
    if (userId !== authData.user.id) {
      return json(403, { success: false, error: "No puedes procesar pagos de otro usuario" }, req);
    }

    // 5. Validar monto (entre 1 COP y 100,000 COP)
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
      return json(400, { success: false, error: "Monto inválido" }, req);
    }

    // 6. Obtener credenciales de Wompi
    const privateKey = Deno.env.get("WOMPI_PRIVATE_KEY");
    if (!privateKey) {
      return json(500, { success: false, error: "Payment gateway not configured" }, req);
    }

    // 7. Crear referencia única
    const reference = `ORD-${userId.slice(0, 8)}-${Date.now()}`;

    // 8. Crear transacción en Wompi
    const wompiResponse = await fetch(`${WOMPI_API_URL}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${privateKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount_in_cents: amount * 100,
        currency: "COP",
        customer_email: email,
        payment_method: {
          type: "CARD",
          token: cardToken,
          installments: 1,
        },
        reference,
      }),
    });

    if (!wompiResponse.ok) {
      console.error("Error de Wompi:", await wompiResponse.text());
      return json(400, { success: false, error: "Error procesando el pago" }, req);
    }

    const wompiData = await wompiResponse.json();
    const transaction = wompiData.data;

    // 9. Guardar en Supabase (service role para bypass RLS)
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase.from("payments").insert({
      user_id: userId,
      transaction_id: transaction.id,
      reference,
      amount,
      currency: "COP",
      status: transaction.status,
      payment_method: "CARD",
      plan_type: planType,
    });

    if (dbError) {
      console.error("Error guardando en BD:", dbError);
    }

    // 10. Si el pago fue aprobado, crear suscripción
    if (transaction.status === "APPROVED") {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase.from("subscriptions").insert({
        user_id: userId,
        plan: planType,
        amount,
        status: "active",
        expires_at: expiresAt.toISOString(),
      });
    }

    // 11. Respuesta exitosa
    return json(200, {
      success: true,
      transactionId: transaction.id,
      status: transaction.status,
      reference,
    }, req);
  } catch (e: any) {
    console.error("process-payment error:", e);
    return json(400, { success: false, error: "Error procesando el pago" }, req);
  }
});
