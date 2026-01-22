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

interface QuestionFormData {
  type: QuestionType;
  skill: string;
  prompt: string;
  options: string[];
  correct_index: number | null;
  correct_answers: string[];
  explanation: string;
  listen_text: string;
}

const emptyForm: QuestionFormData = {
  type: 'mcq',
  skill: 'grammar',
  prompt: '',
  options: ['', '', '', ''],
  correct_index: 0,
  correct_answers: [''],
  explanation: '',
  listen_text: '',
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

  const openEditModal = (question: LessonQuestion) => {
    setEditingQuestion(question);
    setFormData({
      type: question.type as QuestionType,
      skill: question.skill,
      prompt: question.prompt,
      options: question.options || ['', '', '', ''],
      correct_index: question.correct_index,
      correct_answers: question.correct_answers || [''],
      explanation: question.explanation || '',
      listen_text: question.listen_text || '',
    });
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

      const questionData: Omit<LessonQuestion, 'id'> = {
        lesson_id: lessonId,
        type: formData.type,
        skill: formData.skill as any,
        prompt: formData.prompt,
        options: formData.type === 'mcq' ? formData.options.filter((o) => o.trim()) : null,
        correct_index: formData.type === 'mcq' ? formData.correct_index : null,
        correct_answers: formData.type !== 'mcq' ? formData.correct_answers.filter((a) => a.trim()) : null,
        explanation: formData.explanation || null,
        order_index: editingQuestion ? editingQuestion.order_index : maxOrder + 1,
        listen_text: formData.listen_text || null,
        audio_bucket: null,
        audio_path: null,
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
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600"
        >
          <ArrowLeft size={18} />
          <span>Volver a Lecciones</span>
        </Link>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={18} />
          <span>Nueva Pregunta</span>
        </button>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          </div>
        ) : sortedQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <HelpCircle size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No hay preguntas en esta lección</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-violet-600 text-sm font-medium hover:underline"
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
                    <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-xs font-medium">
                      {getTypeLabel(question.type)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs">
                      {question.skill}
                    </span>
                    {question.listen_text && (
                      <Volume2 size={14} className="text-blue-500" />
                    )}
                  </div>
                  <p className="text-sm text-slate-900 mb-2">
                    {question.prompt}
                  </p>

                  {/* Options for MCQ */}
                  {question.type === 'mcq' && question.options && (
                    <div className="flex flex-wrap gap-2">
                      {question.options.map((option, i) => (
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

                  {/* Correct answers for other types */}
                  {question.type !== 'mcq' && question.correct_answers && (
                    <div className="flex flex-wrap gap-2">
                      {question.correct_answers.map((answer, i) => (
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
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as QuestionType })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm text-slate-900 bg-white"
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
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm text-slate-900 bg-white"
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
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm resize-none"
                  placeholder="Ej: Choose the correct option: She ___ to school every day."
                />
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
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm"
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

              {/* Correct Answers (for other types) */}
              {formData.type !== 'mcq' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Respuestas Correctas
                  </label>
                  <div className="space-y-2">
                    {formData.correct_answers.map((answer, index) => (
                      <input
                        key={index}
                        type="text"
                        value={answer}
                        onChange={(e) => updateCorrectAnswer(index, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm"
                        placeholder={`Respuesta ${index + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addCorrectAnswer}
                    className="mt-2 text-xs text-violet-600 hover:underline"
                  >
                    + Agregar otra respuesta válida
                  </button>
                </div>
              )}

              {/* Listen Text */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Texto para Audio (opcional)
                </label>
                <textarea
                  value={formData.listen_text}
                  onChange={(e) => setFormData({ ...formData, listen_text: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm resize-none"
                  placeholder="Texto que se leerá en voz alta..."
                />
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
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm resize-none"
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
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
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
