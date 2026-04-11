import { useEffect, useState } from 'react';
import html2pdf from 'html2pdf.js';
import { useNavigate } from 'react-router-dom';
import { diagnosticService } from '../../services/diagnosticService';
import { supabase } from '../../lib/supabaseClient';
import { loadAppSettings } from '../../services/appSettingsService';
import SpeakingExercise from '../../components/ExerciseTypes/SpeakingExercise';
import FillBlankExercise from '../../components/ExerciseTypes/FillBlankExercise';
import WordOrderExercise from '../../components/ExerciseTypes/WordOrderExercise';
import ListeningExercise from '../../components/ExerciseTypes/ListeningExercise';
import { CheckCircle2, BarChart3, AlertTriangle, ArrowRight, Clock, X, Loader2, BookOpen, Download } from 'lucide-react';

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

      // Incluir la última respuesta si se proporciona
      const allAnswers = lastAnswer ? [...userAnswers, lastAnswer] : userAnswers;

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

      // Guardar resultado + respuestas detalladas en BD
      const level = await diagnosticService.saveResult(
        user.id,
        correctCount + (lastAnswer?.isCorrect ? 1 : 0),
        questions.length,
        answersToSave
      );

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
    } catch (error) {
      console.error('Error saving test:', error);
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
    const levelLabels: Record<string, string> = {
      A1: 'Principiante', A2: 'Elemental', B1: 'Intermedio', B2: 'Intermedio Alto'
    };
    const dateStr = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

    function downloadPDF() {
      const correctPct = percentage;
      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <style>
    @page { margin: 0; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e1e2e; font-size: 9.5pt; line-height: 1.55; background: #fff; }

    /* ENCABEZADO */
    .header { background: #5B5FC7; padding: 22px 32px 20px; display: flex; justify-content: space-between; align-items: center; }
    .brand { color: white; }
    .brand-name { font-size: 18pt; font-weight: 900; letter-spacing: -0.5px; line-height: 1; }
    .brand-tag { font-size: 7.5pt; color: rgba(255,255,255,0.6); margin-top: 3px; letter-spacing: 0.5px; text-transform: uppercase; }
    .header-right { text-align: right; color: rgba(255,255,255,0.85); font-size: 8pt; line-height: 1.6; }
    .header-right .doc-name { font-size: 10pt; font-weight: 700; color: white; }

    /* FRANJA DECORATIVA */
    .stripe { height: 4px; background: linear-gradient(to right, #4A4FA8, #9333ea); }

    /* CUERPO */
    .body { padding: 28px 32px; }

    /* TÍTULO DOC */
    .doc-title { font-size: 13pt; font-weight: 700; color: #1e1e2e; margin-bottom: 3px; }
    .doc-sub { font-size: 8.5pt; color: #999; margin-bottom: 22px; }

    /* CARDS RESUMEN */
    .cards { display: flex; gap: 12px; margin-bottom: 26px; }
    .card { flex: 1; border-radius: 8px; padding: 14px 16px; position: relative; overflow: hidden; }
    .card-main { background: #5B5FC7; color: white; }
    .card-stat { background: #f8f8fb; border: 1px solid #e8e8f0; }
    .card-accent { border-left: 3px solid #5B5FC7; }
    .card .clabel { font-size: 7pt; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.65); margin-bottom: 5px; }
    .card-stat .clabel { color: #999; }
    .card .cval { font-size: 26pt; font-weight: 900; color: white; line-height: 1; }
    .card-stat .cval { color: #1e1e2e; }
    .card .csub { font-size: 8.5pt; color: rgba(255,255,255,0.75); margin-top: 4px; }
    .card-stat .csub { color: #888; }
    .card .cdenom { font-size: 14pt; font-weight: 400; opacity: 0.5; }

    /* BARRA PROGRESO */
    .progress-wrap { background: #f0f0f8; border-radius: 6px; padding: 12px 16px; margin-bottom: 26px; }
    .progress-top { display: flex; justify-content: space-between; font-size: 8pt; color: #888; margin-bottom: 7px; }
    .progress-bar-bg { background: #e4e4f0; border-radius: 20px; height: 8px; overflow: hidden; }
    .progress-bar-fill { height: 100%; border-radius: 20px; background: linear-gradient(to right, #5B5FC7, #9333ea); }

    /* SECCIÓN */
    .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .section-line { flex: 1; height: 1px; background: #e4e4f0; }
    .section-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #5B5FC7; white-space: nowrap; }

    /* TABLA */
    table { width: 100%; border-collapse: collapse; font-size: 8pt; }
    thead tr { background: #f4f4fb; }
    th { padding: 9px 11px; text-align: left; font-weight: 700; color: #5B5FC7; font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 2px solid #e4e4f0; }
    td { padding: 8px 11px; border-bottom: 1px solid #f2f2f8; vertical-align: middle; }
    tr:nth-child(even) td { background: #fafafa; }
    tr:last-child td { border-bottom: none; }
    .num { color: #bbb; font-size: 7.5pt; font-weight: 600; }
    .q-text { color: #333; }
    .ans-user { color: #555; }
    .ans-correct { color: #444; font-weight: 600; }
    .omitted { color: #ccc; font-style: italic; }
    .badge { display: inline-block; font-weight: 700; font-size: 7pt; padding: 2px 9px; border-radius: 20px; letter-spacing: 0.3px; }
    .badge-ok { background: #e8faf0; color: #15803d; border: 1px solid #bbf0d0; }
    .badge-fail { background: #fef0f0; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-skip { background: #f5f5f5; color: #aaa; border: 1px solid #e5e5e5; }

    /* PIE */
    .footer { margin-top: 24px; border-top: 1px solid #eee; padding-top: 10px; display: flex; justify-content: space-between; font-size: 7pt; color: #bbb; }
  </style>
</head>
<body>

  <div class="header">
    <div class="brand">
      <div class="brand-name">BYE App</div>
      <div class="brand-tag">Plataforma de aprendizaje de inglés</div>
    </div>
    <div class="header-right">
      <div class="doc-name">Reporte Diagnóstico</div>
      <div>${dateStr}</div>
    </div>
  </div>
  <div class="stripe"></div>

  <div class="body">
    <div class="doc-title">Resultados de la Evaluación Diagnóstica</div>
    <div class="doc-sub">Generado automáticamente · No requiere firma</div>

    <div class="cards">
      <div class="card card-main">
        <div class="clabel">Nivel asignado</div>
        <div class="cval">${assignedLevel}</div>
        <div class="csub">${levelLabels[assignedLevel] || assignedLevel}</div>
      </div>
      <div class="card card-stat card-accent">
        <div class="clabel">Respuestas correctas</div>
        <div class="cval">${correctCount}<span class="cdenom">/${questions.length}</span></div>
        <div class="csub">de ${questions.length} preguntas</div>
      </div>
      <div class="card card-stat card-accent">
        <div class="clabel">Precisión</div>
        <div class="cval">${correctPct.toFixed(0)}<span class="cdenom">%</span></div>
        <div class="csub">${correctPct >= 70 ? 'Buen desempeño' : correctPct >= 40 ? 'Desempeño regular' : 'Necesita práctica'}</div>
      </div>
    </div>

    <div class="progress-wrap">
      <div class="progress-top">
        <span>Rendimiento general</span>
        <span style="font-weight:700;color:#5B5FC7">${correctPct.toFixed(0)}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width:${correctPct}%"></div>
      </div>
    </div>

    <div class="section-header">
      <span class="section-label">Detalle de respuestas</span>
      <div class="section-line"></div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:4%">#</th>
          <th style="width:42%">Pregunta</th>
          <th style="width:20%">Tu respuesta</th>
          <th style="width:20%">Respuesta correcta</th>
          <th style="width:14%;text-align:center">Resultado</th>
        </tr>
      </thead>
      <tbody>
        ${userAnswers.map((a, i) => {
          const q = questions.find(q => q.id === a.questionId);
          const raw = q?.question || '';
          const qText = raw.startsWith('Read:')
            ? raw.replace(/^Read:\s*"[^"]*"\s*/, '').trim()
            : raw.trim();
          const display = qText.length > 85 ? qText.substring(0, 85) + '…' : (qText || '—');
          const skipped = !a.userAnswer || a.userAnswer === 'Pregunta omitida';
          const userAns = skipped ? `<span class="omitted">Omitida</span>` : `<span class="ans-user">${a.userAnswer}</span>`;
          const result = skipped
            ? `<span class="badge badge-skip">Omitida</span>`
            : a.isCorrect
              ? `<span class="badge badge-ok">✓ Correcta</span>`
              : `<span class="badge badge-fail">✗ Incorrecta</span>`;
          const rowBg = a.isCorrect && !skipped ? 'background:#f9fff9' : skipped ? 'background:#fefefe' : '';
          return `<tr style="${rowBg}">
            <td class="num">${i + 1}</td>
            <td class="q-text">${display}</td>
            <td>${userAns}</td>
            <td class="ans-correct">${a.correctAnswer || '—'}</td>
            <td style="text-align:center">${result}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <div class="footer">
      <span>BYE App — Plataforma de aprendizaje de inglés</span>
      <span>Generado el ${dateStr}</span>
    </div>
  </div>

</body>
</html>`;

      // Crear un div oculto, inyectar el HTML y convertir a PDF
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm';
      document.body.appendChild(container);

      const filename = `reporte-diagnostico-${assignedLevel}-${new Date().toISOString().slice(0,10)}.pdf`;

      html2pdf()
        .set({
          margin: 0,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(container)
        .save()
        .then(() => document.body.removeChild(container));
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">

          {/* Card principal */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">

            {/* Banda superior */}
            <div className="bg-[#5B5FC7] px-8 py-10 text-white text-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">Nivel asignado</p>
              <p className="text-8xl font-black leading-none mb-2">{assignedLevel}</p>
              <p className="text-white/90 text-base font-medium">{levelLabels[assignedLevel] || ''}</p>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
              <div className="px-6 py-5 text-center">
                <p className="text-3xl font-bold text-slate-800">{correctCount}<span className="text-slate-400 text-xl font-normal">/{questions.length}</span></p>
                <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">Respuestas correctas</p>
              </div>
              <div className="px-6 py-5 text-center">
                <p className="text-3xl font-bold text-slate-800">{percentage.toFixed(0)}<span className="text-slate-400 text-xl font-normal">%</span></p>
                <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">Precisión</p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="px-8 py-5 border-b border-slate-100">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>Rendimiento</span>
                <span>{percentage.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#5B5FC7] transition-all duration-700"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Botones */}
            <div className="px-8 py-6 space-y-3">
              <button
                onClick={() => navigate('/diagnostic/results', { state: { questions, userAnswers, correctCount, assignedLevel } })}
                className="w-full px-5 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-[#5B5FC7] to-[#4A4FA8] text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                <BarChart3 className="w-5 h-5" />
                Ver resultados detallados
              </button>
              <button
                onClick={downloadPDF}
                className="w-full px-5 py-3.5 rounded-xl font-bold text-base bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Descargar reporte PDF
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full px-5 py-3.5 rounded-xl font-semibold text-base text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                Ir al dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">{dateStr}</p>
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
                      {current.question.replace(/^Read:\s*"[^"]*"\s*/, '') || 'What is the question?'}
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