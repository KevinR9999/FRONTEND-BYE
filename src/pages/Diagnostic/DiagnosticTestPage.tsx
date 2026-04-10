import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagnosticService } from '../../services/diagnosticService';
import { supabase } from '../../lib/supabaseClient';
import { loadAppSettings } from '../../services/appSettingsService';
import SpeakingExercise from '../../components/ExerciseTypes/SpeakingExercise';
import FillBlankExercise from '../../components/ExerciseTypes/FillBlankExercise';
import WordOrderExercise from '../../components/ExerciseTypes/WordOrderExercise';
import ListeningExercise from '../../components/ExerciseTypes/ListeningExercise';
import { CheckCircle2, BarChart3, AlertTriangle, ArrowRight, Clock, X, Loader2, Target, BookOpen, CheckCheck, Percent } from 'lucide-react';

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
      // Cargar tiempo límite desde configuración
      const appSettings = await loadAppSettings();
      setTimeLeft(appSettings.diagnostic_time_limit * 60);

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

    const answer = {
      questionId: current.id,
      userAnswer: selectedAnswer,
      correctAnswer: current.correct_answer,
      isCorrect
    };

    if (currentIndex < questions.length - 1) {
      setUserAnswers([...userAnswers, answer]);
      if (isCorrect) {
        setCorrectCount(correctCount + 1);
      }
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer('');
    } else {
      finishTest(answer);
    }
  }

  async function finishTest(lastAnswer?: { questionId: string; userAnswer: string; correctAnswer: string; isCorrect: boolean }) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🏁 Finalizando test...');

      // Incluir la última respuesta si se proporciona
      const allAnswers = lastAnswer ? [...userAnswers, lastAnswer] : userAnswers;
      console.log('📊 Respuestas totales:', allAnswers.length);

      // Preparar respuestas para guardar con información completa
      const answersToSave = allAnswers.map((answer) => {
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
        correctCount + (lastAnswer?.isCorrect ? 1 : 0),
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-[#5B5FC7] animate-spin mx-auto mb-6" />
          <p className="text-gray-700 font-semibold text-lg">Loading diagnostic test...</p>
          <p className="text-gray-500 text-sm mt-2">Preparing your questions</p>
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
              <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-white" strokeWidth={3} />
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
                <span className="text-slate-600 font-medium text-sm sm:text-base flex items-center gap-2">
                  <CheckCheck className="w-5 h-5 text-purple-600" />
                  Respuestas correctas:
                </span>
                <span className="font-bold text-lg sm:text-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">{correctCount}/{questions.length}</span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent"></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium text-sm sm:text-base flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Precisión:
                </span>
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
                className="w-full px-6 py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
              >
                <BarChart3 className="w-6 h-6" />
                Ver resultados detallados
              </button>

              <button
                onClick={() => navigate('/')}
                className="w-full px-6 py-4 rounded-2xl font-bold text-lg bg-white text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-3"
              >
                Ir al dashboard
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center bg-white rounded-2xl shadow-xl p-10 border border-red-200 max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">No questions available</h3>
          <p className="text-gray-600 mb-8">Please contact the system administrator.</p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-4 bg-gradient-to-br from-[#5B5FC7] to-[#4A4FA8] text-white rounded-[10px] font-bold hover:shadow-lg transition-all"
          >
            Go back home
          </button>
        </div>
      </div>
    );
  }

  const current = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  // Si es listening pero no tiene opciones, convertirlo a speaking
  const hasValidOptions = current.options && current.options.length > 0;
  const isListening = current.exercise_type === 'listening' && hasValidOptions;
  const isSpeaking = current.exercise_type === 'speaking' || (current.exercise_type === 'listening' && !hasValidOptions);
  const isFillBlank = current.exercise_type === 'fill_blank';
  const isWordOrder = current.exercise_type === 'word_order';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-3xl mx-auto">

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden hover:shadow-3xl transition-all duration-300">

          {/* Header mejorado */}
          <div className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 px-6 py-5">
            <div className="flex justify-between items-center mb-4 min-h-[36px]">
              {/* Info de pregunta */}
              <div className="flex items-center gap-3 text-sm font-semibold text-gray-600">
                <span className="bg-[#EEEEFF] text-[#5B5FC7] px-2.5 py-1 rounded-md font-bold text-[13px]">
                  {currentIndex + 1}
                </span>
                <span>of {questions.length}</span>
              </div>

              {/* Timer */}
              <div className={`flex items-center gap-2 text-[15px] font-bold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-md ${timeLeft < 300 ? 'animate-pulse' : ''}`}>
                <Clock className="w-3.5 h-3.5" />
                <span className={`font-mono tabular-nums ${timeLeft < 300 ? 'text-red-500' : ''}`}>
                  {timeDisplay}
                </span>
              </div>

              {/* Botón cerrar */}
              <button
                onClick={() => navigate('/')}
                className="w-9 h-9 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 rounded-md flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              >
                <X className="w-[18px] h-[18px]" strokeWidth={2.5} />
              </button>
            </div>

            {/* Progress bar mejorado */}
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-[#5B5FC7] to-[#4A4FA8] rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(91,95,199,0.4)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:p-16">

            {/* Instrucción para listening */}
            {isListening && (
              <p className="text-center text-slate-500 font-medium mb-6 text-sm tracking-wide">
                Escucha el audio y selecciona la oración correcta.
              </p>
            )}

            {/* Pregunta con jerarquía mejorada */}
            {!isSpeaking && !isFillBlank && !isListening && (
              <>
                {current.question.startsWith('Read:') ? (
                  <div className="space-y-4 mb-10">
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                      <p className="text-sm text-blue-700 font-semibold mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Lee el siguiente texto:
                      </p>
                      <p className="text-lg text-gray-800 leading-relaxed">
                        {current.question.replace(/^Read:\s*"/, '').replace(/"[^"]*$/, '')}
                      </p>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 text-center">
                      {current.question.match(/"([^"]*)"$/)?.[1] || 'What is the question?'}
                    </h2>
                  </div>
                ) : current.question.includes('___') ? (
                  <div className="mb-10">
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl p-6">
                      <p className="text-sm text-purple-700 font-semibold mb-4 text-center">
                        Selecciona la opción correcta:
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 text-xl sm:text-2xl font-bold text-gray-900">
                        {current.question.split('___').map((part, idx, arr) => (
                          <span key={idx} className="inline-flex items-center gap-2">
                            <span>{part.trim()}</span>
                            {idx < arr.length - 1 && (
                              <span className="inline-block min-w-[80px] px-3 py-1.5 bg-white border-2 border-dashed border-purple-400 rounded-lg text-purple-400 text-center text-base">
                                ___
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-[26px] sm:text-[30px] lg:text-[32px] font-bold text-gray-900 text-center mb-10 leading-[1.4] tracking-tight">
                    {current.question}
                  </h2>
                )}
              </>
            )}

            {isListening ? (
              <ListeningExercise
                key={current.id}
                question={current.question}
                options={current.options || []}
                correctAnswer={current.correct_answer}
                isLastQuestion={currentIndex === questions.length - 1}
                onAnswer={(isCorrect, userAnswer) => {
                  const answer = {
                    questionId: current.id,
                    userAnswer: userAnswer || '',
                    correctAnswer: current.correct_answer,
                    isCorrect
                  };

                  if (currentIndex < questions.length - 1) {
                    setUserAnswers([...userAnswers, answer]);
                    if (isCorrect) {
                      setCorrectCount(correctCount + 1);
                    }
                    setCurrentIndex(currentIndex + 1);
                    setSelectedAnswer('');
                  } else {
                    finishTest(answer);
                  }
                }}
              />
            ) : isWordOrder ? (
              <WordOrderExercise
                key={current.id}
                question={current.audio_text || current.question}
                correctAnswer={current.correct_answer}
                words={current.options}
                isLastQuestion={currentIndex === questions.length - 1}
                onAnswer={(isCorrect, userAnswer) => {
                  const answer = {
                    questionId: current.id,
                    userAnswer: userAnswer || '',
                    correctAnswer: current.correct_answer,
                    isCorrect
                  };

                  if (currentIndex < questions.length - 1) {
                    setUserAnswers([...userAnswers, answer]);
                    if (isCorrect) {
                      setCorrectCount(correctCount + 1);
                    }
                    setCurrentIndex(currentIndex + 1);
                    setSelectedAnswer('');
                  } else {
                    finishTest(answer);
                  }
                }}
              />
            ) : isFillBlank ? (
              <FillBlankExercise
                key={current.id}
                question={current.question}
                correctAnswer={current.correct_answer}
                isLastQuestion={currentIndex === questions.length - 1}
                onAnswer={(isCorrect, userAnswer) => {
                  const answer = {
                    questionId: current.id,
                    userAnswer: userAnswer || '',
                    correctAnswer: current.correct_answer,
                    isCorrect
                  };

                  if (currentIndex < questions.length - 1) {
                    setUserAnswers([...userAnswers, answer]);
                    if (isCorrect) {
                      setCorrectCount(correctCount + 1);
                    }
                    setCurrentIndex(currentIndex + 1);
                    setSelectedAnswer('');
                  } else {
                    finishTest(answer);
                  }
                }}
              />
            ) : isSpeaking ? (
              <SpeakingExercise
                key={current.id}
                question={current.question}
                audioText={current.audio_text || current.correct_answer}
                correctAnswer={current.correct_answer}
                isLastQuestion={currentIndex === questions.length - 1}
                showTranslatePrompt={current.exercise_type === 'listening'}
                onAnswer={(isCorrect, userAnswer) => {
                  const answer = {
                    questionId: current.id,
                    userAnswer: userAnswer || '',
                    correctAnswer: current.correct_answer,
                    isCorrect
                  };

                  if (currentIndex < questions.length - 1) {
                    setUserAnswers([...userAnswers, answer]);
                    if (isCorrect) {
                      setCorrectCount(correctCount + 1);
                    }
                    setCurrentIndex(currentIndex + 1);
                    setSelectedAnswer('');
                  } else {
                    finishTest(answer);
                  }
                }}
              />
            ) : (
              <>
                {/* Opciones con radio buttons mejorados */}
                <div className="max-w-[680px] mx-auto mb-8">
                  <div className="flex flex-col gap-3">
                    {current.options && current.options.length > 0 ? (
                      current.options.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedAnswer(option)}
                          className={`
                            group relative min-h-[64px] px-6 py-5 bg-white border-2 rounded-[10px]
                            cursor-pointer transition-all duration-250 flex items-center gap-4 text-left
                            ${selectedAnswer === option
                              ? 'border-[#5B5FC7] bg-[#EEEEFF] font-semibold text-gray-900 shadow-[0_0_0_4px_rgba(91,95,199,0.1)]'
                              : 'border-gray-200 hover:border-[#5B5FC7] hover:bg-gray-50 hover:translate-x-1'
                            }
                          `}
                        >
                          {/* Radio button */}
                          <div className={`
                            relative flex-shrink-0 w-6 h-6 rounded-full border-[2.5px] transition-all
                            ${selectedAnswer === option
                              ? 'border-[#5B5FC7] bg-white'
                              : 'border-gray-300 group-hover:border-[#5B5FC7] group-hover:scale-110'
                            }
                          `}>
                            {selectedAnswer === option && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#5B5FC7] rounded-full animate-[radioScale_0.2s_ease-out_forwards]" />
                            )}
                          </div>

                          {/* Texto de la opción */}
                          <span className={`text-base leading-[1.5] ${selectedAnswer === option ? 'text-gray-900' : 'text-gray-700'}`}>
                            {option}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="text-center text-red-600 bg-red-50 rounded-2xl p-6 border-2 border-red-200">
                        <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-2" />
                        <p className="font-semibold">Error: No hay opciones disponibles</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botones de acción mejorados */}
                <div className="flex gap-3 justify-center px-6 py-6 border-t border-gray-200 bg-gray-50 -mx-6 sm:-mx-10 lg:-mx-16 -mb-6 sm:-mb-10 lg:-mb-16">
                  <button
                    onClick={() => {
                      if (currentIndex < questions.length - 1) {
                        setCurrentIndex(currentIndex + 1);
                        setSelectedAnswer('');
                      }
                    }}
                    className="px-8 py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-[10px] font-bold text-base transition-all hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 min-h-[52px]"
                  >
                    Skip
                  </button>

                  <button
                    onClick={handleAnswer}
                    disabled={!selectedAnswer}
                    className={`
                      relative overflow-hidden px-8 py-4 rounded-[10px] font-bold text-base transition-all min-h-[52px]
                      ${selectedAnswer
                        ? 'bg-gradient-to-br from-[#5B5FC7] to-[#4A4FA8] text-white shadow-[0_4px_12px_rgba(91,95,199,0.25)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(91,95,199,0.3)] active:translate-y-0'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                      }
                    `}
                  >
                    {currentIndex < questions.length - 1 ? 'Continue' : 'Finish Test'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}