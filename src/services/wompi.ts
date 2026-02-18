// Servicio de integración con Wompi
// Documentación: https://docs.wompi.co

const WOMPI_API_URL = 'https://production.wompi.co/v1';

// Obtener la Public Key desde variables de entorno
const getPublicKey = (): string => {
  // @ts-ignore - Vite env
  const key = import.meta.env?.VITE_WOMPI_PUBLIC_KEY;
  if (!key) {
    console.error('⚠️ VITE_WOMPI_PUBLIC_KEY no está configurada');
    // En desarrollo, usar clave de prueba
    return 'pub_test_DEFAULT_KEY';
  }
  return key;
};

interface CardData {
  number: string;
  cvc: string;
  exp_month: string;
  exp_year: string;
  card_holder: string;
}

interface TokenizeResponse {
  data: {
    id: string;
    status: string;
  };
  meta: any;
}

interface PaymentRequest {
  cardToken: string;
  amount: number;
  email: string;
  planType: string;
  userId: string;
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: string;
  error?: string;
}

/**
 * Tokeniza una tarjeta de crédito usando Wompi
 * Esto convierte datos sensibles en un token seguro
 */
export const tokenizeCard = async (cardData: CardData): Promise<string> => {
  try {
    const publicKey = getPublicKey();

    if (import.meta.env.DEV) console.log('Tokenizando tarjeta...');

    const response = await fetch(`${WOMPI_API_URL}/tokens/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: cardData.number.replace(/\s/g, ''),
        cvc: cardData.cvc,
        exp_month: cardData.exp_month,
        exp_year: cardData.exp_year,
        card_holder: cardData.card_holder,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error tokenizando tarjeta:', error);
      throw new Error(error.error?.reason || 'Error al procesar la tarjeta');
    }

    const data: TokenizeResponse = await response.json();
    if (import.meta.env.DEV) console.log('Tarjeta tokenizada exitosamente');

    return data.data.id;
  } catch (error) {
    console.error('❌ Error en tokenizeCard:', error);
    throw error;
  }
};

/**
 * Procesa un pago a través de Supabase Edge Function
 * La Edge Function maneja la private key de forma segura
 */
export const processPayment = async (
  paymentData: PaymentRequest
): Promise<PaymentResponse> => {
  try {
    if (import.meta.env.DEV) console.log('Procesando pago...');

    // Llamar a Supabase Edge Function
    // @ts-ignore - Vite env
    const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/process-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // @ts-ignore - Vite env
          'Authorization': `Bearer ${import.meta.env?.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(paymentData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Error procesando pago:', error);
      return {
        success: false,
        error: error.message || 'Error al procesar el pago',
      };
    }

    const result = await response.json();
    if (import.meta.env.DEV) console.log('Pago procesado:', result.status);

    return {
      success: true,
      transactionId: result.transactionId,
      status: result.status,
    };
  } catch (error) {
    console.error('❌ Error en processPayment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
};

/**
 * Obtiene el estado de una transacción
 */
export const getTransactionStatus = async (
  transactionId: string
): Promise<string> => {
  try {
    const publicKey = getPublicKey();

    const response = await fetch(
      `${WOMPI_API_URL}/transactions/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${publicKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Error obteniendo estado de transacción');
    }

    const data = await response.json();
    return data.data.status;
  } catch (error) {
    console.error('❌ Error obteniendo estado:', error);
    throw error;
  }
};

/**
 * Valida el formato de una tarjeta de crédito (Algoritmo de Luhn)
 */
export const validateCardNumber = (cardNumber: string): boolean => {
  const digits = cardNumber.replace(/\s/g, '');

  if (!/^\d{13,19}$/.test(digits)) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

/**
 * Detecta el tipo de tarjeta basado en el número
 */
export const getCardType = (cardNumber: string): string => {
  const digits = cardNumber.replace(/\s/g, '');

  if (/^4/.test(digits)) return 'VISA';
  if (/^5[1-5]/.test(digits)) return 'MASTERCARD';
  if (/^3[47]/.test(digits)) return 'AMEX';
  if (/^6(?:011|5)/.test(digits)) return 'DISCOVER';
  if (/^3(?:0[0-5]|[68])/.test(digits)) return 'DINERS';

  return 'UNKNOWN';
};
