// src/pages/Admin/DiagnosticQuestionsPage.tsx
import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  Copy
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import {
  getDiagnosticQuestions,
  createDiagnosticQuestion,
  updateDiagnosticQuestion,
  deleteDiagnosticQuestion
} from '../../services/adminService';
import type { DiagnosticQuestion, Level } from '../../types/admin';

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2'];
const EXERCISE_TYPES = [
  { value: 'multiple_choice', label: 'Opción Múltiple' },
  { value: 'fill_blank', label: 'Completar Espacio' },
  { value: 'word_order', label: 'Ordenar Palabras' },
  { value: 'listening', label: 'Escucha' },
  { value: 'speaking', label: 'Hablar' },
  { value: 'reading', label: 'Lectura' },
];

const SKILLS = ['grammar', 'vocabulary', 'reading', 'listening', 'speaking', 'writing'];

type ExerciseType = 'multiple_choice' | 'listening' | 'speaking' | 'fill_blank' | 'word_order' | 'reading';

interface QuestionFormData {
  question: string;
  options: string[];
  correct_answer: string;
  exercise_type: ExerciseType;
  skill: string;
  level: Level;
  audio_text: string;
}

const emptyForm: QuestionFormData = {
  question: '',
  options: ['', '', '', ''],
  correct_answer: '',
  exercise_type: 'multiple_choice',
  skill: 'grammar',
  level: 'A1',
  audio_text: '',
};

