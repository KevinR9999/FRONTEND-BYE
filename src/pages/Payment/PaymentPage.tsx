import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PaymentGateway from '../../components/PaymentGateway';

export default function PaymentPage() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium' | 'pro'>('premium');

  const plans = {
    basic: {
      name: 'Plan Básico',
      price: 150000,
      features: [
        'Clases 2 veces por semana',
        'Acceso a plataforma digital',
        'Material didáctico incluido',
        'Soporte por email'
      ],
      badge: undefined as string | undefined
    },
    premium: {
      name: 'Plan Estándar',
      price: 250000,
      features: [
        'Clases 3 veces por semana',
        'Acceso completo a plataforma',
        'Material didáctico premium',
        'Práctica de conversación',
        'Certificado de nivel'
      ],
      badge: 'Más Popular' as string | undefined
    },
    pro: {
      name: 'Plan Intensivo',
      price: 350000,
      features: [
        'Clases 5 veces por semana',
        'Tutorías personalizadas',
        'Material exclusivo',
        'Preparación para exámenes',
        'Certificación internacional'
      ],
      badge: 'Mejor Valor' as string | undefined
    }
  };

  const handlePaymentSuccess = (transactionId: string) => {
    console.log('Pago exitoso:', transactionId);
    // Aquí puedes redirigir o mostrar confirmación
    setTimeout(() => {
      navigate('/');
    }, 2000);
  };

  const handlePaymentError = (error: string) => {
    alert(error);
  };

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
              amount={plans[selectedPlan].price}
              currency="COP"
              planType={selectedPlan}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>

          {/* Sidebar - Tu Plan */}
          <div>
            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Tu Plan</h3>

              <div className="space-y-3 mb-4">
                {(Object.keys(plans) as Array<keyof typeof plans>).map((planKey) => {
                  const plan = plans[planKey];
                  const isSelected = selectedPlan === planKey;

                  return (
                    <div
                      key={planKey}
                      onClick={() => setSelectedPlan(planKey)}
                      className={`p-3 cursor-pointer border rounded-lg transition-all ${
                        isSelected
                          ? 'border-[#2563EB] bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-gray-900">{plan.name}</span>
                        {plan.badge && (
                          <span className="text-xs bg-[#2563EB] text-white px-2 py-0.5 rounded-full font-medium">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold text-gray-900">
                        ${plan.price.toLocaleString()} <span className="text-xs text-gray-500 font-normal">COP/mes</span>
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Detalles del plan */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-3">Información del plan</p>
                <ul className="space-y-2">
                  {plans[selectedPlan].features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                      <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
