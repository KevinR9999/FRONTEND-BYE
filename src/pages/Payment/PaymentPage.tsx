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
      <div className="max-w-5xl mx-auto px-4 py-6">
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

        <div className="grid lg:grid-cols-[1.5fr,1fr] gap-6">
          {/* Main - Formulario de pago */}
          <div>
            <PaymentGateway
              amount={numericAmount}
              currency="COP"
              planType="custom"
              description={description}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>

          {/* Sidebar - Ingreso de monto */}
          <div>
            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
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
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg text-lg font-bold text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Mensualidad Enero, Clases particulares, etc."
                  rows={3}
                  maxLength={100}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {description.length}/100 caracteres
                </p>
              </div>

              {/* Resumen */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="text-sm font-semibold text-gray-900">
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

              {/* Nota informativa */}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-900">
                  Ingresa el monto acordado con tu instructor y completa el pago de forma segura.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
