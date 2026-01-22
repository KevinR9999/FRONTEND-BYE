// src/services/paymentService.ts
import { supabase } from '../lib/supabaseClient';
import type { PaymentPlan } from '../types/admin';

/**
 * Obtiene los planes de pago activos para mostrar a los usuarios
 */
export async function getActivePlans(): Promise<PaymentPlan[]> {
  const { data, error } = await supabase
    .from('payment_plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (error) {
    console.error('Error fetching active payment plans:', error);
    throw error;
  }

  return (data || []).map(plan => ({
    ...plan,
    features: Array.isArray(plan.features) ? plan.features : (plan.features ? JSON.parse(plan.features) : [])
  }));
}
