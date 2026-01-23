import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PaymentGateway from '../../components/PaymentGateway';

export default function PaymentPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const handlePaymentSuccess = (transactionId: string) => {
    console.log('Pago exitoso:', transactionId);
    setTimeout(() => {
      navigate('/');
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    alert(error);
  };

  // Formatear el valor ingresado
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Solo números
    setAmount(value);
  };

  // Convertir el monto a número
  const numericAmount = parseInt(amount) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Volver</span>
        </button>

        {/* Una sola tarjeta con todo el contenido */}
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

          {/* Contenido del formulario */}
          <div className="px-5 pb-5 space-y-4">
            {/* Formulario de pago integrado - PRIMERO */}
            <PaymentGateway
              amount={numericAmount}
              currency="COP"
              planType="custom"
              description={description}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />

            {/* Detalles del Pago - SEGUNDO */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Detalles del Pago</h3>

              {/* Campo de monto */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Monto a pagar
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0"
                    className="w-full pl-8 pr-16 py-3 border border-gray-300 rounded-lg text-lg font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    COP
                  </span>
                </div>
                {numericAmount > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {new Intl.NumberFormat('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                      minimumFractionDigits: 0
                    }).format(numericAmount)}
                  </p>
                )}
              </div>

              {/* Campo de descripción (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Mensualidad Enero, Clases particulares, etc."
                  rows={2}
                  maxLength={100}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {description.length}/100 caracteres
                </p>
              </div>

              {/* Nota informativa */}
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-900">
                  Ingresa el monto acordado con tu instructor y completa el pago de forma segura.
                </p>
              </div>
            </div>

            {/* Resumen del pago */}
            <div className="bg-white rounded-lg p-4 border-2 border-gray-300">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">
                    {description || 'Pago personalizado'}
                  </span>
                  <span className="text-gray-900 font-semibold">
                    ${numericAmount.toLocaleString()} COP
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-gray-900">
                    ${numericAmount.toLocaleString()} COP
                  </span>
                </div>
              </div>
            </div>

            {/* Botón de pago */}
            <button
              type="submit"
              form="payment-form"
              className="w-full bg-[#1e293b] hover:bg-black text-white font-semibold py-4 rounded-lg text-base transition-colors"
            >
              Completar pago
            </button>

            {/* Texto legal */}
            <p className="text-xs text-gray-500 text-center">
              Al hacer clic, aceptas los{' '}
              <button type="button" className="text-blue-600 hover:underline">
                términos y condiciones
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
