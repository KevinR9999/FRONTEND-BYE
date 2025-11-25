import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  exercise_type?: string;
  skill?: string;
  audio_text?: string;
}

interface UserAnswer {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export default function DiagnosticResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const { questions, userAnswers, correctCount, assignedLevel } = location.state || {};

  useEffect(() => {
    if (!questions || !assignedLevel || !userAnswers) {
      navigate('/');
    }
  }, [questions, assignedLevel, userAnswers, navigate]);

  if (!questions || !assignedLevel || !userAnswers) {
    return null;
  }

  const totalQuestions = questions.length;
  const percentage = (correctCount / totalQuestions) * 100;
  const incorrectCount = totalQuestions - correctCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 mb-6 border border-purple-100">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-colors font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Dashboard</span>
            </button>
            
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent text-center flex-1">
              Resultados Detallados
            </h1>
            
            <div className="w-24"></div>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 text-center border-2 border-indigo-200">
              <div className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
                {assignedLevel}
              </div>
              <div className="text-xs text-slate-600 font-semibold">Nivel</div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border-2 border-green-200">
              <div className="text-3xl font-black text-green-600 mb-1">
                {correctCount}
              </div>
              <div className="text-xs text-slate-600 font-semibold">Correctas</div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 text-center border-2 border-red-200">
              <div className="text-3xl font-black text-red-600 mb-1">
                {incorrectCount}
              </div>
              <div className="text-xs text-slate-600 font-semibold">Incorrectas</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 text-center border-2 border-blue-200">
              <div className="text-3xl font-black text-blue-600 mb-1">
                {percentage.toFixed(0)}%
              </div>
              <div className="text-xs text-slate-600 font-semibold">Precisión</div>
            </div>
          </div>

          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <p className="text-xs text-yellow-800 leading-relaxed">
                Los ejercicios de pronunciación se evalúan automáticamente. Practica regularmente para mejorar.
              </p>
            </div>
          </div>
        </div>

        {/* Lista de preguntas EN ORDEN */}
        <div className="space-y-3">
          {questions.map((question: Question, index: number) => {
            const userAnswer = userAnswers.find((ua: UserAnswer) => ua.questionId === question.id);
            
            if (!userAnswer) return null;

            const isCorrect = userAnswer.isCorrect;
            const isSpeaking = question.exercise_type === 'speaking';

            return (
              <div
                key={question.id}
                className={`bg-white rounded-xl p-4 border-2 transition-all ${
                  isCorrect 
                    ? 'border-green-300 bg-green-50/30' 
                    : 'border-red-300 bg-red-50/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Número */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    isCorrect 
                      ? 'bg-green-500 text-white' 
                      : 'bg-red-500 text-white'
                  }`}>
                    {index + 1}
                  </div>

                  <div className="flex-1">
                    {/* Pregunta */}
                    <p className="text-sm font-semibold text-slate-900 mb-2">
                      {isSpeaking 
                        ? `Repite: "${question.audio_text || question.correct_answer}"`
                        : question.question
                      }
                    </p>

                    {/* Respuesta del usuario */}
                    <div className="flex items-center gap-2 mb-1">
                      {isCorrect ? (
                        <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className="text-xs text-slate-600 font-medium">Tu respuesta:</span>
                      <span className={`text-sm font-semibold ${
                        isCorrect ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {userAnswer.userAnswer || '(sin respuesta)'}
                      </span>
                    </div>

                    {/* Respuesta correcta (si falló) */}
                    {!isCorrect && (
                      <div className="flex items-center gap-2 bg-green-100 border border-green-300 rounded-lg px-3 py-1.5 mt-2">
                        <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-green-800 font-medium">Correcta:</span>
                        <span className="text-sm font-bold text-green-900">
                          {userAnswer.correctAnswer}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botón final */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/')}
            className="px-8 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
          >
            Ir al Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}