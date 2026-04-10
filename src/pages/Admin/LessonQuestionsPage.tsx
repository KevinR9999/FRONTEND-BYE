// src/pages/Admin/LessonQuestionsPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Plus,
  ArrowLeft,
  Edit2,
  Trash2,
  Check,
  X,
  GripVertical,
  Volume2,
  HelpCircle
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import {
  getLessonById,
  getLessonQuestions,
  createLessonQuestion,
  updateLessonQuestion,
  deleteLessonQuestion
} from '../../services/adminService';
import type { Lesson, LessonQuestion } from '../../types/admin';

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Opción Múltiple' },
  { value: 'fill-in', label: 'Completar Espacio' },
  { value: 'word-order', label: 'Ordenar Palabras' },
  { value: 'match', label: 'Emparejar' },
];

const SKILLS = ['grammar', 'vocabulary', 'reading', 'listening', 'writing', 'speaking'];

type QuestionType = 'mcq' | 'fill-in' | 'word-order' | 'match';

interface MatchPair {
  word: string;
  meaning: string;
}

interface QuestionFormData {
  type: QuestionType;
  skill: string;
  prompt: string;
  options: string[];
  correct_index: number | null;
  correct_answers: string[];
  distractors: string[];
  match_pairs: MatchPair[];
  explanation: string;
  listen_text: string;
  xp_reward_text: string; // string para permitir campo vacío mientras se escribe
}

const emptyForm: QuestionFormData = {
  type: 'mcq',
  skill: 'grammar',
  prompt: '',
  options: ['', '', '', ''],
  correct_index: 0,
  correct_answers: [''],
  distractors: [],
  match_pairs: [{ word: '', meaning: '' }],
  explanation: '',
  listen_text: '',
  xp_reward_text: '5',
};

