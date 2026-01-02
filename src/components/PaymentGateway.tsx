import { useState } from 'react';
import { tokenizeCard, processPayment, validateCardNumber } from '../services/wompi';
import { supabase } from '../lib/supabaseClient';

interface PaymentGatewayProps {
  amount: number;
  currency?: string;
  planType?: string;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
}

export default function PaymentGateway({
  amount,
  currency = 'COP',
  planType = 'premium',
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
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-8 animate-slide-up">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Pago exitoso!</h2>
          <p className="text-slate-600 mb-1">Tu transacción se ha procesado correctamente</p>
          <p className="text-sm text-slate-400">Recibirás un correo de confirmación</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
      {/* Header con gradiente */}
      <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 p-6 text-white">
        <h2 className="text-2xl font-bold mb-1">Pasarela de Pagos</h2>
        <p className="text-purple-100 text-sm">Procesado por Wompi</p>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl font-bold">
            ${amount.toLocaleString()}
          </span>
          <span className="text-purple-200">{currency}</span>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-slate-900 placeholder:text-slate-400 bg-white"
            required
          />
        </div>

        {/* Número de tarjeta */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Número de tarjeta
          </label>
          <div className="relative">
            <input
              type="text"
              value={cardNumber}
              onChange={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition pr-12 text-slate-900 placeholder:text-slate-400 bg-white"
              required
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M2 10h20" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Nombre del titular */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre del titular
          </label>
          <input
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value.toUpperCase())}
            placeholder="JUAN PÉREZ"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition uppercase text-slate-900 placeholder:text-slate-400 bg-white"
            required
          />
        </div>

        {/* Fecha y CVV */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Vencimiento
            </label>
            <input
              type="text"
              value={expiryDate}
              onChange={handleExpiryDateChange}
              placeholder="MM/YY"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-slate-900 placeholder:text-slate-400 bg-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              CVV
            </label>
            <input
              type="text"
              value={cvv}
              onChange={handleCvvChange}
              placeholder="123"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition text-slate-900 placeholder:text-slate-400 bg-white"
              required
            />
          </div>
        </div>

        {/* Información de seguridad */}
        <div className="bg-slate-50 rounded-lg p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          <div>
            <p className="text-sm font-medium text-slate-700">Pago seguro</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Tu información está protegida con encriptación SSL
            </p>
          </div>
        </div>

        {/* Botón de pago */}
        <button
          type="submit"
          disabled={isProcessing}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Procesando...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Pagar ${amount.toLocaleString()} {currency}
            </>
          )}
        </button>

        {/* Logo Wompi */}
        <div className="text-center pt-2">
          <p className="text-xs text-slate-400">Procesado de forma segura por</p>
          <p className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mt-1">
            WOMPI
          </p>
        </div>
      </form>
    </div>
  );
}
