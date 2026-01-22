import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PaymentGateway from '../../components/PaymentGateway';
import { getPaymentPlans } from '../../services/adminService';
import type { PaymentPlan } from '../../types/admin';

export default function PaymentPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const allPlans = await getPaymentPlans();
      // Filtrar solo planes activos
      const activePlans = allPlans.filter(p => p.is_active);
      setPlans(activePlans);

      // Seleccionar el plan del medio por defecto (o el primero si hay menos de 2)
      if (activePlans.length > 0) {
        const middleIndex = Math.floor(activePlans.length / 2);
        setSelectedPlanId(activePlans[middleIndex]?.id || activePlans[0].id);
      }
    } catch (error) {
      console.error('Error cargando planes:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

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

  // Función para determinar el badge según el precio
  const getPlanBadge = (plan: PaymentPlan, index: number): string | undefined => {
    if (plans.length < 2) return undefined;

    // El plan del medio es "Más Popular"
    const middleIndex = Math.floor(plans.length / 2);
    if (index === middleIndex) return 'Más Popular';

    // El plan más caro es "Mejor Valor"
    const maxPrice = Math.max(...plans.map(p => p.price));
    if (plan.price === maxPrice) return 'Mejor Valor';

    return undefined;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">No hay planes disponibles en este momento.</p>
          <button
            onClick={() => navigate(-1)}
            className="text-violet-600 hover:underline"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  if (!selectedPlan) {
    return null;
  }

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
              amount={selectedPlan.price}
              currency={selectedPlan.currency}
              planType={selectedPlan.name}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>

          {/* Sidebar - Tu Plan */}
          <div>
            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Tu Plan</h3>

              <div className="space-y-3 mb-4">
                {plans.map((plan, index) => {
                  const isSelected = selectedPlanId === plan.id;
                  const badge = getPlanBadge(plan, index);

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`p-3 cursor-pointer border rounded-lg transition-all ${
                        isSelected
                          ? 'border-[#2563EB] bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium text-gray-900">{plan.name}</span>
                        {badge && (
                          <span className="text-xs bg-[#2563EB] text-white px-2 py-0.5 rounded-full font-medium">
                            {badge}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-bold text-gray-900">
                        ${plan.price.toLocaleString()} <span className="text-xs text-gray-500 font-normal">{plan.currency}/{plan.duration_days === 30 ? 'mes' : `${plan.duration_days} días`}</span>
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Detalles del plan */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-3">Información del plan</p>
                {selectedPlan.features && selectedPlan.features.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedPlan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                        <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400 italic">Sin características especificadas</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