export default function LessonQuestionsPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<LessonQuestion | null>(null);
  const [formData, setFormData] = useState<QuestionFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (lessonId) {
      loadData();
    }
  }, [lessonId]);

  const loadData = async () => {
    if (!lessonId) return;
    try {
      const [lessonData, questionsData] = await Promise.all([
        getLessonById(lessonId),
        getLessonQuestions(lessonId),
      ]);
      setLesson(lessonData);
      setQuestions(questionsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingQuestion(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  // Parsea "word = meaning" en {word, meaning}
  const parseMatchPairs = (answers: string[]): MatchPair[] => {
    if (!answers || answers.length === 0) return [{ word: '', meaning: '' }];
    return answers.map(a => {
      const parts = a.split('=').map(s => s.trim());
      return { word: parts[0] || '', meaning: parts[1] || '' };
    });
  };

  // Convierte {word, meaning} a "word = meaning"
  const matchPairsToAnswers = (pairs: MatchPair[]): string[] => {
    return pairs
      .filter(p => p.word.trim() || p.meaning.trim())
      .map(p => `${p.word.trim()} = ${p.meaning.trim()}`);
  };

  const openEditModal = (question: LessonQuestion) => {
    setEditingQuestion(question);
    const rawCorrectAnswers = Array.isArray(question.correct_answers) && question.correct_answers.length > 0
      ? question.correct_answers
      : [''];

    // Para word-order: auto-dividir si hay una sola frase con espacios
    const correctAnswers = question.type === 'word-order'
      ? (rawCorrectAnswers.length === 1 && rawCorrectAnswers[0].includes(' ')
          ? rawCorrectAnswers[0].trim().split(/\s+/)
          : rawCorrectAnswers)
      : rawCorrectAnswers;

    const newFormData: QuestionFormData = {
      type: (question.type as QuestionType) || 'mcq',
      skill: question.skill || 'grammar',
      prompt: question.prompt ?? '',
      options: Array.isArray(question.options) && question.options.length > 0
        ? question.options
        : ['', '', '', ''],
      correct_index: question.correct_index ?? 0,
      correct_answers: correctAnswers,
      distractors: question.type === 'word-order' && Array.isArray(question.options)
        ? (() => {
            // Normaliza para comparar: minúsculas y sin puntuación al final/inicio
            const normToken = (s: string) => s.toLowerCase().replace(/^[.?!,;:]+|[.?!,;:]+$/g, '').trim();
            // Expandir correct_answers a tokens individuales
            const correctTokens = new Set(
              correctAnswers
                .flatMap(a => a.includes(' ') ? a.trim().split(/\s+/) : [a])
                .map(normToken)
                .filter(Boolean)
            );
            // Filtrar options: excluir las que son parte de la respuesta correcta
            // También excluir tokens que son solo puntuación (., ?, !, etc.)
            return (question.options as string[]).filter(w => {
              const norm = normToken(w);
              return norm !== '' && !correctTokens.has(norm);
            });
          })()
        : [],
      match_pairs: question.type === 'match'
        ? ((question.options as any)?.pairs && Array.isArray((question.options as any).pairs)
            ? (question.options as any).pairs.map((p: any) => ({ word: p.left || '', meaning: p.right || '' }))
            : parseMatchPairs(correctAnswers))
        : [{ word: '', meaning: '' }],
      explanation: question.explanation ?? '',
      listen_text: question.listen_text ?? '',
      xp_reward_text: String(question.xp_reward ?? 5),
    };
    setFormData(newFormData);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!lessonId) return;
    if (!formData.prompt.trim()) {
      alert('La pregunta es requerida');
      return;
    }

    setSaving(true);
    try {
      const maxOrder = questions.length > 0
        ? Math.max(...questions.map((q) => q.order_index))
        : 0;

      // Para match, convertir los pares a formato "word = meaning"
      // Para word-order, auto-dividir si hay una sola entrada con espacios
      const rawAnswers = formData.correct_answers.filter((a) => a.trim());
      const finalCorrectAnswers = formData.type === 'match'
        ? matchPairsToAnswers(formData.match_pairs)
        : formData.type === 'word-order' && rawAnswers.length === 1 && rawAnswers[0].includes(' ')
          ? rawAnswers[0].trim().split(/\s+/)
          : rawAnswers;

      const xpValue = Math.max(0, parseInt(formData.xp_reward_text) || 5);

      // Para match, guardar también en options.pairs con formato {left, right}
      // que es lo que la página del estudiante espera
      const matchOptions = formData.type === 'match'
        ? {
            pairs: formData.match_pairs
              .filter(p => p.word.trim() && p.meaning.trim())
              .map(p => ({ left: p.word.trim(), right: p.meaning.trim() }))
          }
        : null;

      const questionData: Omit<LessonQuestion, 'id'> = {
        lesson_id: lessonId,
        type: formData.type,
        skill: formData.skill as any,
        prompt: formData.prompt,
        options: formData.type === 'mcq'
          ? formData.options.filter((o) => o.trim())
          : formData.type === 'match'
            ? matchOptions
            : formData.type === 'word-order'
              ? [...finalCorrectAnswers, ...formData.distractors.filter(d => d.trim())]
              : null,
        correct_index: formData.type === 'mcq' ? formData.correct_index : null,
        correct_answers: formData.type !== 'mcq' ? finalCorrectAnswers : null,
        explanation: formData.explanation || null,
        order_index: editingQuestion ? editingQuestion.order_index : maxOrder + 1,
        listen_text: formData.listen_text || null,
        audio_bucket: null,
        audio_path: null,
        xp_reward: xpValue,
      };

      if (editingQuestion) {
        await updateLessonQuestion(editingQuestion.id, questionData);
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === editingQuestion.id ? { ...q, ...questionData, id: q.id } : q
          )
        );
      } else {
        const newQuestion = await createLessonQuestion(questionData);
        setQuestions((prev) => [...prev, newQuestion]);
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error saving question:', error);
      alert('Error al guardar la pregunta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLessonQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Error al eliminar la pregunta');
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  const updateCorrectAnswer = (index: number, value: string) => {
    const newAnswers = [...formData.correct_answers];
    newAnswers[index] = value;
    setFormData({ ...formData, correct_answers: newAnswers });
  };

  const addCorrectAnswer = () => {
    setFormData({ ...formData, correct_answers: [...formData.correct_answers, ''] });
  };

  const updateMatchPair = (index: number, field: 'word' | 'meaning', value: string) => {
    const newPairs = [...formData.match_pairs];
    newPairs[index] = { ...newPairs[index], [field]: value };
    setFormData({ ...formData, match_pairs: newPairs });
  };

  const addMatchPair = () => {
    setFormData({ ...formData, match_pairs: [...formData.match_pairs, { word: '', meaning: '' }] });
  };

  const removeMatchPair = (index: number) => {
    if (formData.match_pairs.length <= 1) return;
    const newPairs = formData.match_pairs.filter((_, i) => i !== index);
    setFormData({ ...formData, match_pairs: newPairs });
  };

  const getTypeLabel = (type: string) => {
    return QUESTION_TYPES.find((t) => t.value === type)?.label || type;
  };

  const sortedQuestions = [...questions].sort((a, b) => a.order_index - b.order_index);

  return (
    <AdminLayout
      title={lesson?.title || 'Preguntas de Lección'}
      subtitle={`Nivel ${lesson?.level || ''} · ${questions.length} preguntas`}
    >
      {/* Back Button + Add */}
      <div className="flex items-center justify-between mb-4">
        <Link
          to="/admin/lessons"
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-600"
        >
          <ArrowLeft size={18} />
          <span>Volver a Lecciones</span>
        </Link>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={18} />
          <span>Nueva Pregunta</span>
        </button>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : sortedQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <HelpCircle size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No hay preguntas en esta lección</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-slate-600 text-sm font-medium hover:underline"
            >
              Crear primera pregunta
            </button>
          </div>
        ) : (
          sortedQuestions.map((question, index) => (
            <div
              key={question.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
            >
              <div className="flex items-start gap-3">
                {/* Order */}
                <div className="flex items-center gap-2 pt-1">
                  <GripVertical size={16} className="text-slate-300" />
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-medium">
                      {getTypeLabel(question.type)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs">
                      {question.skill}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-medium">
                      {question.xp_reward ?? 5} XP
                    </span>
                    {question.listen_text && (
                      <Volume2 size={14} className="text-blue-500" />
                    )}
                  </div>
                  <p className="text-sm text-slate-900 mb-2">
                    {question.prompt}
                  </p>

                  {/* Options for MCQ */}
                  {question.type === 'mcq' && Array.isArray(question.options) && (
                    <div className="flex flex-wrap gap-2">
                      {(question.options as string[]).map((option: string, i: number) => (
                        <span
                          key={i}
                          className={`px-3 py-1.5 rounded-lg text-xs ${
                            i === question.correct_index
                              ? 'bg-green-100 text-green-700 font-medium'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {i === question.correct_index && (
                            <Check size={12} className="inline mr-1" />
                          )}
                          {option}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Match pairs display */}
                  {question.type === 'match' && (question.options as any)?.pairs && (
                    <div className="flex flex-wrap gap-2">
                      {((question.options as any).pairs as any[]).map((pair: any, i: number) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-lg text-xs bg-green-100 text-green-700 font-medium"
                        >
                          {pair.left} → {pair.right}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Correct answers for other types (not mcq, not match) */}
                  {question.type !== 'mcq' && question.type !== 'match' && question.correct_answers && (
                    <div className="flex flex-wrap gap-2">
                      {(question.type === 'word-order'
                        ? question.correct_answers.flatMap(a =>
                            a.includes(' ') ? a.trim().split(/\s+/) : [a]
                          )
                        : question.correct_answers
                      ).map((answer, i) => (
                        <span
                          key={i}
                          className="px-3 py-1.5 rounded-lg text-xs bg-green-100 text-green-700 font-medium"
                        >
                          <Check size={12} className="inline mr-1" />
                          {answer}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Explanation */}
                  {question.explanation && (
                    <p className="mt-2 text-xs text-slate-500 italic">
                      💡 {question.explanation}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(question)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} className="text-slate-400" />
                  </button>
                  {deleteConfirm === question.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(question.id)}
                        className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                      >
                        <Check size={16} className="text-red-600" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <X size={16} className="text-slate-400" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(question.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingQuestion ? 'Editar Pregunta' : 'Nueva Pregunta'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Type & Skill */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Tipo de Pregunta
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const newType = e.target.value as QuestionType;
                      setFormData({
                        ...formData,
                        type: newType,
                        match_pairs: newType === 'match' && formData.match_pairs.length === 1 && !formData.match_pairs[0].word
                          ? [{ word: '', meaning: '' }, { word: '', meaning: '' }, { word: '', meaning: '' }]
                          : formData.match_pairs,
                      });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Habilidad
                  </label>
                  <select
                    value={formData.skill}
                    onChange={(e) => setFormData({ ...formData, skill: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                  >
                    {SKILLS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Pregunta / Instrucción *
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm resize-none text-slate-900 bg-white"
                  placeholder={
                    formData.type === 'mcq' ? 'Ej: Choose the correct option: She ___ to school every day.' :
                    formData.type === 'fill-in' ? 'Ej: She ___ (go) to school every day. Usa ___ para marcar el espacio.' :
                    formData.type === 'word-order' ? 'Ej: Ordena las palabras para formar la oración correcta.' :
                    'Ej: Empareja cada palabra con su significado.'
                  }
                />
                {formData.type === 'fill-in' && (
                  <p className="mt-1 text-xs text-blue-500">
                    Usa ___ (tres guiones bajos) para marcar donde va el espacio en blanco.
                  </p>
                )}
                {formData.type === 'word-order' && (
                  <p className="mt-1 text-xs text-blue-500">
                    Escribe la instrucción. Las palabras a ordenar van en "Respuestas Correctas" (en orden correcto).
                  </p>
                )}
              </div>

              {/* Options (for MCQ) */}
              {formData.type === 'mcq' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Opciones de Respuesta
                  </label>
                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, correct_index: index })}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            formData.correct_index === index
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-slate-300 hover:border-green-400'
                          }`}
                        >
                          {formData.correct_index === index && <Check size={14} />}
                        </button>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateOption(index, e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                          placeholder={`Opción ${index + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Selecciona el círculo de la opción correcta
                  </p>
                </div>
              )}

              {/* Match Pairs (two-column UX) */}
              {formData.type === 'match' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Pares de Emparejamiento
                  </label>
                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_1fr_32px] gap-2 px-1">
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Palabra / Frase</span>
                      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Significado / Traducción</span>
                      <span />
                    </div>
                    {formData.match_pairs.map((pair, index) => (
                      <div key={index} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
                        <input
                          type="text"
                          value={pair.word}
                          onChange={(e) => updateMatchPair(index, 'word', e.target.value)}
                          className="px-3 py-2 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                          placeholder={['Hello', 'Goodbye', 'Thank you', 'Please'][index] || 'Palabra'}
                        />
                        <input
                          type="text"
                          value={pair.meaning}
                          onChange={(e) => updateMatchPair(index, 'meaning', e.target.value)}
                          className="px-3 py-2 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                          placeholder={['Hola', 'Adiós', 'Gracias', 'Por favor'][index] || 'Significado'}
                        />
                        <button
                          type="button"
                          onClick={() => removeMatchPair(index)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            formData.match_pairs.length <= 1
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                          }`}
                          disabled={formData.match_pairs.length <= 1}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addMatchPair}
                    className="mt-2 text-xs text-slate-600 hover:underline"
                  >
                    + Agregar otro par
                  </button>
                  <p className="mt-1 text-xs text-slate-400">
                    Escribe la palabra en inglés a la izquierda y su significado/traducción a la derecha.
                  </p>
                </div>
              )}

              {/* Correct Answers (for fill-in and word-order) */}
              {formData.type !== 'mcq' && formData.type !== 'match' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {formData.type === 'fill-in' ? 'Respuesta(s) correcta(s) para el espacio' :
                     formData.type === 'word-order' ? 'Palabras en orden correcto' :
                     'Respuestas Correctas'}
                  </label>
                  <div className="space-y-2">
                    {formData.correct_answers.map((answer, index) => (
                      <div key={index} className="flex items-center gap-2">
                        {formData.type === 'word-order' && (
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 text-white text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                        )}
                        <input
                          type="text"
                          value={answer}
                          onChange={(e) => updateCorrectAnswer(index, e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                          placeholder={
                            formData.type === 'fill-in' ? `Ej: ${index === 0 ? 'goes' : 'go'}` :
                            formData.type === 'word-order' ? `Palabra ${index + 1}` :
                            `Respuesta ${index + 1}`
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addCorrectAnswer}
                    className="mt-2 text-xs text-slate-600 hover:underline"
                  >
                    {formData.type === 'fill-in' ? '+ Agregar respuesta alternativa válida' :
                     formData.type === 'word-order' ? '+ Agregar otra palabra' :
                     '+ Agregar otra respuesta válida'}
                  </button>
                  {formData.type === 'fill-in' && (
                    <p className="mt-1 text-xs text-slate-400">
                      Si hay varias respuestas válidas (ej: "goes" y "go"), agrega cada una.
                    </p>
                  )}
                  {formData.type === 'word-order' && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-400 mb-2">
                        Agrega cada palabra por separado, o pega la oración completa abajo y haz clic en "Dividir":
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="word-order-sentence-input"
                          placeholder="Ej: Does she work on mondays?"
                          className="flex-1 px-3 py-2 rounded-xl border border-blue-200 focus:border-blue-400 outline-none text-sm text-slate-900 bg-blue-50"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('word-order-sentence-input') as HTMLInputElement;
                            const sentence = input?.value.trim();
                            if (!sentence) return;
                            const words = sentence.split(/\s+/).filter(w => w);
                            setFormData({ ...formData, correct_answers: words });
                            input.value = '';
                          }}
                          className="px-3 py-2 bg-blue-500 text-white text-xs rounded-xl hover:bg-blue-600 whitespace-nowrap"
                        >
                          Dividir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Palabras distractoras — solo para word-order */}
              {formData.type === 'word-order' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Palabras distractoras <span className="text-slate-400 font-normal">(opcional — aparecen en el banco pero no son parte de la respuesta)</span>
                  </label>
                  <div className="space-y-2">
                    {formData.distractors.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={d}
                          onChange={(e) => {
                            const updated = [...formData.distractors];
                            updated[i] = e.target.value;
                            setFormData({ ...formData, distractors: updated });
                          }}
                          className="flex-1 px-3 py-2 rounded-xl border border-orange-200 focus:border-orange-400 outline-none text-sm text-slate-900 bg-orange-50"
                          placeholder={`Distractor ${i + 1} (ej: is, are, have...)`}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, distractors: formData.distractors.filter((_, idx) => idx !== i) })}
                          className="text-red-400 hover:text-red-600 text-lg leading-none"
                        >×</button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, distractors: [...formData.distractors, ''] })}
                    className="mt-2 text-xs text-orange-600 hover:underline"
                  >
                    + Agregar palabra distractora
                  </button>
                </div>
              )}

              {/* Listen Text — oculto para word-order */}
              {formData.type !== 'word-order' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Texto para Audio (opcional)
                  </label>
                  <textarea
                    value={formData.listen_text}
                    onChange={(e) => setFormData({ ...formData, listen_text: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm resize-none text-slate-900 bg-white"
                    placeholder="Texto que se leerá en voz alta..."
                  />
                </div>
              )}

              {/* XP Reward */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  XP por respuesta correcta
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={formData.xp_reward_text}
                    onChange={(e) => setFormData({ ...formData, xp_reward_text: e.target.value })}
                    onBlur={() => {
                      const val = parseInt(formData.xp_reward_text);
                      if (isNaN(val) || val < 0) {
                        setFormData({ ...formData, xp_reward_text: '5' });
                      } else if (val > 100) {
                        setFormData({ ...formData, xp_reward_text: '100' });
                      }
                    }}
                    min={0}
                    max={100}
                    className="w-24 px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                  />
                  <span className="text-xs text-slate-400">
                    Puntos de experiencia que gana el estudiante al responder correctamente
                  </span>
                </div>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Explicación (opcional)
                </label>
                <textarea
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm resize-none text-slate-900 bg-white"
                  placeholder="Explicación que se mostrará después de responder..."
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingQuestion ? 'Guardar Cambios' : 'Crear Pregunta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
