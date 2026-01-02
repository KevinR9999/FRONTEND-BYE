// Supabase Edge Function para procesar pagos con Wompi
// Deploy: supabase functions deploy process-payment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WOMPI_API_URL = 'https://production.wompi.co/v1';

interface PaymentRequest {
  cardToken: string;
  amount: number;
  email: string;
  planType: string;
  userId: string;
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validar método
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // 2. Obtener datos del request
    const paymentData: PaymentRequest = await req.json();
    const { cardToken, amount, email, planType, userId } = paymentData;

    // 3. Validaciones
    if (!cardToken || !amount || !email || !userId) {
      throw new Error('Missing required fields');
    }

    // 4. Obtener credenciales de Wompi
    const privateKey = Deno.env.get('WOMPI_PRIVATE_KEY');
    if (!privateKey) {
      console.error('❌ WOMPI_PRIVATE_KEY no configurada');
      throw new Error('Payment gateway not configured');
    }

    // 5. Crear referencia única
    const reference = `ORD-${userId.slice(0, 8)}-${Date.now()}`;

    // 6. Crear transacción en Wompi
    console.log('💳 Creando transacción en Wompi...');
    const wompiResponse = await fetch(`${WOMPI_API_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${privateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount_in_cents: amount * 100, // Wompi usa centavos
        currency: 'COP',
        customer_email: email,
        payment_method: {
          type: 'CARD',
          token: cardToken,
          installments: 1,
        },
        reference: reference,
      }),
    });

    if (!wompiResponse.ok) {
      const error = await wompiResponse.json();
      console.error('❌ Error de Wompi:', error);
      throw new Error(error.error?.reason || 'Payment failed');
    }

    const wompiData = await wompiResponse.json();
    const transaction = wompiData.data;

    console.log('✅ Transacción creada:', transaction.id);

    // 7. Guardar en Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase.from('payments').insert({
      user_id: userId,
      transaction_id: transaction.id,
      reference: reference,
      amount: amount,
      currency: 'COP',
      status: transaction.status,
      payment_method: 'CARD',
      plan_type: planType,
    });

    if (dbError) {
      console.error('❌ Error guardando en BD:', dbError);
      // No fallar el pago si falla la BD
    }

    // 8. Si el pago fue aprobado, crear suscripción
    if (transaction.status === 'APPROVED') {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // +30 días

      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan: planType,
        amount: amount,
        status: 'active',
        expires_at: expiresAt.toISOString(),
      });

      console.log('✅ Suscripción creada');
    }

    // 9. Respuesta exitosa
    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transaction.id,
        status: transaction.status,
        reference: reference,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error procesando pago:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
