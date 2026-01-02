// Supabase Edge Function para recibir webhooks de Wompi
// Deploy: supabase functions deploy wompi-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wompi-signature, x-wompi-timestamp',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Obtener el cuerpo del request
    const body = await req.text();
    const event = JSON.parse(body);

    // 2. Verificar firma de Wompi (seguridad)
    const signature = req.headers.get('x-wompi-signature');
    const timestamp = req.headers.get('x-wompi-timestamp');
    const eventsSecret = Deno.env.get('WOMPI_EVENTS_SECRET');

    if (eventsSecret && signature && timestamp) {
      const expectedSignature = createHmac('sha256', eventsSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('❌ Firma inválida');
        throw new Error('Invalid signature');
      }
    }

    console.log('📥 Webhook recibido:', event.event);

    // 3. Procesar según el tipo de evento
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (event.event === 'transaction.updated') {
      const transaction = event.data.transaction;

      // Actualizar estado del pago en BD
      const { error } = await supabase
        .from('payments')
        .update({
          status: transaction.status,
          updated_at: new Date().toISOString(),
        })
        .eq('transaction_id', transaction.id);

      if (error) {
        console.error('❌ Error actualizando pago:', error);
      } else {
        console.log('✅ Pago actualizado:', transaction.id);
      }

      // Si fue aprobado y no existía suscripción, crearla
      if (transaction.status === 'APPROVED') {
        const { data: payment } = await supabase
          .from('payments')
          .select('user_id, plan_type, amount')
          .eq('transaction_id', transaction.id)
          .single();

        if (payment) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await supabase.from('subscriptions').upsert({
            user_id: payment.user_id,
            plan: payment.plan_type,
            amount: payment.amount,
            status: 'active',
            expires_at: expiresAt.toISOString(),
          });

          console.log('✅ Suscripción activada');
        }
      }

      // Si fue rechazado, actualizar suscripción
      if (transaction.status === 'DECLINED' || transaction.status === 'ERROR') {
        const { data: payment } = await supabase
          .from('payments')
          .select('user_id')
          .eq('transaction_id', transaction.id)
          .single();

        if (payment) {
          await supabase
            .from('subscriptions')
            .update({ status: 'failed' })
            .eq('user_id', payment.user_id)
            .eq('status', 'active');

          console.log('⚠️ Suscripción marcada como fallida');
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Error en webhook:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Webhook error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
