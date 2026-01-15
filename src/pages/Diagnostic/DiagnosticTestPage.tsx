import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagnosticService } from '../../services/diagnosticService';
import { supabase } from '../../lib/supabaseClient';
import SpeakingExercise from '../../components/ExerciseTypes/SpeakingExercise';
import FillBlankExercise from '../../components/ExerciseTypes/FillBlankExercise';
import WordOrderExercise from '../../components/ExerciseTypes/WordOrderExercise';
import ListeningExercise from '../../components/ExerciseTypes/ListeningExercise';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  exercise_type?: string;
  skill?: string;
  audio_text?: string;
  image_url?: string;
}

interface UserAnswer {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export default function DiagnosticTestPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [assignedLevel, setAssignedLevel] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    loadTest();
  }, []);

  useEffect(() => {
    if (loading || finished) return;

    if (timeLeft === 0) {
      finishTest();
      return;
    }
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, loading, finished]);

  async function loadTest() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const completed = await diagnosticService.hasCompletedTest(user.id);
      if (completed) {
        navigate('/');
        return;
      }

      const questionsData = await diagnosticService.getQuestions();
      setQuestions(questionsData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading test:', error);
      setLoading(false);
    }
  }

  function handleAnswer() {
    const current = questions[currentIndex];
    const isCorrect = selectedAnswer.toLowerCase().trim() === current.correct_answer.toLowerCase().trim();
    
    // Guardar respuesta
    setUserAnswers([...userAnswers, {
      questionId: current.id,
      userAnswer: selectedAnswer,
      correctAnswer: current.correct_answer,
      isCorrect
    }]);
    
    if (isCorrect) {
      setCorrectCount(correctCount + 1);
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer('');
    } else {
      finishTest();
    }
  }

  async function finishTest() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🏁 Finalizando test...');
      console.log('📊 Respuestas totales:', userAnswers.length);

      // Preparar respuestas para guardar con información completa
      const answersToSave = userAnswers.map((answer) => {
        const question = questions.find(q => q.id === answer.questionId);
        return {
          questionId: answer.questionId,
          questionText: question?.question || '',
          userAnswer: answer.userAnswer,
          correctAnswer: answer.correctAnswer,
          isCorrect: answer.isCorrect,
          exerciseType: question?.exercise_type || 'unknown'
        };
      });

      console.log('💾 Respuestas preparadas:', answersToSave.length);

      // Guardar resultado + respuestas detalladas en BD
      const level = await diagnosticService.saveResult(
        user.id,
        correctCount,
        questions.length,
        answersToSave
      );

      console.log('✅ Nivel asignado:', level);

      // Actualizar perfil con nivel y marca de completado
      await supabase
        .from('profiles')
        .update({ 
          diagnostic_completed: true,
          level: level
        })
        .eq('user_id', user.id);

      setAssignedLevel(level);
      setFinished(true);

      console.log('🎉 Test finalizado exitosamente');
    } catch (error) {
      console.error('❌ Error saving test:', error);
    }
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const timeColor = timeLeft < 300 ? 'text-red-500' : 'text-white';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 px-4">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 sm:w-20 h-16 sm:h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4 sm:mb-6"></div>
            <div className="absolute inset-0 w-16 sm:w-20 h-16 sm:h-20 border-4 border-transparent border-b-fuchsia-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
          </div>
          <p className="text-slate-700 font-semibold text-base sm:text-lg">Cargando prueba diagnóstica...</p>
          <p className="text-slate-500 text-sm mt-2">Preparando 30 preguntas personalizadas</p>
        </div>
      </div>
    );
  }

  if (finished) {
    const percentage = (correctCount / questions.length) * 100;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 px-4 py-8">
        <div className="w-full max-w-2xl">
          
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-gradient-to-br from-yellow-400 to-pink-500 rounded-full animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 3}s`
                }}
              />
            ))}
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 relative z-10 border border-purple-100">
            
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl animate-bounce">
              <svg className="w-12 h-12 sm:w-16 sm:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent mb-3 text-center">
              ¡Excelente trabajo!
            </h2>
            
            <p className="text-slate-600 mb-6 sm:mb-8 text-base sm:text-lg text-center">
              Has completado la prueba diagnóstica. Tu nivel de inglés es:
            </p>
            
            <div className="inline-block w-full text-center mb-8">
              <div className="inline-block px-8 sm:px-12 py-6 sm:py-8 bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 text-white rounded-3xl shadow-2xl transform hover:scale-105 transition-transform">
                <p className="text-5xl sm:text-7xl font-black mb-2">{assignedLevel}</p>
                <p className="text-base sm:text-lg font-semibold opacity-95">
                  {assignedLevel === 'A1' && 'Principiante'}
                  {assignedLevel === 'A2' && 'Elemental'}
                  {assignedLevel === 'B1' && 'Intermedio'}
                  {assignedLevel === 'B2' && 'Intermedio Alto'}
                </p>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-slate-50 to-purple-50 rounded-2xl p-4 sm:p-6 mb-8 space-y-3 sm:space-y-4 border border-purple-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium text-sm sm:text-base">Respuestas correctas:</span>
                <span className="font-bold text-lg sm:text-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">{correctCount}/{questions.length}</span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium text-sm sm:text-base">Precisión:</span>
                <span className="font-bold text-lg sm:text-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">{percentage.toFixed(0)}%</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate('/diagnostic/results', { 
                  state: { 
                    questions,
                    userAnswers,
                    correctCount,
                    assignedLevel
                  }
                })}
                className="w-full px-6 py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
              >
                📊 Ver resultados detallados
              </button>
              
              <button
                onClick={() => navigate('/')}
                className="w-full px-6 py-4 rounded-2xl font-bold text-lg bg-white text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-50 transition-all"
              >
                Ir al dashboard →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 px-4">
        <div className="text-center bg-white rounded-3xl shadow-2xl p-6 sm:p-10 border border-red-100">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg">
            <span className="text-4xl sm:text-5xl">⚠️</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">No hay preguntas disponibles</h3>
          <p className="text-slate-600 mb-6 sm:mb-8 text-base sm:text-lg">Por favor contacta al administrador del sistema.</p>
          <button 
            onClick={() => navigate('/')}
            className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all transform hover:scale-105 font-semibold text-base sm:text-lg"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  const current = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isListening = current.exercise_type === 'listening';
  const isSpeaking = current.exercise_type === 'speaking';
  const isFillBlank = current.exercise_type === 'fill_blank';
  const isWordOrder = current.exercise_type === 'word_order';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 px-4 py-8">
      <div className="w-full max-w-3xl mx-auto">
        
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-purple-100 transform transition-all duration-500 hover:shadow-3xl">
          
          <div className="px-4 sm:px-8 py-4 sm:py-6 relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600">
            
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}></div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm sm:text-base">{currentIndex + 1}</span>
                  </div>
                  <span className="text-white font-semibold text-sm sm:text-lg">
                    de {questions.length} preguntas
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-full ${timeLeft < 300 ? 'animate-pulse' : ''}`}>
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <span className={`font-mono font-bold text-sm sm:text-base ${timeColor}`}>
                      {timeDisplay}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => navigate('/')}
                    className="text-white/90 hover:text-white transition-all hover:bg-white/20 p-2 rounded-full backdrop-blur-sm"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="h-2 sm:h-3 bg-white/20 backdrop-blur-sm rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-white via-yellow-200 to-white rounded-full transition-all duration-700 ease-out shadow-lg"
                  style={{ width: `${progress}%` }}
                >
                  <div className="h-full w-full animate-pulse bg-white/30"></div>
                </div>
              </div>
              
              <div className="mt-2 text-right">
                <span className="text-white/90 text-xs sm:text-sm font-medium">{Math.round(progress)}% completado</span>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            
            <div className="mb-8 sm:mb-10 text-center">
              {isListening && (
                <div className="mb-3 sm:mb-4 animate-bounce">
                  <span className="text-5xl sm:text-6xl lg:text-7xl drop-shadow-lg">🎧</span>
                </div>
              )}
              {isSpeaking && (
                <div className="mb-3 sm:mb-4 animate-pulse">
                  <span className="text-5xl sm:text-6xl lg:text-7xl drop-shadow-lg">🎤</span>
                </div>
              )}
              {isFillBlank && (
                <div className="mb-3 sm:mb-4">
                  <span className="text-5xl sm:text-6xl lg:text-7xl drop-shadow-lg"></span>
                </div>
              )}
              {isWordOrder && (
                <div className="mb-3 sm:mb-4">
                  <span className="text-5xl sm:text-6xl lg:text-7xl drop-shadow-lg"></span>
                </div>
              )}
              
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 leading-relaxed px-2">
                {isSpeaking ? (
                  <span>
                    Repite esto: <span className="text-indigo-600">"{current.audio_text || current.correct_answer}"</span>
                  </span>
                ) : (
                  current.question
                )}
              </h2>
            </div>

            {isListening ? (
              <ListeningExercise
                key={current.id}
                question={current.question}
                options={current.options || []}
                correctAnswer={current.correct_answer}
                isLastQuestion={currentIndex === questions.length - 1}
                onAnswer={(isCorrect, userAnswer) => {
                  setUserAnswers([...userAnswers, {
                    questionId: current.id,
                    userAnswer: userAnswer || '',
                    correctAnswer: current.correct_answer,
                    isCorrect
                  }]);

                  if (isCorrect) {
                    setCorrectCount(correctCount + 1);
                  }

                  if (currentIndex < questions.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                    setSelectedAnswer('');
                  } else {
                    finishTest();
                  }
                }}
              />
            ) : isWordOrder ? (
              <WordOrderExercise
                key={current.id}
                question={current.audio_text || current.question}
                correctAnswer={current.correct_answer}
                words={current.options}  
                onAnswer={(isCorrect, userAnswer) => {
                  setUserAnswers([...userAnswers, {
                    questionId: current.id,
                    userAnswer: userAnswer || '',
                    correctAnswer: current.correct_answer,
                    isCorrect
                  }]);
                  
                  if (isCorrect) {
                    setCorrectCount(correctCount + 1);
                  }
                  
                  if (currentIndex < questions.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                    setSelectedAnswer('');
                  } else {
                    finishTest();
                  }
                }}
              />
            ) : isFillBlank ? (
              <FillBlankExercise
                key={current.id} 
                question={current.question}
                correctAnswer={current.correct_answer}
                onAnswer={(isCorrect, userAnswer) => {
                  setUserAnswers([...userAnswers, {
                    questionId: current.id,
                    userAnswer: userAnswer || '',
                    correctAnswer: current.correct_answer,
                    isCorrect
                  }]);
                  
                  if (isCorrect) {
                    setCorrectCount(correctCount + 1);
                  }
                  
                  if (currentIndex < questions.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                    setSelectedAnswer('');
                  } else {
                    finishTest();
                  }
                }}
              />
            ) : isSpeaking ? (
              <SpeakingExercise
                key={current.id}
                question={current.question}
                audioText={current.audio_text || ''}
                correctAnswer={current.correct_answer}
                isLastQuestion={currentIndex === questions.length - 1}
                onAnswer={(isCorrect, userAnswer) => {
                  setUserAnswers([...userAnswers, {
                    questionId: current.id,
                    userAnswer: userAnswer || '',
                    correctAnswer: current.correct_answer,
                    isCorrect
                  }]);

                  if (isCorrect) {
                    setCorrectCount(correctCount + 1);
                  }

                  if (currentIndex < questions.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                    setSelectedAnswer('');
                  } else {
                    finishTest();
                  }
                }}
              />
            ) : (
              <>
                <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-10">
                  {current.options && current.options.length > 0 ? (
                    current.options.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedAnswer(option)}
                        className={`
                          w-full p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all text-left text-base sm:text-lg font-semibold group
                          ${selectedAnswer === option 
                            ? 'border-indigo-600 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-xl scale-[1.02] ring-4 ring-indigo-200' 
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-gradient-to-r hover:from-slate-50 hover:to-purple-50 hover:shadow-lg'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className={`
                            w-6 h-6 sm:w-7 sm:h-7 rounded-full border-3 flex items-center justify-center transition-all flex-shrink-0
                            ${selectedAnswer === option 
                              ? 'border-indigo-600 bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg' 
                              : 'border-slate-300 group-hover:border-indigo-400 group-hover:scale-110'
                            }
                          `}>
                            {selectedAnswer === option && (
                              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full"></div>
                            )}
                          </div>
                          <span className="text-slate-700 group-hover:text-slate-900">{option}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center text-red-600 bg-red-50 rounded-2xl p-4 sm:p-6 border-2 border-red-200">
                      <span className="text-2xl sm:text-3xl mb-2 block">⚠️</span>
                      <p className="font-semibold text-sm sm:text-base">Error: No hay opciones disponibles</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleAnswer}
                  disabled={!selectedAnswer}
                  className={`
                    w-full px-6 sm:px-8 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-bold text-base sm:text-xl transition-all transform
                    ${selectedAnswer
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white hover:shadow-2xl hover:scale-[1.02] shadow-xl'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }
                  `}
                >
                  {currentIndex < questions.length - 1 ? (
                    <>
                      <span className="hidden sm:inline">→ Siguiente pregunta</span>
                      <span className="sm:hidden">→ Siguiente</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">✓ Finalizar prueba</span>
                      <span className="sm:hidden">✓ Finalizar</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 sm:mt-6 text-center">
          <div className="inline-flex gap-1.5 sm:gap-2">
            {questions.map((_, idx) => (
              <div
                key={idx}
                className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full transition-all ${
                  idx === currentIndex 
                    ? 'bg-purple-600 w-6 sm:w-8' 
                    : idx < currentIndex 
                      ? 'bg-green-500' 
                      : 'bg-slate-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}