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
    <div className="bg-white rounded-lg shadow-sm">
      {/* Logos de tarjetas */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-4">
        {/* Mastercard */}
        <div className="w-12 h-8 bg-white border border-gray-300 rounded flex items-center justify-center">
          <svg viewBox="0 0 131.39 86.9" className="w-8 h-5">
            <circle fill="#eb001b" cx="45.4" cy="43.45" r="34.95"/>
            <circle fill="#f79e1b" cx="85.99" cy="43.45" r="34.95"/>
            <path fill="#ff5f00" d="M65.7,21.75a34.95,34.95,0,0,0,0,43.4,34.95,34.95,0,0,0,0-43.4Z"/>
          </svg>
        </div>

        {/* Visa */}
        <div className="w-12 h-8 bg-white border border-gray-300 rounded flex items-center justify-center">
          <svg viewBox="0 0 750 471" className="w-8 h-5">
            <path fill="#1434CB" d="M278.2 334.2L311.7 152h53.3l-33.5 182.2h-53.3zm246.7-177.6c-10.6-4-27.1-8.4-47.8-8.4-52.7 0-89.8 25.7-90.1 62.5-.3 27.2 26.5 42.4 46.7 51.5 20.8 9.3 27.8 15.3 27.7 23.6-.1 12.8-16.7 18.6-32.1 18.6-21.5 0-32.9-2.9-50.5-10.1l-7-3.1-7.5 42.8c12.5 5.3 35.6 9.9 59.6 10.1 56 0 92.3-25.4 92.8-64.7.2-21.5-14-37.9-44.7-51.4-18.6-8.7-30-14.5-29.8-23.4 0-7.9 9.6-16.3 30.4-16.3 17.4-.3 30 3.4 39.8 7.3l4.8 2.2 7.3-41.6zm92.9-4.6h-41.2c-12.8 0-22.4 3.4-28 15.8l-79.3 166.4h56l11.1-28.2h68.6c1.6 6.6 6.5 28.2 6.5 28.2h49.4l-43.1-182.2zm-65.6 117.5c.1 0 13.2-33.7 13.2-33.7-.2.3 2.7-6.8 4.4-11.2l2.2 10.4s6.4 28.8 7.7 34.5h-27.5zM232.2 152L180.6 284.3l-5.5-26.6c-9.5-29.6-39.2-61.8-72.4-77.9l47.8 154.2 56.5-.1 84-182h-56.4l-2.4.1z"/>
            <path fill="#F7B600" d="M131.9 152H45.3L45 154.6c66.8 15.7 111 53.7 129.3 99.4l-18.6-86.1c-3.2-12.2-12.5-15.6-23.8-15.9z"/>
          </svg>
        </div>

        {/* American Express */}
        <div className="w-12 h-8 bg-[#006FCF] rounded flex items-center justify-center">
          <svg viewBox="0 0 300 200" className="w-8 h-5">
            <rect width="300" height="200" fill="#006FCF"/>
            <path fill="#FFF" d="M51.5 65h25l5.7 12.8L88 65h25v40h-15V80.5l-10 24.5h-10l-10-24.5V105h-15V65zm105 0h-40v10h40v10h-40v10h40v10h-40V65h40v10zm10 0h15l15 20V65h15v40h-15l-15-20v20h-15V65z"/>
          </svg>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
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

        {/* Resumen del pago */}
        <div className="pt-4 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">
              {description || 'Pago personalizado'}
            </span>
            <span className="text-[#2563EB] font-semibold">${amount.toLocaleString()} {currency}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span className="text-xl font-bold text-gray-900">${amount.toLocaleString()} {currency}</span>
          </div>
        </div>

        {/* Botón de pago */}
        <button
          type="submit"
          disabled={isProcessing}
          className="w-full bg-[#1e293b] hover:bg-black text-white font-semibold py-4 rounded-lg text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
        >
          {isProcessing ? 'Procesando...' : 'Completar pago'}
        </button>

        {/* Texto legal */}
        <p className="text-xs text-gray-500 text-center pt-3">
          Al hacer clic, aceptas los{' '}
          <button type="button" className="text-blue-600 hover:underline">
            términos y condiciones
          </button>
        </p>
      </form>
    </div>
  );
}
