import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Target, CheckCircle, Clock, GraduationCap } from 'lucide-react';
import { loadAppSettings } from '../services/appSettingsService';

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DiagnosticModal({ isOpen, onClose }: DiagnosticModalProps) {
  const [loading, setLoading] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState(50);
  const [timeLimit, setTimeLimit] = useState(20);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      loadAppSettings().then((s) => {
        setTotalQuestions(s.diagnostic_questions_total);
        setTimeLimit(s.diagnostic_time_limit);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSkip() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          level: 'A1',
          diagnostic_completed: true
        })
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Error asignando nivel A1:', profileError);
        return;
      }

      const userName = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       user.email?.split('@')[0] || 
                       'Usuario';
      
      const { error: resultError } = await supabase
        .from('diagnostic_results')
        .insert({
          user_id: user.id,
          correct_answers: 0,
          level: 'A1',
          user_name: userName,
          user_email: user.email || ''
        });

      if (resultError) {
        console.error('Error guardando resultado:', resultError);
      }

      setLoading(false);
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Error en handleSkip:', error);
      setLoading(false);
    }
  }

  function handleStartTest() {
    navigate('/diagnostic-test');
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slideUp relative">
        
        {/* Botón cerrar (X) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icono */}
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Target className="w-8 h-8 text-white" />
        </div>

        {/* Título */}
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
          ¡Bienvenido a BYE!
        </h2>

        {/* Descripción */}
        <p className="text-slate-600 text-center mb-5 text-sm leading-relaxed">
          Te recomendamos hacer una prueba diagnóstica de <span className="font-semibold text-indigo-600">{timeLimit} minutos</span> para personalizar tu experiencia según tu nivel actual.
        </p>

        {/* Beneficios compactos */}
        <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <CheckCircle className="w-5 h-5 text-indigo-600" />
            <p>{totalQuestions} preguntas adaptativas</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Clock className="w-5 h-5 text-indigo-600" />
            <p>Solo {timeLimit} minutos</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <p>Contenido personalizado</p>
          </div>
        </div>

        {/* Botones */}
        <div className="space-y-2">
          <button
            onClick={handleStartTest}
            disabled={loading}
            className="w-full px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            Hacer prueba diagnóstica
          </button>

          <button
            onClick={handleSkip}
            disabled={loading}
            className="w-full px-5 py-2.5 text-slate-600 hover:text-slate-800 font-medium transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'Asignando nivel...' : 'Omitir (empezar en nivel A1)'}
          </button>
        </div>

        {/* Nota pequeña */}
        <p className="text-xs text-slate-400 text-center mt-3">
          Podrás cambiar tu nivel más adelante
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}