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
      ]
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
      badge: 'Más Popular'
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
      badge: 'Mejor Valor'
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-purple-50 to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Pagar Mensualidad
          </h1>
          <p className="text-slate-600">Instituto BYE - Boost Your English</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Planes */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Selecciona tu plan</h2>

            {(Object.keys(plans) as Array<keyof typeof plans>).map((planKey) => {
              const plan = plans[planKey];
              const isSelected = selectedPlan === planKey;

              return (
                <div
                  key={planKey}
                  onClick={() => setSelectedPlan(planKey)}
                  className={`
                    relative p-6 rounded-2xl cursor-pointer transition-all
                    ${isSelected
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-xl scale-[1.02]'
                      : 'bg-white text-slate-800 shadow-lg hover:shadow-xl hover:scale-[1.01]'
                    }
                  `}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div className={`
                      absolute -top-3 right-6 px-3 py-1 rounded-full text-xs font-bold
                      ${isSelected
                        ? 'bg-yellow-400 text-purple-900'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                      }
                    `}>
                      {plan.badge}
                    </div>
                  )}

                  {/* Radio button */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-bold">
                          ${plan.price.toLocaleString()}
                        </span>
                        <span className={isSelected ? 'text-purple-200' : 'text-slate-500'}>
                          /mes
                        </span>
                      </div>
                    </div>
                    <div className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center
                      ${isSelected
                        ? 'border-white bg-white'
                        : 'border-slate-300'
                      }
                    `}>
                      {isSelected && (
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600"></div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mt-4">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <svg
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isSelected ? 'text-green-300' : 'text-green-600'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span className={`text-sm ${isSelected ? 'text-purple-100' : 'text-slate-600'}`}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Pasarela de pago */}
          <div className="lg:sticky lg:top-8">
            <PaymentGateway
              amount={plans[selectedPlan].price}
              currency="COP"
              planType={selectedPlan}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
