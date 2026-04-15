// src/pages/Admin/DiagnosticResultDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Download, User, Calendar, Award, Edit2, Check, X } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { supabase } from '../../lib/supabaseClient';

interface DiagnosticResult {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  correct_answers: number;
  level: string;
  created_at: string;
}

interface DiagnosticAnswer {
  id: string;
  question_id: string;
  question_text: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  exercise_type: string;
  options?: string[];
}

const LEVELS = ['A1', 'A2', 'B1', 'B2'];

const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A1: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  A2: { bg: 'bg-blue-100',  text: 'text-blue-700',  border: 'border-blue-300'  },
  B1: { bg: 'bg-yellow-100',text: 'text-yellow-700',border: 'border-yellow-300'},
  B2: { bg: 'bg-purple-100',text: 'text-purple-700',border: 'border-purple-300'},
};

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Opción múltiple',
  fill_blank:      'Completar espacio',
  word_order:      'Ordenar palabras',
  listening:       'Escucha',
  speaking:        'Hablar',
  reading:         'Lectura',
};

const TYPE_COLORS: Record<string, string> = {
  multiple_choice: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  fill_blank:      'bg-teal-50 text-teal-600 border-teal-100',
  word_order:      'bg-orange-50 text-orange-600 border-orange-100',
  listening:       'bg-sky-50 text-sky-600 border-sky-100',
  speaking:        'bg-pink-50 text-pink-600 border-pink-100',
  reading:         'bg-violet-50 text-violet-600 border-violet-100',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function unlockPreviousLevels(userId: string, assignedLevel: string): Promise<void> {
  const levelOrder = ['A1', 'A2', 'B1', 'B2'];
  const assignedIndex = levelOrder.indexOf(assignedLevel);
  const levelsToUnlock = assignedIndex > 0 ? levelOrder.slice(0, assignedIndex) : [];
  const allLevels = [...levelsToUnlock, assignedLevel];

  const { error } = await supabase.rpc('admin_unlock_lessons_for_user', {
    p_user_id: userId,
    p_levels: allLevels,
  });

  if (error) throw new Error('Error desbloqueando lecciones: ' + error.message);
}

export default function DiagnosticResultDetailPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();

  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLevel, setEditingLevel] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [savingLevel, setSavingLevel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!result) return;
    setExportingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      const W = 210; // ancho A4
      const ML = 18; // margen izquierdo
      const MR = 18; // margen derecho
      const CW = W - ML - MR; // ancho de contenido
      const PAGE_H = 297;
      const MB = 18; // margen inferior
      let y = 0;

      const GRAY_DARK  = [30,  41,  59]  as const;
      const GRAY_MID   = [100, 116, 139] as const;
      const GRAY_LIGHT = [241, 245, 249] as const;
      const GREEN      = [22,  163, 74]  as const;
      const RED        = [220, 38,  38]  as const;
      const INDIGO     = [79,  70,  229] as const;
      const WHITE      = [255, 255, 255] as const;

      const newPage = () => {
        doc.addPage();
        y = 20;
      };

      const checkSpace = (needed: number) => {
        if (y + needed > PAGE_H - MB) newPage();
      };

      const setColor = (rgb: readonly [number,number,number]) =>
        doc.setTextColor(rgb[0], rgb[1], rgb[2]);

      const setFill = (rgb: readonly [number,number,number]) =>
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);

      const setDraw = (rgb: readonly [number,number,number]) =>
        doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

      // ── ENCABEZADO ──────────────────────────────────────────────
      setFill(GRAY_DARK);
      doc.rect(0, 0, W, 28, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      setColor(WHITE);
      doc.text('Reporte de Prueba Diagnóstica', ML, 13);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setColor([180, 190, 210] as const);
      doc.text('BYE — English Learning Platform', ML, 20);

      // Nivel en esquina derecha del header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      setColor(WHITE);
      doc.text(result.level, W - MR - 2, 17, { align: 'right' });

      y = 38;

      // ── DATOS DEL ALUMNO ────────────────────────────────────────
      setFill(GRAY_LIGHT);
      setDraw([226, 232, 240] as const);
      doc.setLineWidth(0.3);
      doc.roundedRect(ML, y, CW, 22, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      setColor(GRAY_DARK);
      doc.text(result.user_name || 'Sin nombre', ML + 5, y + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setColor(GRAY_MID);
      doc.text(result.user_email, ML + 5, y + 13);
      doc.text(formatDate(result.created_at), ML + 5, y + 18.5);

      y += 30;

      // ── RESUMEN ─────────────────────────────────────────────────
      if (answers.length > 0) {
        const correctCount = answers.filter(a => a.is_correct).length;
        const pct = Math.round((correctCount / answers.length) * 100);
        const stats = [
          { label: 'Total',      value: String(answers.length) },
          { label: 'Correctas',  value: String(correctCount)   },
          { label: 'Incorrectas',value: String(answers.length - correctCount) },
          { label: 'Puntaje',    value: `${pct}%` },
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
      }

      // ── LÍNEA DIVISORIA + TÍTULO SECCIÓN ────────────────────────
      setDraw([203, 213, 225] as const);
      doc.setLineWidth(0.4);
      doc.line(ML, y, ML + CW, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setColor(GRAY_MID);
      doc.text('RESPUESTAS DETALLADAS', ML, y);
      y += 7;

      // ── PREGUNTAS ───────────────────────────────────────────────
      const GRAY_SUBTLE = [148, 163, 184] as const;
      const RED_SOFT    = [185, 28,  28]  as const;  // rojo sobrio

      answers.forEach((a, i) => {
        const typeLabel    = TYPE_LABELS[a.exercise_type] ?? a.exercise_type;
        const omitted      = !a.user_answer || a.user_answer.trim() === '';
        const accentColor  = a.is_correct ? GREEN : omitted ? GRAY_MID : RED_SOFT;

        // Opciones disponibles (mcq y word_order)
        const hasOptions   = a.options && a.options.length > 0
          && (a.exercise_type === 'multiple_choice' || a.exercise_type === 'word_order' || a.exercise_type === 'fill_blank');
        const optionsText  = hasOptions
          ? doc.splitTextToSize((a.options as string[]).join('   ·   '), CW - 10) as string[]
          : [];

        const questionLines = doc.splitTextToSize(a.question_text, CW - 10) as string[];
        const answerLines   = doc.splitTextToSize(omitted ? '(sin respuesta)' : a.user_answer, CW - 50) as string[];
        const correctLines  = !a.is_correct
          ? doc.splitTextToSize(a.correct_answer, CW - 50) as string[]
          : [];

        const rowH = 8
          + questionLines.length * 4.5
          + (optionsText.length > 0 ? optionsText.length * 4 + 5 : 0)
          + answerLines.length * 4.5
          + (!a.is_correct ? correctLines.length * 4.5 + 2 : 0)
          + 5;

        checkSpace(rowH);

        // Fondo neutro
        setFill([248, 250, 252] as const);
        setDraw([226, 232, 240] as const);
        doc.setLineWidth(0.3);
        doc.roundedRect(ML, y, CW, rowH, 1.5, 1.5, 'FD');

        // Barra acento izquierda
        setFill(accentColor);
        doc.rect(ML, y, 2.5, rowH, 'F');

        // ── Cabecera de la tarjeta ──
        // Número
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        setColor(GRAY_SUBTLE);
        doc.text(`${i + 1}.`, ML + 5, y + 6);

        // Tipo de ejercicio
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        setColor(GRAY_MID);
        doc.text(typeLabel.toUpperCase(), ML + 12, y + 6);

        // Estado alineado a la derecha
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        setColor(accentColor);
        const statusLabel = a.is_correct ? 'Correcta' : omitted ? 'Omitida' : 'Incorrecta';
        doc.text(statusLabel, ML + CW - 4, y + 6, { align: 'right' });

        // Línea separadora bajo cabecera
        setDraw([226, 232, 240] as const);
        doc.setLineWidth(0.2);
        doc.line(ML + 3, y + 8, ML + CW, y + 8);

        // ── Pregunta ──
        let iy = y + 13;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        setColor(GRAY_DARK);
        doc.text(questionLines, ML + 5, iy);
        iy += questionLines.length * 4.5 + 2;

        // ── Opciones disponibles ──
        if (optionsText.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          setColor(GRAY_SUBTLE);
          const opLabel = a.exercise_type === 'word_order' ? 'Palabras disponibles:' : 'Opciones:';
          doc.text(opLabel, ML + 5, iy);
          iy += 4;
          doc.setFont('helvetica', 'italic');
          setColor(GRAY_MID);
          doc.text(optionsText, ML + 5, iy);
          iy += optionsText.length * 4 + 2;
        }

        // ── Respuesta del alumno ──
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        setColor(GRAY_SUBTLE);
        doc.text('Respuesta:', ML + 5, iy);
        doc.setFont('helvetica', 'bold');
        setColor(omitted ? GRAY_MID : a.is_correct ? GREEN : RED_SOFT);
        doc.text(answerLines, ML + 28, iy);
        iy += answerLines.length * 4.5;

        // ── Respuesta correcta (si es incorrecta u omitida) ──
        if (!a.is_correct) {
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

      // ── PIE DE PÁGINA en cada hoja ───────────────────────────────
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        setColor([148, 163, 184] as const);
        doc.text(`BYE English Learning  ·  Página ${p} de ${totalPages}`, W / 2, PAGE_H - 8, { align: 'center' });
        setDraw([226, 232, 240] as const);
        doc.setLineWidth(0.3);
        doc.line(ML, PAGE_H - 12, W - MR, PAGE_H - 12);
      }

      const filename = `diagnostico-${(result.user_name || result.user_email || 'alumno').replace(/\s+/g, '_')}-${result.level}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error('Error exportando PDF:', e);
      alert('Error al generar el PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  useEffect(() => {
    if (!resultId) return;
    loadData();
  }, [resultId]);

  const loadData = async () => {
    try {
      const [{ data: resData }, { data: ansData }] = await Promise.all([
        supabase
          .from('diagnostic_results')
          .select('id, user_id, user_name, user_email, correct_answers, level, created_at')
          .eq('id', resultId!)
          .single(),
        supabase
          .from('diagnostic_user_answers')
          .select('id, question_id, question_text, user_answer, correct_answer, is_correct, exercise_type')
          .eq('result_id', resultId!)
          .order('id'),
      ]);
      if (resData) { setResult(resData); setSelectedLevel(resData.level); }

      if (ansData && ansData.length > 0) {
        // Traer opciones de diagnostic_questions
        const questionIds = ansData.map((a: any) => a.question_id).filter(Boolean);
        const { data: questionsData } = await supabase
          .from('diagnostic_questions')
          .select('id, options')
          .in('id', questionIds);

        const optionsMap: Record<string, string[]> = {};
        (questionsData ?? []).forEach((q: any) => {
          if (Array.isArray(q.options)) optionsMap[q.id] = q.options;
        });

        setAnswers(ansData.map((a: any) => ({
          ...a,
          options: optionsMap[a.question_id] ?? [],
        })));
      }
    } catch (e) {
      console.error('Error cargando detalle:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLevel = async () => {
    if (!result || selectedLevel === result.level) { setEditingLevel(false); return; }
    setSavingLevel(true);
    try {
      // 1. Actualizar diagnostic_results
      const { data: d1, error: e1 } = await supabase
        .from('diagnostic_results')
        .update({ level: selectedLevel })
        .eq('id', result.id)
        .select('id');
      if (e1) throw new Error('Error en diagnostic_results: ' + e1.message);
      if (!d1 || d1.length === 0) throw new Error('Sin permisos para actualizar diagnostic_results (RLS)');

      // 2. Actualizar profiles
      const { error: e2 } = await supabase
        .from('profiles')
        .update({ level: selectedLevel })
        .eq('user_id', result.user_id);
      if (e2) throw new Error('Error en profiles: ' + e2.message);

      setResult({ ...result, level: selectedLevel });
      setEditingLevel(false);
    } catch (e: any) {
      console.error('Error guardando nivel:', e);
      alert('Error al guardar el nivel: ' + (e?.message ?? 'Error desconocido'));
    } finally {
      setSavingLevel(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Cargando...">
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!result) {
    return (
      <AdminLayout title="No encontrado">
        <p className="text-slate-500">No se encontró el resultado.</p>
      </AdminLayout>
    );
  }

  const skipped = answers.length === 0;
  const correctCount = answers.filter(a => a.is_correct).length;
  const incorrectCount = answers.length - correctCount;
  const percentage = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;
  const lc = LEVEL_COLORS[result.level] ?? { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };

  const byType = Object.entries(TYPE_LABELS).map(([key, label]) => {
    const ofType = answers.filter(a => a.exercise_type === key);
    const correct = ofType.filter(a => a.is_correct).length;
    return { key, label, total: ofType.length, correct };
  }).filter(t => t.total > 0);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          aside, header { display: none !important; }
          .lg\\:pl-64 { padding-left: 0 !important; }
          main { padding: 24px !important; }
          body { background: white !important; }
        }
      `}</style>

      <AdminLayout title={result.user_name || 'Sin nombre'} subtitle="Detalle de prueba diagnóstica">

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 no-print">
          <button
            onClick={() => navigate('/admin/diagnostic-results')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Volver
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
          >
            <Download size={15} />
            {exportingPdf ? 'Generando...' : 'Exportar PDF'}
          </button>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full ${lc.bg} flex items-center justify-center ${lc.text} text-xl font-bold flex-shrink-0`}>
                {(result.user_name || result.user_email)?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{result.user_name || 'Sin nombre'}</h2>
                <p className="text-sm text-slate-500">{result.user_email}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                  <Calendar size={12} />
                  {formatDate(result.created_at)}
                </div>
              </div>
            </div>

            {/* Nivel asignado + editar */}
            <div className="flex flex-col items-end gap-2">
              <p className="text-xs text-slate-400 font-medium">Nivel asignado</p>
              {editingLevel ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedLevel}
                    onChange={e => setSelectedLevel(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-800 bg-white outline-none focus:border-indigo-400"
                    autoFocus
                  >
                    {LEVELS.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleSaveLevel}
                    disabled={savingLevel}
                    className="p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => { setEditingLevel(false); setSelectedLevel(result.level); }}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`px-4 py-1.5 rounded-xl text-sm font-bold border ${lc.bg} ${lc.text} ${lc.border}`}>
                    {result.level}
                  </span>
                  <button
                    onClick={() => setEditingLevel(true)}
                    className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors no-print"
                    title="Cambiar nivel"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
              {editingLevel && (
                <p className="text-xs text-amber-600 max-w-[220px] text-right">
                  Al guardar se actualizará el perfil y se desbloquearán las lecciones correspondientes.
                </p>
              )}
            </div>
          </div>
        </div>

        {skipped ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-10 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={28} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-amber-800 mb-2">Prueba omitida</h3>
            <p className="text-amber-700 text-sm">
              Este usuario omitió la prueba y fue asignado directamente al nivel <strong>{result.level}</strong>.
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Total preguntas', value: answers.length, color: 'text-slate-800', border: 'border-slate-100' },
                { label: 'Correctas',       value: correctCount,   color: 'text-green-600', border: 'border-green-100' },
                { label: 'Incorrectas',     value: incorrectCount, color: 'text-red-500',   border: 'border-red-100'   },
                { label: 'Puntaje',         value: `${percentage}%`, color: 'text-indigo-600', border: 'border-indigo-100' },
              ].map(s => (
                <div key={s.label} className={`bg-white rounded-2xl border ${s.border} p-4 text-center`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Por tipo */}
            {byType.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Award size={15} className="text-indigo-500" />
                  Rendimiento por tipo
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {byType.map(t => {
                    const pct = Math.round((t.correct / t.total) * 100);
                    return (
                      <div key={t.key}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-600 font-medium">{t.label}</span>
                          <span className="text-slate-400">{t.correct}/{t.total} — {pct}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Respuestas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-slate-700">Respuestas detalladas</h3>
                <span className="text-xs text-slate-400">{answers.length} preguntas</span>
              </div>
              {answers.map((a, i) => (
                <div
                  key={a.id}
                  className={`rounded-2xl border-2 overflow-hidden ${
                    a.is_correct
                      ? 'border-green-200 bg-white'
                      : 'border-red-200 bg-white'
                  }`}
                >
                  {/* Header de la pregunta */}
                  <div className={`px-4 py-2.5 flex items-center justify-between ${
                    a.is_correct ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold ${TYPE_COLORS[a.exercise_type] ?? 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                        {TYPE_LABELS[a.exercise_type] ?? a.exercise_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {a.is_correct
                        ? <><CheckCircle size={15} className="text-green-500" /><span className="text-xs font-semibold text-green-600">Correcta</span></>
                        : <><XCircle size={15} className="text-red-400" /><span className="text-xs font-semibold text-red-500">Incorrecta</span></>
                      }
                    </div>
                  </div>

                  {/* Cuerpo */}
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800 mb-3 leading-snug">
                      {a.question_text}
                    </p>

                    {/* Opciones / palabras disponibles */}
                    {a.options && a.options.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-slate-400 mb-1.5">
                          {a.exercise_type === 'word_order' ? 'Palabras disponibles:' : 'Opciones:'}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(a.exercise_type === 'word_order'
                            ? [...a.options].sort(() => Math.random() - 0.5)
                            : a.options
                          ).map((opt: string, oi: number) => (
                            <span
                              key={oi}
                              className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                                a.exercise_type === 'multiple_choice' && opt === a.correct_answer
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start gap-2 text-xs">
                        <span className="text-slate-400 w-32 flex-shrink-0 pt-0.5">Respuesta del alumno:</span>
                        <span className={`font-semibold px-2.5 py-1 rounded-lg ${a.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {a.user_answer || '(sin respuesta)'}
                        </span>
                      </div>
                      {!a.is_correct && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-slate-400 w-32 flex-shrink-0 pt-0.5">Respuesta correcta:</span>
                          <span className="font-semibold px-2.5 py-1 rounded-lg bg-green-100 text-green-700">
                            {a.correct_answer}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </AdminLayout>
    </>
  );
}
