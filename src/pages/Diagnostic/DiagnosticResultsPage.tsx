import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import jsPDF from 'jspdf';

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

const exerciseTypeLabel: Record<string, { label: string; color: string; icon: string }> = {
  multiple_choice: { label: 'Opción múltiple', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: '☑' },
  fill_blank:      { label: 'Completar',       color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '✏️' },
  word_order:      { label: 'Ordenar palabras', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: '🔀' },
  speaking:        { label: 'Pronunciación',   color: 'bg-pink-100 text-pink-700 border-pink-200', icon: '🎤' },
  listening:       { label: 'Escucha',         color: 'bg-teal-100 text-teal-700 border-teal-200', icon: '🎧' },
};

const typeLabels: Record<string, string> = {
  multiple_choice: 'Opcion multiple',
  fill_blank: 'Completar',
  word_order: 'Ordenar palabras',
  speaking: 'Pronunciacion',
  listening: 'Escucha',
};

const levelLabels: Record<string, string> = {
  A1: 'Principiante', A2: 'Elemental', B1: 'Intermedio', B2: 'Intermedio Alto'
};

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

  // Estadísticas por tipo de ejercicio
  const byType: Record<string, { correct: number; total: number }> = {};
  questions.forEach((q: Question) => {
    const t = q.exercise_type || 'unknown';
    if (!byType[t]) byType[t] = { correct: 0, total: 0 };
    byType[t].total++;
    const ua = userAnswers.find((ua: UserAnswer) => ua.questionId === q.id);
    if (ua?.isCorrect) byType[t].correct++;
  });

  function downloadPDF() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const PW = 210;
    const ML = 14;
    const CW = PW - ML * 2;
    const dateStr = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    const perfLabel = percentage >= 70 ? 'Buen desempeno' : percentage >= 40 ? 'Desempeno regular' : 'Necesita practica';

    // ── HEADER ──────────────────────────────────────────
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, PW, 30, 'F');
    doc.setFillColor(129, 140, 248);
    doc.rect(0, 30, PW, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('BYE App', ML, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(199, 210, 254);
    doc.text('PLATAFORMA DE APRENDIZAJE DE INGLES', ML, 19);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('Reporte Diagnostico', PW - ML, 12, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(199, 210, 254);
    doc.text(dateStr, PW - ML, 19, { align: 'right' });

    // ── TITULO ──────────────────────────────────────────
    let y = 42;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text('Resultados de la Evaluacion Diagnostica', ML, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Generado automaticamente  |  No requiere firma', ML, y);
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(ML, y, PW - ML, y);
    y += 7;

    // ── CARDS RESUMEN ───────────────────────────────────
    const cardGap = 3;
    const cardW = (CW - cardGap * 3) / 4;
    const cardH = 26;

    // Card Nivel
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(ML, y, cardW, cardH, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(199, 210, 254);
    doc.text('NIVEL ASIGNADO', ML + 3.5, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(255, 255, 255);
    doc.text(assignedLevel, ML + 3.5, y + 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(199, 210, 254);
    doc.text(levelLabels[assignedLevel] || assignedLevel, ML + 3.5, y + 22);

    // Card Correctas
    const c2x = ML + cardW + cardGap;
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(c2x, y, cardW, cardH, 2.5, 2.5, 'F');
    doc.setDrawColor(134, 239, 172); doc.setLineWidth(0.5);
    doc.roundedRect(c2x, y, cardW, cardH, 2.5, 2.5, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(74, 222, 128);
    doc.text('CORRECTAS', c2x + 3.5, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(22, 163, 74);
    doc.text(`${correctCount}/${totalQuestions}`, c2x + 3.5, y + 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(74, 222, 128);
    doc.text('respuestas acertadas', c2x + 3.5, y + 22);

    // Card Incorrectas
    const c3x = ML + (cardW + cardGap) * 2;
    doc.setFillColor(255, 245, 245);
    doc.roundedRect(c3x, y, cardW, cardH, 2.5, 2.5, 'F');
    doc.setDrawColor(252, 165, 165); doc.setLineWidth(0.5);
    doc.roundedRect(c3x, y, cardW, cardH, 2.5, 2.5, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(248, 113, 113);
    doc.text('INCORRECTAS', c3x + 3.5, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(220, 38, 38);
    doc.text(`${incorrectCount}/${totalQuestions}`, c3x + 3.5, y + 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(248, 113, 113);
    doc.text('respuestas fallidas', c3x + 3.5, y + 22);

    // Card Precision
    const c4x = ML + (cardW + cardGap) * 3;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(c4x, y, cardW, cardH, 2.5, 2.5, 'F');
    doc.setDrawColor(147, 197, 253); doc.setLineWidth(0.5);
    doc.roundedRect(c4x, y, cardW, cardH, 2.5, 2.5, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(96, 165, 250);
    doc.text('PRECISION', c4x + 3.5, y + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(37, 99, 235);
    doc.text(`${percentage.toFixed(0)}%`, c4x + 3.5, y + 16);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(96, 165, 250);
    doc.text(perfLabel, c4x + 3.5, y + 22);

    y += cardH + 7;

    // ── BARRA DE PROGRESO ───────────────────────────────
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(ML, y, CW, 13, 2, 2, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
    doc.text('Rendimiento general', ML + 4, y + 5);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(79, 70, 229);
    doc.text(`${percentage.toFixed(0)}%`, PW - ML - 4, y + 5, { align: 'right' });
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(ML + 4, y + 7, CW - 8, 4, 2, 2, 'F');
    const fillW = Math.max(3, ((CW - 8) * percentage) / 100);
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(ML + 4, y + 7, fillW, 4, 2, 2, 'F');
    y += 20;

    // ── DETALLE POR TIPO ────────────────────────────────
    const typeEntries = Object.entries(byType).filter(([, s]) => s.total > 0);
    if (typeEntries.length > 1) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(79, 70, 229);
      doc.text('RENDIMIENTO POR TIPO', ML, y);
      const lblW2 = (doc.getTextWidth('RENDIMIENTO POR TIPO') as number) + 4;
      doc.setDrawColor(199, 210, 254); doc.setLineWidth(0.4);
      doc.line(ML + lblW2, y - 1, PW - ML, y - 1);
      y += 5;

      const tCardW = (CW - (typeEntries.length - 1) * 3) / typeEntries.length;
      const tCardH = 16;
      typeEntries.forEach(([type, stats], i) => {
        const tx = ML + i * (tCardW + 3);
        const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        doc.setFillColor(248, 247, 255);
        doc.roundedRect(tx, y, tCardW, tCardH, 2, 2, 'F');
        doc.setDrawColor(199, 210, 254); doc.setLineWidth(0.3);
        doc.roundedRect(tx, y, tCardW, tCardH, 2, 2, 'S');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(79, 70, 229);
        const lbl = typeLabels[type] || type;
        doc.text(lbl.substring(0, 14), tx + 3, y + 5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(100, 116, 139);
        doc.text(`${stats.correct}/${stats.total} correctas`, tx + 3, y + 10);
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(tx + 3, y + 12, tCardW - 6, 2.5, 1, 1, 'F');
        const bw = Math.max(1, (tCardW - 6) * pct / 100);
        doc.setFillColor(79, 70, 229);
        doc.roundedRect(tx + 3, y + 12, bw, 2.5, 1, 1, 'F');
      });
      y += tCardH + 7;
    }

    // ── LABEL SECCIÓN DETALLE ───────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(79, 70, 229);
    doc.text('DETALLE DE RESPUESTAS', ML, y);
    const lblW = (doc.getTextWidth('DETALLE DE RESPUESTAS') as number) + 4;
    doc.setDrawColor(199, 210, 254); doc.setLineWidth(0.4);
    doc.line(ML + lblW, y - 1, PW - ML, y - 1);
    y += 5;

    // ── TABLA ───────────────────────────────────────────
    const cols = [10, 68, 36, 36, 32];
    const colX = [ML, ML + 10, ML + 78, ML + 114, ML + 150];
    const thH = 9;

    const drawHeader = (startY: number) => {
      doc.setFillColor(248, 247, 255);
      doc.rect(ML, startY, CW, thH, 'F');
      doc.setDrawColor(199, 210, 254); doc.setLineWidth(0.5);
      doc.line(ML, startY + thH, PW - ML, startY + thH);
      const headers = ['#', 'Pregunta', 'Tu respuesta', 'Resp. correcta', 'Resultado'];
      const aligns: Array<'center' | 'left'> = ['center', 'left', 'left', 'left', 'center'];
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(79, 70, 229);
      headers.forEach((h, i) => {
        const tx = aligns[i] === 'center' ? colX[i] + cols[i] / 2 : colX[i] + 2;
        doc.text(h, tx, startY + 6, { align: aligns[i] });
      });
      return startY + thH;
    };

    y = drawHeader(y);

    userAnswers.forEach((a: UserAnswer, i: number) => {
      const q = questions.find((q: Question) => q.id === a.questionId);
      const raw = q?.question || '';
      const qText = (raw.startsWith('Read:') ? raw.replace(/^Read:\s*"[^"]*"\s*/, '').trim() : raw.trim()) || '-';
      const skipped = !a.userAnswer || a.userAnswer === 'Pregunta omitida';
      const isMCQ = q?.exercise_type === 'multiple_choice';
      const isWordOrder = q?.exercise_type === 'word_order';
      const hasOptions = Array.isArray(q?.options) && (q?.options?.length ?? 0) > 0;

      const wrappedQ = doc.splitTextToSize(qText, cols[1] - 4) as string[];
      const wrappedU = doc.splitTextToSize(skipped ? 'Omitida' : (a.userAnswer || '-'), cols[2] - 4) as string[];
      const wrappedC = doc.splitTextToSize(a.correctAnswer || '-', cols[3] - 4) as string[];

      // Extra height si hay opciones MCQ o palabras de word_order
      let extraH = 0;
      let optionLines: string[] = [];
      if (isMCQ && hasOptions) {
        optionLines = (q?.options ?? []).map((opt: string, oi: number) => {
          const letter = String.fromCharCode(65 + oi);
          const mark = opt === a.correctAnswer ? ' [correcta]' : (opt === a.userAnswer && !a.isCorrect ? ' [tu resp.]' : '');
          return `${letter}. ${opt}${mark}`;
        });
        extraH = optionLines.length * 3.5 + 4;
      } else if (isWordOrder && hasOptions) {
        optionLines = [`Palabras: ${(q?.options ?? []).join('  |  ')}`];
        extraH = 6;
      }

      const maxLines = Math.max(wrappedQ.length, wrappedU.length, wrappedC.length);
      const rowH = Math.max(9, maxLines * 4 + 5) + extraH;

      if (y + rowH > 282) {
        doc.addPage();
        y = 14;
        y = drawHeader(y);
      }

      // Fondo fila
      if (skipped) doc.setFillColor(250, 250, 250);
      else if (a.isCorrect) doc.setFillColor(240, 253, 244);
      else doc.setFillColor(255, 245, 245);
      doc.rect(ML, y, CW, rowH, 'F');
      doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.2);
      doc.line(ML, y + rowH, PW - ML, y + rowH);

      const textTopY = y + 5.5;
      const midY = y + (rowH - extraH) / 2;

      // Círculo numerado
      if (skipped) doc.setFillColor(156, 163, 175);
      else if (a.isCorrect) doc.setFillColor(22, 163, 74);
      else doc.setFillColor(220, 38, 38);
      doc.circle(colX[0] + cols[0] / 2, midY, 3.2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255);
      doc.text(String(i + 1), colX[0] + cols[0] / 2, midY + 1.2, { align: 'center' });

      // Tipo de ejercicio (mini badge debajo de la pregunta)
      const typeStr = typeLabels[q?.exercise_type || ''] || '';
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(30, 41, 59);
      doc.text(wrappedQ, colX[1] + 2, textTopY);
      if (typeStr) {
        const afterQ = textTopY + (wrappedQ.length - 1) * 4 + 4;
        doc.setFillColor(237, 233, 254);
        const badgeTW = (doc.getTextWidth(typeStr) as number) + 6;
        doc.roundedRect(colX[1] + 2, afterQ - 3, badgeTW, 4.5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(109, 40, 217);
        doc.text(typeStr, colX[1] + 5, afterQ + 0.5);
      }

      // Respuesta usuario
      doc.setFont('helvetica', skipped ? 'italic' : 'bold'); doc.setFontSize(8);
      if (skipped) doc.setTextColor(156, 163, 175);
      else if (a.isCorrect) doc.setTextColor(22, 163, 74);
      else doc.setTextColor(220, 38, 38);
      doc.text(wrappedU, colX[2] + 2, textTopY);

      // Respuesta correcta
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(22, 163, 74);
      doc.text(wrappedC, colX[3] + 2, textTopY);

      // Badge resultado
      const badgeText = skipped ? 'Omitida' : a.isCorrect ? 'Correcta' : 'Incorrecta';
      const badgeCx = colX[4] + cols[4] / 2;
      const bW = 24; const bH = 6.5;
      if (skipped) doc.setFillColor(243, 244, 246);
      else if (a.isCorrect) doc.setFillColor(220, 252, 231);
      else doc.setFillColor(254, 226, 226);
      doc.roundedRect(badgeCx - bW / 2, midY - bH / 2, bW, bH, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      if (skipped) doc.setTextColor(107, 114, 128);
      else if (a.isCorrect) doc.setTextColor(22, 163, 74);
      else doc.setTextColor(185, 28, 28);
      doc.text(badgeText, badgeCx, midY + 1.3, { align: 'center' });

      // Opciones MCQ / palabras word_order
      if (optionLines.length > 0) {
        const optStartY = y + rowH - extraH + 2;
        doc.setFillColor(248, 247, 255);
        doc.roundedRect(colX[1] + 2, optStartY - 1, CW - 14, extraH - 1, 1.5, 1.5, 'F');
        optionLines.forEach((line, li) => {
          const isCor = isMCQ && line.includes('[correcta]');
          const isUsr = isMCQ && line.includes('[tu resp.]');
          if (isCor) doc.setTextColor(22, 163, 74);
          else if (isUsr) doc.setTextColor(220, 38, 38);
          else doc.setTextColor(100, 116, 139);
          doc.setFont('helvetica', isCor || isUsr ? 'bold' : 'normal');
          doc.setFontSize(7);
          doc.text(line, colX[1] + 4, optStartY + li * 3.5 + 2.5);
        });
      }

      y += rowH;
    });

    // ── FOOTER ──────────────────────────────────────────
    y += 8;
    if (y < 284) {
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
      doc.line(ML, y, PW - ML, y);
      y += 4;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(148, 163, 184);
      doc.text('BYE App - Plataforma de aprendizaje de ingles', ML, y);
      doc.text(`Generado el ${dateStr}`, PW - ML, y, { align: 'right' });
    }

    doc.save(`reporte-diagnostico-${assignedLevel}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

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

            {/* Botón descargar PDF */}
            <button
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              PDF
            </button>
          </div>

          {/* Resumen top */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 text-center border-2 border-indigo-200">
              <div className="text-3xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
                {assignedLevel}
              </div>
              <div className="text-xs text-slate-600 font-semibold">Nivel</div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border-2 border-green-200">
              <div className="text-3xl font-black text-green-600 mb-1">{correctCount}</div>
              <div className="text-xs text-slate-600 font-semibold">Correctas</div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 text-center border-2 border-red-200">
              <div className="text-3xl font-black text-red-600 mb-1">{incorrectCount}</div>
              <div className="text-xs text-slate-600 font-semibold">Incorrectas</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 text-center border-2 border-blue-200">
              <div className="text-3xl font-black text-blue-600 mb-1">{percentage.toFixed(0)}%</div>
              <div className="text-xs text-slate-600 font-semibold">Precisión</div>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="mb-5">
            <div className="flex justify-between text-xs text-slate-500 mb-1 font-medium">
              <span>Rendimiento general</span>
              <span className="font-bold text-indigo-600">{percentage.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Desglose por tipo */}
          {Object.keys(byType).length > 1 && (
            <div className="mb-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Por tipo de ejercicio</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(byType).map(([type, stats]) => {
                  const info = exerciseTypeLabel[type];
                  const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                  return (
                    <div key={type} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">{info?.icon || '📝'}</span>
                        <span className="text-xs font-semibold text-slate-700">{info?.label || type}</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{stats.correct}/{stats.total} correctas</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <p className="text-xs text-yellow-800 leading-relaxed">
                Los ejercicios de pronunciación se evalúan automáticamente. Practica regularmente para mejorar.
              </p>
            </div>
          </div>
        </div>

        {/* Lista de preguntas */}
        <div className="space-y-3">
          {questions.map((question: Question, index: number) => {
            const userAnswer = userAnswers.find((ua: UserAnswer) => ua.questionId === question.id);
            if (!userAnswer) return null;

            const isCorrect = userAnswer.isCorrect;
            const isSpeaking = question.exercise_type === 'speaking';
            const isWordOrder = question.exercise_type === 'word_order';
            const isMCQ = question.exercise_type === 'multiple_choice';
            const typeInfo = exerciseTypeLabel[question.exercise_type || ''];
            const hasOptions = Array.isArray(question.options) && question.options.length > 0;

            return (
              <div
                key={question.id}
                className={`bg-white rounded-xl border-2 transition-all overflow-hidden ${
                  isCorrect ? 'border-green-300' : 'border-red-300'
                }`}
              >
                {/* Cabecera de la tarjeta */}
                <div className={`px-4 py-2 flex items-center gap-2 ${
                  isCorrect ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0 ${
                    isCorrect ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {index + 1}
                  </div>
                  {typeInfo && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${typeInfo.color}`}>
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                  )}
                  <div className="ml-auto">
                    {isCorrect ? (
                      <span className="flex items-center gap-1 text-green-700 text-xs font-bold">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Correcta
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-700 text-xs font-bold">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Incorrecta
                      </span>
                    )}
                  </div>
                </div>

                {/* Cuerpo */}
                <div className="p-4">
                  <p className="text-sm font-semibold text-slate-900 mb-3">
                    {isSpeaking
                      ? `Repite: "${question.audio_text || question.correct_answer}"`
                      : question.question
                    }
                  </p>

                  {/* Opciones MCQ */}
                  {isMCQ && hasOptions && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Opciones disponibles</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {question.options.map((opt: string, oi: number) => {
                          const isUserChoice = opt === userAnswer.userAnswer;
                          const isCorrectOpt = opt === userAnswer.correctAnswer;
                          let cls = 'border-slate-200 bg-slate-50 text-slate-600';
                          if (isCorrectOpt) cls = 'border-green-400 bg-green-50 text-green-800 font-semibold';
                          if (isUserChoice && !isCorrect) cls = 'border-red-400 bg-red-50 text-red-800 font-semibold';
                          if (isUserChoice && isCorrect) cls = 'border-green-400 bg-green-50 text-green-800 font-semibold';
                          return (
                            <div key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${cls}`}>
                              <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold flex-shrink-0 border-current">
                                {String.fromCharCode(65 + oi)}
                              </span>
                              <span>{opt}</span>
                              {isCorrectOpt && <span className="ml-auto text-green-600">✓</span>}
                              {isUserChoice && !isCorrectOpt && <span className="ml-auto text-red-500">✗</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Palabras word_order */}
                  {isWordOrder && hasOptions && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-2">Palabras disponibles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {question.options.map((word: string, wi: number) => (
                          <span key={wi} className="px-2 py-1 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700 font-medium">
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Respuestas */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                      isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <span className="text-slate-500 font-semibold whitespace-nowrap">Tu respuesta:</span>
                      <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                        {userAnswer.userAnswer || 'Sin respuesta'}
                      </span>
                    </div>

                    {!isCorrect && (
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border bg-green-50 border-green-300 text-xs">
                        <svg className="w-3.5 h-3.5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="text-slate-500 font-semibold whitespace-nowrap">Correcta:</span>
                        <span className="font-bold text-green-800">{userAnswer.correctAnswer}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Botón final */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={downloadPDF}
            className="px-6 py-3 bg-white border-2 border-indigo-300 text-indigo-700 rounded-2xl font-bold text-base shadow hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar PDF
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white rounded-2xl font-bold text-base shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
          >
            Ir al Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}