export default function DiagnosticQuestionsPage() {
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLevel, setActiveLevel] = useState<Level>('A1');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<DiagnosticQuestion | null>(null);
  const [formData, setFormData] = useState<QuestionFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const data = await getDiagnosticQuestions();
      setQuestions(data);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Detectar duplicados: preguntas con el mismo texto
  const findDuplicates = () => {
    const questionTextMap = new Map<string, DiagnosticQuestion[]>();

    questions.forEach((q) => {
      // Normalizar de forma MUY agresiva para encontrar más duplicados
      const normalizedText = q.question
        .trim()
        .toLowerCase()
        .replace(/[?.!,;:'"(){}[\]]+/g, '') // Quitar TODA la puntuación
        .replace(/\s+/g, ' ') // Normalizar espacios
        .replace(/^(the|a|an|is|are|was|were|do|does|did)\s+/gi, '') // Quitar artículos y verbos auxiliares al inicio
        .trim();

      if (!questionTextMap.has(normalizedText)) {
        questionTextMap.set(normalizedText, []);
      }
      questionTextMap.get(normalizedText)!.push(q);
    });

    // Retornar solo preguntas que tienen duplicados (más de 1 con el mismo texto)
    const duplicates: DiagnosticQuestion[] = [];
    const duplicateGroups: DiagnosticQuestion[][] = [];

    questionTextMap.forEach((questions) => {
      if (questions.length > 1) {
        duplicates.push(...questions);
        duplicateGroups.push(questions);
      }
    });

    console.log('🔍 Análisis de duplicados:', {
      totalPreguntas: questions.length,
      preguntasDuplicadas: duplicates.length,
      gruposDeDuplicados: duplicateGroups.length,
      muestraDeNormalizacion: questions.slice(0, 5).map(q => ({
        original: q.question,
        normalizado: q.question
          .trim()
          .toLowerCase()
          .replace(/[?.!,;:'"(){}[\]]+/g, '')
          .replace(/\s+/g, ' ')
          .replace(/^(the|a|an|is|are|was|were|do|does|did)\s+/gi, '')
          .trim()
      })),
      grupos: duplicateGroups.slice(0, 3).map(g => ({
        texto: g[0].question,
        cantidad: g.length,
        ids: g.map(q => q.id)
      }))
    });

    return { duplicates, duplicateGroups };
  };

  const { duplicates: duplicateQuestions, duplicateGroups } = findDuplicates();
  const duplicateCount = duplicateQuestions.length;

  const filteredQuestions = questions.filter((q) => {
    const matchesLevel = q.level === activeLevel;
    const matchesSearch = search
      ? q.question.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesDuplicateFilter = showDuplicatesOnly
      ? duplicateQuestions.some(dup => dup.id === q.id)
      : true;
    return matchesLevel && matchesSearch && matchesDuplicateFilter;
  });

  const questionsByLevel = LEVELS.reduce((acc, level) => {
    acc[level] = questions.filter((q) => q.level === level).length;
    return acc;
  }, {} as Record<Level, number>);

  const openCreateModal = () => {
    setEditingQuestion(null);
    setFormData({ ...emptyForm, level: activeLevel });
    setShowModal(true);
  };

  const openEditModal = (question: DiagnosticQuestion) => {
    setEditingQuestion(question);
    setFormData({
      question: question.question,
      options: question.options || ['', '', '', ''],
      correct_answer: question.correct_answer,
      exercise_type: question.exercise_type as ExerciseType,
      skill: question.skill,
      level: question.level,
      audio_text: question.audio_text || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.question.trim()) {
      alert('La pregunta es requerida');
      return;
    }
    if (!formData.correct_answer.trim()) {
      alert('La respuesta correcta es requerida');
      return;
    }

    setSaving(true);
    try {
      const questionData = {
        question: formData.question,
        options: formData.options.filter((o) => o.trim()),
        correct_answer: formData.correct_answer,
        exercise_type: formData.exercise_type,
        skill: formData.skill,
        level: formData.level,
        audio_text: formData.audio_text || null,
        image_url: null,
      };

      if (editingQuestion) {
        await updateDiagnosticQuestion(editingQuestion.id, questionData);
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === editingQuestion.id ? { ...q, ...questionData } : q
          )
        );
      } else {
        const newQuestion = await createDiagnosticQuestion(questionData);
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
      await deleteDiagnosticQuestion(id);
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

  const getExerciseTypeLabel = (type: string) => {
    return EXERCISE_TYPES.find((t) => t.value === type)?.label || type;
  };

  return (
    <AdminLayout
      title="Preguntas Diagnósticas"
      subtitle={`Total: ${questions.length} preguntas${duplicateCount > 0 ? ` • ${duplicateCount} duplicadas` : ''}`}
    >
      {/* Duplicate Alert Banner - Always visible when there are duplicates */}
      {duplicateCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl p-5 mb-4 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl">
                <AlertCircle size={28} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-1">
                  ¡Atención! {duplicateGroups.length} Pregunta(s) con Duplicados
                </h3>
                <p className="text-white/90 text-sm">
                  Se encontraron <span className="font-bold text-xl">{duplicateCount}</span> preguntas duplicadas
                  en <span className="font-bold">{duplicateGroups.length}</span> grupo(s).
                  {!showDuplicatesOnly && ' Haz clic en el botón para revisarlas y eliminar las repetidas.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
              className="bg-white text-amber-600 hover:bg-amber-50 px-6 py-3 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap shadow-md"
            >
              {showDuplicatesOnly ? (
                <>
                  <X size={18} />
                  Ver Todas
                </>
              ) : (
                <>
                  <Copy size={18} />
                  Ver Duplicados ({duplicateCount})
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Level Tabs */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100 mb-4 flex gap-2 overflow-x-auto">
        {LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => setActiveLevel(level)}
            className={`flex-1 min-w-[80px] px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              activeLevel === level
                ? 'bg-violet-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {level}
            <span className={`ml-1.5 text-xs ${activeLevel === level ? 'text-violet-200' : 'text-slate-400'}`}>
              ({questionsByLevel[level]})
            </span>
          </button>
        ))}
      </div>

      {/* Search + Add Button */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={showDuplicatesOnly ? "Buscar entre duplicados..." : "Buscar pregunta..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm bg-white"
          />
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
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
        ) : showDuplicatesOnly ? (
          // Vista especial agrupada de duplicados
          duplicateGroups.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center">
              <p className="text-slate-500">No hay preguntas duplicadas</p>
            </div>
          ) : (
            duplicateGroups.map((group, groupIndex) => {
              // Filtrar por nivel y búsqueda
              const filteredGroup = group.filter((q) => {
                const matchesLevel = q.level === activeLevel;
                const matchesSearch = search
                  ? q.question.toLowerCase().includes(search.toLowerCase())
                  : true;
                return matchesLevel && matchesSearch;
              });

              if (filteredGroup.length === 0) return null;

              return (
                <div key={groupIndex} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border-2 border-amber-300 shadow-md">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200">
                    <Copy size={16} className="text-amber-600" />
                    <h3 className="text-sm font-bold text-amber-900">
                      Grupo de Duplicados {groupIndex + 1} - {group.length} copias totales ({filteredGroup.length} en {activeLevel})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {filteredGroup.map((question, qIndex) => (
                      <div
                        key={question.id}
                        className="bg-white rounded-xl p-3 shadow-sm border border-amber-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-amber-600">
                                Copia #{qIndex + 1}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-xs">
                                {question.level}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs">
                                {getExerciseTypeLabel(question.exercise_type)}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs">
                                {question.skill}
                              </span>
                            </div>
                            <p className="text-sm text-slate-900 font-medium mb-2">
                              {question.question}
                            </p>
                            {question.options && question.options.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {question.options.map((option, i) => (
                                  <span
                                    key={i}
                                    className={`px-2 py-1 rounded-md text-xs ${
                                      option === question.correct_answer
                                        ? 'bg-green-100 text-green-700 font-medium'
                                        : 'bg-slate-50 text-slate-600'
                                    }`}
                                  >
                                    {option === question.correct_answer && (
                                      <Check size={10} className="inline mr-1" />
                                    )}
                                    {option}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(question)}
                              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Edit2 size={14} className="text-slate-400" />
                            </button>
                            {deleteConfirm === question.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(question.id)}
                                  className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                                >
                                  <Check size={14} className="text-red-600" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                  <X size={14} className="text-slate-400" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(question.id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={14} className="text-slate-400 hover:text-red-500" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )
        ) : filteredQuestions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <p className="text-slate-500">No hay preguntas en este nivel</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-violet-600 text-sm font-medium hover:underline"
            >
              Crear primera pregunta
            </button>
          </div>
        ) : (
          // Vista normal de preguntas
          filteredQuestions.map((question, index) => {
            const isDuplicate = duplicateQuestions.some(dup => dup.id === question.id);
            return (
              <div
                key={question.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border ${
                  isDuplicate ? 'border-amber-300 bg-amber-50/30' : 'border-slate-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-slate-400">#{index + 1}</span>
                      {isDuplicate && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-medium flex items-center gap-1">
                          <Copy size={12} />
                          Duplicado
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 text-xs font-medium">
                        {getExerciseTypeLabel(question.exercise_type)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs">
                        {question.skill}
                      </span>
                    </div>
                  <p className="text-sm text-slate-900 font-medium mb-2">
                    {question.question}
                  </p>
                  {question.options && question.options.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {question.options.map((option, i) => (
                        <span
                          key={i}
                          className={`px-3 py-1.5 rounded-lg text-xs ${
                            option === question.correct_answer
                              ? 'bg-green-100 text-green-700 font-medium'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {option === question.correct_answer && (
                            <Check size={12} className="inline mr-1" />
                          )}
                          {option}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
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
            );
          })
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
              {/* Level & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Nivel
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value as Level })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm text-slate-900 bg-white"
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Tipo de Ejercicio
                  </label>
                  <select
                    value={formData.exercise_type}
                    onChange={(e) => setFormData({ ...formData, exercise_type: e.target.value as ExerciseType })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm text-slate-900 bg-white"
                  >
                    {EXERCISE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Skill */}
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

              {/* Question */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Pregunta *
                </label>
                <textarea
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm resize-none text-slate-900 bg-white"
                  placeholder="Escribe la pregunta..."
                />
              </div>

              {/* Options */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Opciones de Respuesta
                </label>
                <div className="space-y-2">
                  {formData.options.map((option, index) => (
                    <input
                      key={index}
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm text-slate-900 bg-white"
                      placeholder={`Opción ${index + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Correct Answer */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Respuesta Correcta *
                </label>
                <input
                  type="text"
                  value={formData.correct_answer}
                  onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm text-slate-900 bg-white"
                  placeholder="Escribe la respuesta correcta"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Debe coincidir exactamente con una de las opciones
                </p>
              </div>

              {/* Audio Text (for listening) */}
              {(formData.exercise_type === 'listening' || formData.exercise_type === 'speaking') && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Texto para Audio
                  </label>
                  <textarea
                    value={formData.audio_text}
                    onChange={(e) => setFormData({ ...formData, audio_text: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm resize-none text-slate-900 bg-white"
                    placeholder="Texto que se convertirá en audio..."
                  />
                </div>
              )}
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
