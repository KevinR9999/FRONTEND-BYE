import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagnosticService } from '../../services/diagnosticService';
import { supabase } from '../../lib/supabaseClient';
import { loadAppSettings, clearSettingsCache } from '../../services/appSettingsService';
import SpeakingExercise from '../../components/ExerciseTypes/SpeakingExercise';
import FillBlankExercise from '../../components/ExerciseTypes/FillBlankExercise';
import WordOrderExercise from '../../components/ExerciseTypes/WordOrderExercise';
import ListeningExercise from '../../components/ExerciseTypes/ListeningExercise';
import { CheckCircle2, AlertTriangle, ArrowRight, Clock, Loader2, BookOpen, Download } from 'lucide-react';

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

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Opcion multiple',
  fill_blank:      'Completar espacio',
  word_order:      'Ordenar palabras',
  listening:       'Escucha',
  speaking:        'Hablar',
  reading:         'Lectura',
};

export default function DiagnosticTestPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [correctCount, setCorrectCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [finishedByTimeout, setFinishedByTimeout] = useState(false);
  const [assignedLevel, setAssignedLevel] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [studentName, setStudentName] = useState<string>('');
  const [studentEmail, setStudentEmail] = useState<string>('');

  // Refs para el timer basado en tiempo real
  const startTimeRef = useRef<number | null>(null);
  const timeLimitRef = useRef<number>(20 * 60);
  const isFinishingRef = useRef(false);
  // Refs para siempre tener los últimos valores en closures del timer
  const userAnswersRef = useRef<UserAnswer[]>([]);
  const questionsRef = useRef<Question[]>([]);
  const correctCountRef = useRef<number>(0);

  const navigate = useNavigate();

  useEffect(() => {
    loadTest();
  }, []);

  // Timer basado en Date.now() para ser preciso en cualquier dispositivo
  useEffect(() => {
    if (loading || finished) return;

    const interval = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, timeLimitRef.current - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0 && !isFinishingRef.current) {
        isFinishingRef.current = true;
        clearInterval(interval);
        // Llamar finishTest con las respuestas actuales via ref
        finishTestFromTimer();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [loading, finished]);

  async function finishTestFromTimer() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Usar refs para evitar closures desactualizados del setInterval
      const allAnswers = userAnswersRef.current;
      const currentQuestions = questionsRef.current;
      const totalCorrect = correctCountRef.current;

      const answersToSave = allAnswers.map((answer) => {
        const question = currentQuestions.find(q => q.id === answer.questionId);
        return {
          questionId: answer.questionId,
          questionText: question?.question || '',
          userAnswer: answer.userAnswer,
          correctAnswer: answer.correctAnswer,
          isCorrect: answer.isCorrect,
          exerciseType: question?.exercise_type || 'unknown'
        };
      });

      // Usar las preguntas respondidas como base (no el total de la prueba)
      const answeredCount = allAnswers.length || 1;

      const level = await diagnosticService.saveResult(
        user.id,
        totalCorrect,
        answeredCount,
        answersToSave
      );

      await supabase
        .from('profiles')
        .update({
          diagnostic_completed: true,
          level: level
        })
        .eq('user_id', user.id);

      setUserAnswers(allAnswers);
      setAssignedLevel(level);
      setFinishedByTimeout(true);
      setFinished(true);
    } catch (error) {
      console.error('Error saving test on timeout:', error);
    }
  }

  async function loadTest() {
    try {
      // Siempre traer configuración fresca para tomar el tiempo actualizado desde admin
      clearSettingsCache();
      const appSettings = await loadAppSettings();
      const limitSeconds = appSettings.diagnostic_time_limit * 60;
      timeLimitRef.current = limitSeconds;
      setTimeLeft(limitSeconds);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      setStudentEmail(user.email || '');
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      setStudentName(profile?.full_name || user.email || '');

      const completed = await diagnosticService.hasCompletedTest(user.id);
      if (completed) {
        navigate('/');
        return;
      }

      const questionsData = await diagnosticService.getQuestions();
      setQuestions(questionsData);
      questionsRef.current = questionsData;
      // Marcar el momento exacto en que inicia la prueba
      startTimeRef.current = Date.now();
      setLoading(false);
    } catch (error) {
      console.error('Error loading test:', error);
      setLoading(false);
    }
  }

  function handleAnswer() {
    if (isFinishingRef.current) return;
    const current = questions[currentIndex];
    const validAnswers = current.correct_answer.split('|').map(a => a.toLowerCase().trim());
    const isCorrect = validAnswers.includes(selectedAnswer.toLowerCase().trim());

    const answer = {
      questionId: current.id,
      userAnswer: selectedAnswer,
      correctAnswer: current.correct_answer,
      isCorrect
    };

    if (currentIndex < questions.length - 1) {
      const updated = [...userAnswers, answer];
      userAnswersRef.current = updated;
      setUserAnswers(updated);
      if (isCorrect) {
        correctCountRef.current = correctCountRef.current + 1;
        setCorrectCount(correctCountRef.current);
      }
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer('');
    } else {
      isFinishingRef.current = true;
      finishTest(answer);
    }
  }

  async function finishTest(lastAnswer?: { questionId: string; userAnswer: string; correctAnswer: string; isCorrect: boolean }) {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const allAnswers = lastAnswer ? [...userAnswers, lastAnswer] : userAnswers;

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

      const level = await diagnosticService.saveResult(
        user.id,
        allAnswers.filter(a => a.isCorrect).length,
        allAnswers.length,
        answersToSave
      );

      await supabase
        .from('profiles')
        .update({
          diagnostic_completed: true,
          level: level
        })
        .eq('user_id', user.id);

      setUserAnswers(allAnswers);
      setAssignedLevel(level);
      setFinished(true);
    } catch (error) {
      console.error('Error saving test:', error);
    }
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

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
    const correctCountFinal = userAnswers.filter(a => a.isCorrect).length;
    const answeredTotal = userAnswers.length || 1;
    const percentage = (correctCountFinal / answeredTotal) * 100;
    const levelLabels: Record<string, string> = {
      A1: 'Principiante', A2: 'Elemental', B1: 'Intermedio', B2: 'Intermedio Alto'
    };
    const dateStr = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

    async function downloadPDF() {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      const W = 210;
      const ML = 18;
      const MR = 18;
      const CW = W - ML - MR;
      const PAGE_H = 297;
      const MB = 18;
      let y = 0;

      const GRAY_DARK  = [30,  41,  59]  as const;
      const GRAY_MID   = [100, 116, 139] as const;
      const GRAY_LIGHT = [241, 245, 249] as const;
      const GREEN      = [22,  163, 74]  as const;
      const RED        = [220, 38,  38]  as const;
      const INDIGO     = [79,  70,  229] as const;
      const WHITE      = [255, 255, 255] as const;

      const newPage = () => { doc.addPage(); y = 20; };
      const checkSpace = (needed: number) => { if (y + needed > PAGE_H - MB) newPage(); };
      const setColor = (rgb: readonly [number,number,number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      const setFill  = (rgb: readonly [number,number,number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      const setDraw  = (rgb: readonly [number,number,number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

      // ── ENCABEZADO ──────────────────────────────────────────────
      setFill(GRAY_DARK);
      doc.rect(0, 0, W, 28, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      setColor(WHITE);
      doc.text('Reporte de Prueba Diagnostica', ML, 13);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setColor([180, 190, 210] as const);
      doc.text('BYE - English Learning Platform', ML, 20);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      setColor(WHITE);
      doc.text(assignedLevel, W - MR - 2, 17, { align: 'right' });

      y = 38;

      // ── DATOS DEL ALUMNO ────────────────────────────────────────
      setFill(GRAY_LIGHT);
      setDraw([226, 232, 240] as const);
      doc.setLineWidth(0.3);
      doc.roundedRect(ML, y, CW, 22, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      setColor(GRAY_DARK);
      doc.text(studentName || 'Sin nombre', ML + 5, y + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setColor(GRAY_MID);
      if (studentEmail) doc.text(studentEmail, ML + 5, y + 13);
      doc.text(dateStr, ML + 5, y + 19);

      y += 30;

      // ── RESUMEN ──────────────────────────────────────────────────
      const correctCountFinal = userAnswers.filter(a => a.isCorrect).length;
      const pct = userAnswers.length > 0 ? Math.round((correctCountFinal / userAnswers.length) * 100) : 0;
      const stats = [
        { label: 'Total',       value: String(userAnswers.length)                         },
        { label: 'Correctas',   value: String(correctCountFinal)                          },
        { label: 'Incorrectas', value: String(userAnswers.length - correctCountFinal)      },
        { label: 'Puntaje',     value: `${pct}%`                                          },
      ];
      const boxW = CW / 4 - 2;
      stats.forEach((s, i) => {
        const x = ML + i * (boxW + 2.7);
        setFill(GRAY_LIGHT);
        setDraw([226, 232, 240] as const);
        doc.roundedRect(x, y, boxW, 18, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        setColor(i === 1 ? GREEN : i === 2 ? RED : i === 3 ? INDIGO : GRAY_DARK);
        doc.text(s.value, x + boxW / 2, y + 9, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        setColor(GRAY_MID);
        doc.text(s.label, x + boxW / 2, y + 15, { align: 'center' });
      });
      y += 26;

      // ── LÍNEA + TÍTULO SECCIÓN ───────────────────────────────────
      setDraw([203, 213, 225] as const);
      doc.setLineWidth(0.4);
      doc.line(ML, y, ML + CW, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setColor(GRAY_MID);
      doc.text('RESPUESTAS DETALLADAS', ML, y);
      y += 7;

      // ── PREGUNTAS ────────────────────────────────────────────────
      const GRAY_SUBTLE = [148, 163, 184] as const;
      const RED_SOFT    = [185, 28,  28]  as const;

      userAnswers.forEach((a, i) => {
        const q = questions.find(q => q.id === a.questionId);
        const exerciseType = q?.exercise_type || 'unknown';
        const typeLabel    = TYPE_LABELS[exerciseType] ?? exerciseType;
        const omitted      = !a.userAnswer || a.userAnswer.trim() === '';
        const accentColor  = a.isCorrect ? GREEN : omitted ? GRAY_MID : RED_SOFT;

        const hasOptions = q?.options && q.options.length > 0
          && (exerciseType === 'multiple_choice' || exerciseType === 'word_order' || exerciseType === 'fill_blank');
        const optionsText = hasOptions
          ? doc.splitTextToSize((q!.options as string[]).join('   .   '), CW - 10) as string[]
          : [];

        const questionLines = doc.splitTextToSize(q?.question || '', CW - 10) as string[];
        const answerLines   = doc.splitTextToSize(omitted ? '(sin respuesta)' : a.userAnswer, CW - 50) as string[];
        const correctLines  = !a.isCorrect
          ? doc.splitTextToSize(a.correctAnswer, CW - 50) as string[]
          : [];

        const rowH = 8
          + questionLines.length * 4.5
          + (optionsText.length > 0 ? optionsText.length * 4 + 5 : 0)
          + answerLines.length * 4.5
          + (!a.isCorrect ? correctLines.length * 4.5 + 2 : 0)
          + 5;

        checkSpace(rowH);

        setFill([248, 250, 252] as const);
        setDraw([226, 232, 240] as const);
        doc.setLineWidth(0.3);
        doc.roundedRect(ML, y, CW, rowH, 1.5, 1.5, 'FD');

        setFill(accentColor);
        doc.rect(ML, y, 2.5, rowH, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        setColor(GRAY_SUBTLE);
        doc.text(`${i + 1}.`, ML + 5, y + 6);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        setColor(GRAY_MID);
        doc.text(typeLabel.toUpperCase(), ML + 12, y + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        setColor(accentColor);
        const statusLabel = a.isCorrect ? 'Correcta' : omitted ? 'Omitida' : 'Incorrecta';
        doc.text(statusLabel, ML + CW - 4, y + 6, { align: 'right' });

        setDraw([226, 232, 240] as const);
        doc.setLineWidth(0.2);
        doc.line(ML + 3, y + 8, ML + CW, y + 8);

        let iy = y + 13;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        setColor(GRAY_DARK);
        doc.text(questionLines, ML + 5, iy);
        iy += questionLines.length * 4.5 + 2;

        if (optionsText.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          setColor(GRAY_SUBTLE);
          const opLabel = exerciseType === 'word_order' ? 'Palabras disponibles:' : 'Opciones:';
          doc.text(opLabel, ML + 5, iy);
          iy += 4;
          doc.setFont('helvetica', 'italic');
          setColor(GRAY_MID);
          doc.text(optionsText, ML + 5, iy);
          iy += optionsText.length * 4 + 2;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        setColor(GRAY_SUBTLE);
        doc.text('Respuesta:', ML + 5, iy);
        doc.setFont('helvetica', 'bold');
        setColor(omitted ? GRAY_MID : a.isCorrect ? GREEN : RED_SOFT);
        doc.text(answerLines, ML + 28, iy);
        iy += answerLines.length * 4.5;

        if (!a.isCorrect) {
          iy += 1;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          setColor(GRAY_SUBTLE);
          doc.text('Correcta:', ML + 5, iy);
          doc.setFont('helvetica', 'bold');
          setColor(GREEN);
          doc.text(correctLines, ML + 28, iy);
        }

        y += rowH + 2.5;
      });

      // ── PIE DE PÁGINA ─────────────────────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        setColor([148, 163, 184] as const);
        doc.text(`BYE English Learning  .  Pagina ${p} de ${totalPages}`, W / 2, PAGE_H - 8, { align: 'center' });
        setDraw([226, 232, 240] as const);
        doc.setLineWidth(0.3);
        doc.line(ML, PAGE_H - 12, W - MR, PAGE_H - 12);
      }

      doc.save(`diagnostico-${assignedLevel}-${new Date().toISOString().slice(0, 10)}.pdf`);
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">

            {finishedByTimeout && (
              <div className="flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-5 py-3">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700 font-medium">La prueba finalizó porque se agotó el tiempo</p>
              </div>
            )}

            <div className="bg-[#5B5FC7] px-8 py-10 text-white text-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">Nivel asignado</p>
              <p className="text-8xl font-black leading-none mb-2">{assignedLevel}</p>
              <p className="text-white/90 text-base font-medium">{levelLabels[assignedLevel] || ''}</p>
            </div>

            <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
              <div className="px-6 py-5 text-center">
                <p className="text-3xl font-bold text-slate-800">{correctCountFinal}<span className="text-slate-400 text-xl font-normal">/{answeredTotal}</span></p>
                <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">Respuestas correctas</p>
              </div>
              <div className="px-6 py-5 text-center">
                <p className="text-3xl font-bold text-slate-800">{percentage.toFixed(0)}<span className="text-slate-400 text-xl font-normal">%</span></p>
                <p className="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wide">Precisión</p>
              </div>
            </div>

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

            <div className="px-8 py-6 space-y-3">
              <button
                onClick={downloadPDF}
                className="w-full px-5 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-[#5B5FC7] to-[#4A4FA8] text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Descargar reporte PDF
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full px-5 py-3.5 rounded-xl font-semibold text-base text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                Ir a inicio
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

  const hasValidOptions = current.options && current.options.length > 0;
  const isListening = current.exercise_type === 'listening' && hasValidOptions;
  const isSpeaking = current.exercise_type === 'speaking' || (current.exercise_type === 'listening' && !hasValidOptions);
  const isFillBlank = current.exercise_type === 'fill_blank';
  const isWordOrder = current.exercise_type === 'word_order';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-3xl mx-auto">

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden hover:shadow-3xl transition-all duration-300">

          <div className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-200 px-6 py-5">
            <div className="flex justify-between items-center mb-4 min-h-[36px]">
              <div className="flex items-center gap-3 text-sm font-semibold text-gray-600">
                <span className="bg-[#EEEEFF] text-[#5B5FC7] px-2.5 py-1 rounded-md font-bold text-[13px]">
                  {currentIndex + 1}
                </span>
                <span>of {questions.length}</span>
              </div>

              <div className={`flex items-center gap-2 text-[15px] font-bold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-md ${timeLeft < 300 ? 'animate-pulse' : ''}`}>
                <Clock className="w-3.5 h-3.5" />
                <span className={`font-mono tabular-nums ${timeLeft < 300 ? 'text-red-500' : ''}`}>
                  {timeDisplay}
                </span>
              </div>

            </div>

            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-[#5B5FC7] to-[#4A4FA8] rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(91,95,199,0.4)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:p-16">

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
                    if (isCorrect) setCorrectCount(correctCount + 1);
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
                    if (isCorrect) setCorrectCount(correctCount + 1);
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
                    if (isCorrect) setCorrectCount(correctCount + 1);
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
                    if (isCorrect) setCorrectCount(correctCount + 1);
                    setCurrentIndex(currentIndex + 1);
                    setSelectedAnswer('');
                  } else {
                    finishTest(answer);
                  }
                }}
              />
            ) : (
              <>
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
