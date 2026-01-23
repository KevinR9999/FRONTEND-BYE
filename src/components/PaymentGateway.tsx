import { useState } from 'react';
import { tokenizeCard, processPayment, validateCardNumber } from '../services/wompi';
import { supabase } from '../lib/supabaseClient';

interface PaymentGatewayProps {
  amount: number;
  currency?: string;
  planType?: string;
  description?: string;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
}

export default function PaymentGateway({
  amount,
  currency = 'COP',
  planType = 'custom',
  description = '',
  onSuccess,
  onError
}: PaymentGatewayProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [email, setEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Formatear número de tarjeta (añade espacios cada 4 dígitos)
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : cleaned;
  };

  // Formatear fecha de expiración (MM/YY)
  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s/g, '');
    if (value.length <= 16 && /^\d*$/.test(value)) {
      setCardNumber(formatCardNumber(value));
    }
  };

  const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 4) {
      setExpiryDate(formatExpiryDate(value));
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 4 && /^\d*$/.test(value)) {
      setCvv(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones básicas
    const cleanCardNumber = cardNumber.replace(/\s/g, '');

    if (!validateCardNumber(cleanCardNumber)) {
      onError?.('Número de tarjeta inválido');
      return;
    }

    if (!expiryDate || expiryDate.length !== 5) {
      onError?.('Fecha de expiración inválida (MM/YY)');
      return;
    }

    const [month, year] = expiryDate.split('/');
    const expMonth = parseInt(month);
    const expYear = parseInt(`20${year}`);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (expMonth < 1 || expMonth > 12) {
      onError?.('Mes de expiración inválido');
      return;
    }

    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      onError?.('La tarjeta está vencida');
      return;
    }

    if (!cvv || (cvv.length !== 3 && cvv.length !== 4)) {
      onError?.('CVV inválido');
      return;
    }

    if (!email || !email.includes('@')) {
      onError?.('Email inválido');
      return;
    }

    if (!cardName || cardName.trim().length < 3) {
      onError?.('Ingresa el nombre del titular');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Obtener usuario actual
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Debes iniciar sesión para realizar el pago');
      }

      // 2. Tokenizar la tarjeta con Wompi
      console.log('🔐 Tokenizando tarjeta...');
      const cardToken = await tokenizeCard({
        number: cleanCardNumber,
        cvc: cvv,
        exp_month: month,
        exp_year: `20${year}`,
        card_holder: cardName,
      });

      // 3. Procesar el pago a través de Supabase Edge Function
      console.log('💳 Procesando pago...');
      const paymentResult = await processPayment({
        cardToken,
        amount,
        email,
        planType,
        userId: user.id,
      });

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Error al procesar el pago');
      }

      // 4. Pago exitoso
      console.log('✅ Pago exitoso:', paymentResult.transactionId);
      setShowSuccess(true);

      setTimeout(() => {
        onSuccess?.(paymentResult.transactionId || '');
      }, 1500);

    } catch (error) {
      console.error('❌ Error en pago:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : 'Error al procesar el pago. Intenta nuevamente.';
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Pantalla de éxito
  if (showSuccess) {
    return (
      <div className="border border-gray-300 p-8">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Pago exitoso</h2>
          <p className="text-sm text-gray-600">Tu mensualidad se ha procesado correctamente</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Formulario */}
      <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        {/* Número de tarjeta */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Número de tarjeta
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={cardNumber}
            onChange={handleCardNumberChange}
            placeholder="1234 5678 9012 3456"
            autoComplete="cc-number"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        {/* Nombre del titular */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Nombre del titular
          </label>
          <input
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value.toUpperCase())}
            placeholder="JUAN PÉREZ"
            autoComplete="cc-name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm uppercase text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            required
          />
        </div>

        {/* Fecha de vencimiento y CVV */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Fecha de vencimiento
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={expiryDate}
              onChange={handleExpiryDateChange}
              placeholder="MM/AA"
              maxLength={5}
              autoComplete="cc-exp"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              CVV
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={cvv}
              onChange={handleCvvChange}
              placeholder="123"
              maxLength={4}
              autoComplete="cc-csc"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
        </div>
      </form>
    </div>
  );
}
