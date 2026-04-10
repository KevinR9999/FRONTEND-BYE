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
  Copy,
  Volume2,
  Mic,
  BookOpen,
  Type,
  ArrowRightLeft,
  HelpCircle
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

// Habilidad por defecto según tipo de ejercicio
const getDefaultSkill = (type: ExerciseType): string => {
  switch (type) {
    case 'listening': return 'listening';
    case 'speaking': return 'speaking';
    case 'reading': return 'reading';
    default: return 'grammar';
  }
};

// Tipos que necesitan opciones (radio buttons)
const typesWithOptions = ['multiple_choice', 'listening', 'reading'];

// Descripciones de ayuda por tipo
const typeDescriptions: Record<ExerciseType, string> = {
  multiple_choice: 'El estudiante ve la pregunta y selecciona una de las opciones.',
  fill_blank: 'El estudiante completa el espacio en blanco (___) con la respuesta correcta.',
  word_order: 'El estudiante ordena las palabras desordenadas para formar la oración correcta.',
  listening: 'El estudiante escucha un audio (generado del texto) y selecciona la respuesta.',
  speaking: 'El estudiante escucha un audio y debe repetir/pronunciar la frase correctamente.',
  reading: 'El estudiante lee un texto y responde la pregunta sobre el contenido.',
};

// Iconos por tipo
const typeIcons: Record<ExerciseType, React.ReactNode> = {
  multiple_choice: <HelpCircle size={14} />,
  fill_blank: <Type size={14} />,
  word_order: <ArrowRightLeft size={14} />,
  listening: <Volume2 size={14} />,
  speaking: <Mic size={14} />,
  reading: <BookOpen size={14} />,
};

interface QuestionFormData {
  question: string;
  options: string[];
  correct_answer: string;
  exercise_type: ExerciseType;
  skill: string;
  level: Level;
  audio_text: string;
  word_order_words: string[]; // palabras en orden correcto (una por una)
  word_order_distractors: string[]; // palabras distractoras
}

const emptyForm: QuestionFormData = {
  question: '',
  options: ['', '', '', ''],
  correct_answer: '',
  exercise_type: 'multiple_choice',
  skill: 'grammar',
  level: 'A1',
  audio_text: '',
  word_order_words: [''],
  word_order_distractors: [''],
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

  // Detectar duplicados: preguntas con el mismo texto Y misma respuesta correcta
  const findDuplicates = () => {
    const questionTextMap = new Map<string, DiagnosticQuestion[]>();

    questions.forEach((q) => {
      // Normalizar el texto de la pregunta
      const normalizedText = q.question
        .trim()
        .toLowerCase()
        .replace(/[?.!,;:'"(){}[\]]+/g, '') // Quitar TODA la puntuación
        .replace(/\s+/g, ' ') // Normalizar espacios
        .replace(/^(the|a|an|is|are|was|were|do|does|did)\s+/gi, '') // Quitar artículos y verbos auxiliares al inicio
        .trim();

      // Para word_order, incluir la respuesta correcta en la clave
      // ya que todas comparten el enunciado genérico pero tienen respuestas diferentes
      const normalizedAnswer = q.correct_answer?.trim().toLowerCase() || '';
      const key = q.exercise_type === 'word_order'
        ? `${normalizedText}||${normalizedAnswer}`
        : normalizedText;

      if (!questionTextMap.has(key)) {
        questionTextMap.set(key, []);
      }
      questionTextMap.get(key)!.push(q);
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
      grupos: duplicateGroups.map(g => ({
        texto: g[0].question,
        respuesta: g[0].correct_answer,
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
    // Para speaking: audio_text puede ser la frase a repetir o correct_answer
    const audioText = question.exercise_type === 'speaking'
      ? (question.audio_text || question.correct_answer || '')
      : (question.audio_text || '');
    // Para word_order: extraer palabras correctas y distractores
    let words: string[] = [''];
    let distractors: string[] = [''];
    if (question.exercise_type === 'word_order' && question.correct_answer) {
      words = question.correct_answer.trim().split(/\s+/);
      const correctWordsLower = words.map(w => w.toLowerCase());
      if (question.options && question.options.length > 0) {
        const remaining = [...correctWordsLower];
        const extraWords: string[] = [];
        for (const word of question.options) {
          const idx = remaining.indexOf(word.toLowerCase());
          if (idx !== -1) {
            remaining.splice(idx, 1);
          } else {
            extraWords.push(word);
          }
        }
        distractors = extraWords.length > 0 ? extraWords : [''];
      }
    }
    setFormData({
      question: question.question,
      options: question.options && question.options.length > 0 ? question.options : ['', '', '', ''],
      correct_answer: question.correct_answer,
      exercise_type: question.exercise_type as ExerciseType,
      skill: question.skill,
      level: question.level,
      audio_text: audioText,
      word_order_words: words,
      word_order_distractors: distractors,
    });
    setShowModal(true);
  };

  const updateWord = (index: number, value: string) => {
    const newW = [...formData.word_order_words];
    newW[index] = value;
    setFormData({ ...formData, word_order_words: newW });
  };

  const addWord = () => {
    setFormData({ ...formData, word_order_words: [...formData.word_order_words, ''] });
  };

  const removeWord = (index: number) => {
    if (formData.word_order_words.length <= 1) return;
    setFormData({ ...formData, word_order_words: formData.word_order_words.filter((_, i) => i !== index) });
  };

  const updateDistractor = (index: number, value: string) => {
    const newD = [...formData.word_order_distractors];
    newD[index] = value;
    setFormData({ ...formData, word_order_distractors: newD });
  };

  const addDistractor = () => {
    setFormData({ ...formData, word_order_distractors: [...formData.word_order_distractors, ''] });
  };

  const removeDistractor = (index: number) => {
    setFormData({ ...formData, word_order_distractors: formData.word_order_distractors.filter((_, i) => i !== index) });
  };

  const handleSave = async () => {
    const type = formData.exercise_type;
    const needsOptions = typesWithOptions.includes(type);

    // Validaciones por tipo
    if (type === 'speaking') {
      if (!formData.audio_text.trim()) {
        alert('La frase a repetir es requerida');
        return;
      }
      // Para speaking: question es opcional (tiene default), pero audio_text = correct_answer
    } else if (type === 'word_order') {
      if (!formData.question.trim()) {
        alert('El enunciado es requerido');
        return;
      }
      if (formData.word_order_words.filter(w => w.trim()).length < 2) {
        alert('Se necesitan al menos 2 palabras en orden correcto');
        return;
      }
    } else {
      if (!formData.question.trim()) {
        alert('La pregunta es requerida');
        return;
      }
    }

    // Construir correct_answer según tipo
    let finalCorrectAnswer: string;
    if (type === 'word_order') {
      finalCorrectAnswer = formData.word_order_words.filter(w => w.trim()).join(' ');
    } else if (type === 'speaking') {
      finalCorrectAnswer = formData.audio_text.trim();
    } else {
      finalCorrectAnswer = formData.correct_answer;
    }

    if (!finalCorrectAnswer.trim()) {
      alert('La respuesta correcta es requerida');
      return;
    }

    if (needsOptions && formData.options.filter(o => o.trim()).length < 2) {
      alert('Se necesitan al menos 2 opciones de respuesta');
      return;
    }
    if (needsOptions && !formData.options.some(o => o.trim() === formData.correct_answer.trim())) {
      alert('La respuesta correcta debe coincidir con una de las opciones');
      return;
    }

    setSaving(true);
    try {
      // Construir opciones según tipo
      let finalOptions: string[];
      if (type === 'word_order') {
        // options = palabras correctas + distractores
        const correctWords = formData.word_order_words.filter(w => w.trim());
        const distractorWords = formData.word_order_distractors.filter(w => w.trim());
        finalOptions = [...correctWords, ...distractorWords];
      } else if (needsOptions) {
        finalOptions = formData.options.filter((o) => o.trim());
      } else {
        finalOptions = [];
      }

      // Para speaking: question tiene default si está vacío
      const finalQuestion = type === 'speaking' && !formData.question.trim()
        ? 'Repeat this sentence out loud'
        : formData.question;

      // Calcular order_index para nuevas preguntas
      const maxOrder = questions.length > 0
        ? Math.max(...questions.map(q => (q as any).order_index || 0))
        : 0;

      const questionData = {
        question: finalQuestion,
        options: finalOptions,
        correct_answer: finalCorrectAnswer,
        exercise_type: formData.exercise_type,
        skill: formData.skill,
        level: formData.level,
        audio_text: (type === 'speaking' || type === 'listening') ? (formData.audio_text || null) : null,
        audio_url: null,
        image_url: null,
        time_limit: null,
        ...(editingQuestion ? {} : { order_index: maxOrder + 1 }),
      };

      if (editingQuestion) {
        await updateDiagnosticQuestion(editingQuestion.id, questionData);
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === editingQuestion.id ? { ...q, ...questionData } : q
          )
        );
      } else {
        const newQuestion = await createDiagnosticQuestion(questionData as any);
        setQuestions((prev) => [...prev, newQuestion]);
      }
      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving question:', error);
      const msg = error?.message || error?.details || JSON.stringify(error);
      alert(`Error al guardar: ${msg}`);
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
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {level}
            <span className={`ml-1.5 text-xs ${activeLevel === level ? 'text-slate-300' : 'text-slate-400'}`}>
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
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm bg-white"
          />
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors"
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
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs">
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
              className="mt-4 text-slate-600 text-sm font-medium hover:underline"
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
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-medium flex items-center gap-1">
                        {typeIcons[question.exercise_type as ExerciseType]}
                        {getExerciseTypeLabel(question.exercise_type)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs">
                        {question.skill}
                      </span>
                    </div>
                  <p className="text-sm text-slate-900 font-medium mb-2">
                    {question.question}
                  </p>
                  {question.options && question.options.length > 0 && typesWithOptions.includes(question.exercise_type) && (
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
                  {/* Para tipos sin opciones: mostrar respuesta correcta */}
                  {!typesWithOptions.includes(question.exercise_type) && question.correct_answer && (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded-lg text-xs bg-green-100 text-green-700 font-medium">
                        <Check size={12} className="inline mr-1" />
                        {question.correct_answer}
                      </span>
                      {question.audio_text && (
                        <span className="px-2 py-1 rounded-lg text-xs bg-blue-50 text-blue-600 flex items-center gap-1">
                          <Volume2 size={12} />
                          Audio: {question.audio_text.substring(0, 40)}{question.audio_text.length > 40 ? '...' : ''}
                        </span>
                      )}
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
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
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
                    onChange={(e) => {
                      const newType = e.target.value as ExerciseType;
                      setFormData({
                        ...formData,
                        exercise_type: newType,
                        skill: getDefaultSkill(newType),
                        options: typesWithOptions.includes(newType) ? formData.options : ['', '', '', ''],
                        correct_answer: '',
                        audio_text: '',
                        word_order_words: [''],
                        word_order_distractors: [''],
                      });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                  >
                    {EXERCISE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descripción del tipo seleccionado */}
              <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <span className="text-slate-500 mt-0.5">{typeIcons[formData.exercise_type]}</span>
                <p className="text-xs text-slate-500">{typeDescriptions[formData.exercise_type]}</p>
              </div>

              {/* Skill (auto-sugerida) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Habilidad que se evalúa
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
                <p className="mt-1 text-xs text-slate-400">
                  Se auto-sugiere según el tipo. Puedes cambiarla si es necesario.
                </p>
              </div>

              {/* ══════════════════════════════════════════════════════════ */}
              {/* ═══  FORMULARIO ESPECÍFICO POR TIPO DE EJERCICIO  ═══════ */}
              {/* ══════════════════════════════════════════════════════════ */}

              {/* ═══ MULTIPLE CHOICE ═══ */}
              {formData.exercise_type === 'multiple_choice' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Pregunta *</label>
                    <textarea
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm resize-none text-slate-900 bg-white"
                      placeholder='Ej: What is the past tense of "go"?'
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Si incluyes ___ se mostrará como espacio en blanco visual.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Opciones (selecciona la correcta)
                    </label>
                    <div className="space-y-2">
                      {formData.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { if (option.trim()) setFormData({ ...formData, correct_answer: option }); }}
                            className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              option.trim() && formData.correct_answer === option
                                ? 'border-green-500 bg-green-500' : 'border-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {option.trim() && formData.correct_answer === option && <Check size={14} className="text-white" />}
                          </button>
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => {
                              const newOpts = [...formData.options];
                              const old = newOpts[index];
                              newOpts[index] = e.target.value;
                              setFormData({ ...formData, options: newOpts, correct_answer: formData.correct_answer === old ? e.target.value : formData.correct_answer });
                            }}
                            className={`flex-1 px-3 py-2.5 rounded-xl border outline-none text-sm text-slate-900 bg-white ${
                              option.trim() && formData.correct_answer === option
                                ? 'border-green-300 bg-green-50/50 focus:border-green-500 focus:ring-2 focus:ring-green-500/20'
                                : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
                            }`}
                            placeholder={`Opción ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">Haz clic en el círculo para marcar la correcta.</p>
                  </div>
                  {/* Preview MCQ */}
                  {formData.question.trim() && formData.options.some(o => o.trim()) && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vista previa del estudiante</p>
                      {formData.question.includes('___') ? (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                          <p className="text-[10px] text-purple-600 font-medium mb-1 text-center">Selecciona la opción correcta:</p>
                          <p className="text-sm font-bold text-slate-800 text-center">
                            {formData.question.split('___').map((part, idx, arr) => (
                              <span key={idx}>
                                {part}
                                {idx < arr.length - 1 && <span className="inline-block mx-1 px-3 py-0.5 border border-dashed border-purple-400 rounded text-purple-400 text-xs">___</span>}
                              </span>
                            ))}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-slate-800 text-center mb-3">{formData.question}</p>
                      )}
                      <div className="space-y-1.5">
                        {formData.options.filter(o => o.trim()).map((opt, i) => (
                          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                            opt === formData.correct_answer ? 'border-indigo-300 bg-indigo-50 font-medium' : 'border-slate-200 bg-white'
                          }`}>
                            <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                              opt === formData.correct_answer ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                            }`}>
                              {opt === formData.correct_answer && <div className="w-full h-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
                            </div>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ FILL BLANK ═══ */}
              {formData.exercise_type === 'fill_blank' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Oración con espacio en blanco *</label>
                    <textarea
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm resize-none text-slate-900 bg-white"
                      placeholder="Ej: She ___ to school every day."
                    />
                    <p className="mt-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                      Usa ___ (tres guiones bajos) donde va la respuesta.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Respuesta correcta *</label>
                    <input
                      type="text"
                      value={formData.correct_answer}
                      onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                      placeholder="Ej: goes"
                    />
                    <p className="mt-1 text-xs text-slate-400">La palabra que completa el espacio en blanco.</p>
                  </div>
                  {/* Preview Fill Blank */}
                  {formData.question.includes('___') && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vista previa del estudiante</p>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-3">
                        <p className="text-[10px] text-purple-600 font-medium mb-2 text-center">Complete the sentence:</p>
                        <p className="text-sm font-bold text-slate-800 text-center">
                          {formData.question.split('___').map((part, idx, arr) => (
                            <span key={idx}>
                              {part}
                              {idx < arr.length - 1 && <span className="inline-block mx-1 px-4 py-0.5 border-2 border-dashed border-purple-400 rounded text-purple-400 text-xs">___</span>}
                            </span>
                          ))}
                        </p>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-slate-500 mb-1">Write the correct word:</p>
                        <div className="border-2 border-indigo-200 rounded-lg px-4 py-2 bg-indigo-50/30">
                          <span className="text-sm text-indigo-400 italic">{formData.correct_answer || 'Type here...'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ WORD ORDER ═══ */}
              {formData.exercise_type === 'word_order' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Enunciado / Instrucción *</label>
                    <input
                      type="text"
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                      placeholder="Ej: Order these words to form a sentence"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Check size={14} className="text-green-500" />
                      Palabras en orden correcto *
                    </label>
                    <p className="text-xs text-slate-400 mb-2">
                      Agrega cada palabra en el orden correcto de la oración. El estudiante las verá desordenadas.
                    </p>
                    <div className="space-y-2">
                      {formData.word_order_words.map((word, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px] font-bold">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={word}
                            onChange={(e) => updateWord(index, e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl border border-green-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none text-sm text-slate-900 bg-green-50/30"
                            placeholder={`Palabra ${index + 1} (ej: ${['She', 'has', 'worked', 'as', 'a', 'teacher'][index] || '...'})`}
                          />
                          {formData.word_order_words.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeWord(index)}
                              className="shrink-0 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X size={16} className="text-red-400 hover:text-red-600" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addWord}
                      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      <Plus size={14} />
                      Agregar palabra
                    </button>
                    {formData.word_order_words.filter(w => w.trim()).length >= 2 && (
                      <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                        <p className="text-[11px] text-green-700 font-medium">
                          Oración: <span className="font-bold">{formData.word_order_words.filter(w => w.trim()).join(' ')}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <ArrowRightLeft size={14} className="text-amber-500" />
                      Palabras distractoras (opcional)
                    </label>
                    <p className="text-xs text-slate-400 mb-2">
                      Agrega palabras extra que confundan al estudiante. Aparecerán mezcladas con las correctas.
                    </p>
                    <div className="space-y-2">
                      {formData.word_order_distractors.map((word, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold">
                            D{index + 1}
                          </span>
                          <input
                            type="text"
                            value={word}
                            onChange={(e) => updateDistractor(index, e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl border border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none text-sm text-slate-900 bg-amber-50/30"
                            placeholder={`Distractor ${index + 1} (ej: ${['He', 'have', 'work', 'the', 'doctor'][index] || '...'})`}
                          />
                          {(
                            <button
                              type="button"
                              onClick={() => removeDistractor(index)}
                              className="shrink-0 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X size={16} className="text-red-400 hover:text-red-600" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addDistractor}
                      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      <Plus size={14} />
                      Agregar distractor
                    </button>
                  </div>
                  {/* Preview Word Order */}
                  {formData.word_order_words.filter(w => w.trim()).length >= 2 && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vista previa del estudiante</p>
                      <p className="text-sm font-bold text-slate-800 text-center mb-2">{formData.question || 'Order these words to form a sentence'}</p>
                      <p className="text-[10px] text-indigo-500 text-center mb-3">Tap words to build the sentence</p>
                      <div className="bg-white rounded-lg p-3 border border-slate-200 mb-2">
                        <div className="flex flex-wrap gap-1.5 justify-center">
                          {(() => {
                            const correctWords = formData.word_order_words.filter(w => w.trim());
                            const distractors = formData.word_order_distractors.filter(w => w.trim());
                            const allWords = [...correctWords, ...distractors];
                            // Mezclar para la vista previa
                            const shuffled = [...allWords].sort(() => Math.random() - 0.5);
                            return shuffled.map((word, i) => {
                              const isDistractor = distractors.includes(word) && !correctWords.includes(word);
                              return (
                                <span key={i} className={`px-3 py-1.5 rounded-lg text-xs font-medium border shadow-sm ${
                                  isDistractor ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-slate-50 text-slate-700 border-slate-300'
                                }`}>
                                  {word}
                                </span>
                              );
                            });
                          })()}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border-2 border-dashed border-slate-200 min-h-[40px] flex items-center justify-center">
                        <span className="text-[10px] text-slate-400">Tap words above to build your answer</span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                          <p className="text-[10px] text-green-600 font-medium">Correcta: <span className="font-bold">{formData.word_order_words.filter(w => w.trim()).join(' ')}</span></p>
                        </div>
                        {formData.word_order_distractors.some(w => w.trim()) && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                            <p className="text-[10px] text-amber-600 font-medium">
                              {formData.word_order_distractors.filter(w => w.trim()).length} distractor{formData.word_order_distractors.filter(w => w.trim()).length !== 1 ? 'es' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        Total: {formData.word_order_words.filter(w => w.trim()).length + formData.word_order_distractors.filter(w => w.trim()).length} palabras
                        {' '}({formData.word_order_words.filter(w => w.trim()).length} correctas
                        {formData.word_order_distractors.some(w => w.trim()) ? ` + ${formData.word_order_distractors.filter(w => w.trim()).length} distractoras` : ''})
                        {' '} — <span className="text-amber-600">naranja</span> = distractoras
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ═══ LISTENING ═══ */}
              {formData.exercise_type === 'listening' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Pregunta *</label>
                    <input
                      type="text"
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                      placeholder="Ej: What did you hear?"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Volume2 size={14} className="text-blue-500" />
                      Texto de audio (opcional)
                    </label>
                    <textarea
                      value={formData.audio_text}
                      onChange={(e) => setFormData({ ...formData, audio_text: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm resize-none text-slate-900 bg-blue-50/30"
                      placeholder="Ej: She finished her homework yesterday"
                    />
                    <p className="mt-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                      Nota: El audio siempre reproduce la respuesta correcta. Este campo es solo para referencia del administrador.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Opciones (selecciona la correcta)
                    </label>
                    <div className="space-y-2">
                      {formData.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { if (option.trim()) setFormData({ ...formData, correct_answer: option }); }}
                            className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              option.trim() && formData.correct_answer === option
                                ? 'border-green-500 bg-green-500' : 'border-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {option.trim() && formData.correct_answer === option && <Check size={14} className="text-white" />}
                          </button>
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => {
                              const newOpts = [...formData.options];
                              const old = newOpts[index];
                              newOpts[index] = e.target.value;
                              setFormData({ ...formData, options: newOpts, correct_answer: formData.correct_answer === old ? e.target.value : formData.correct_answer });
                            }}
                            className={`flex-1 px-3 py-2.5 rounded-xl border outline-none text-sm text-slate-900 bg-white ${
                              option.trim() && formData.correct_answer === option
                                ? 'border-green-300 bg-green-50/50 focus:border-green-500 focus:ring-2 focus:ring-green-500/20'
                                : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
                            }`}
                            placeholder={`Opción ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">Haz clic en el círculo para marcar la correcta.</p>
                  </div>
                  {/* Preview Listening */}
                  {formData.options.some(o => o.trim()) && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vista previa del estudiante</p>
                      <p className="text-sm font-bold text-slate-800 text-center mb-3">{formData.question || 'What did you hear?'}</p>
                      <div className="bg-white rounded-lg p-3 border border-slate-200 mb-3 text-center">
                        <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-medium">
                          <Volume2 size={14} />
                          Play audio
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Audio: "{formData.audio_text || formData.correct_answer || '...'}"
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {formData.options.filter(o => o.trim()).map((opt, i) => (
                          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                            opt === formData.correct_answer ? 'border-indigo-300 bg-indigo-50 font-medium' : 'border-slate-200 bg-white'
                          }`}>
                            <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                              opt === formData.correct_answer ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                            }`}>
                              {opt === formData.correct_answer && <div className="w-full h-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
                            </div>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ SPEAKING ═══ */}
              {formData.exercise_type === 'speaking' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Mic size={14} className="text-purple-500" />
                      Frase que el estudiante debe repetir *
                    </label>
                    <textarea
                      value={formData.audio_text}
                      onChange={(e) => setFormData({ ...formData, audio_text: e.target.value, correct_answer: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-sm resize-none text-slate-900 bg-purple-50/30"
                      placeholder="Ej: I have known him since last year"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Esta frase se reproducirá como audio y el estudiante debe repetirla en voz alta.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Instrucción (opcional)</label>
                    <input
                      type="text"
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                      placeholder="Ej: Repeat this sentence out loud"
                    />
                    <p className="mt-1 text-xs text-slate-400">Si lo dejas vacío se usa la instrucción por defecto.</p>
                  </div>
                  {/* Preview Speaking */}
                  {formData.audio_text.trim() && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vista previa del estudiante</p>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3 text-center">
                        <p className="text-[10px] text-purple-600 font-medium mb-1">Repeat this sentence out loud:</p>
                        <p className="text-base font-bold text-slate-800">"{formData.audio_text}"</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                        <p className="text-[10px] text-slate-500 mb-2">Press the button and speak clearly</p>
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-slate-600 to-slate-800 text-white px-4 py-2 rounded-lg text-xs font-medium">
                          <Mic size={14} />
                          Press to record
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══ READING ═══ */}
              {formData.exercise_type === 'reading' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <BookOpen size={14} className="text-blue-500" />
                      Texto de lectura + Pregunta *
                    </label>
                    <textarea
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm resize-none text-slate-900 bg-white"
                      placeholder='Ej: Read: "The boy went to the park and played with his friends." What did the boy do?'
                    />
                    <p className="mt-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                      Formato: Read: "texto" Pregunta. El texto de lectura se resaltará para el estudiante.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Opciones (selecciona la correcta)
                    </label>
                    <div className="space-y-2">
                      {formData.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { if (option.trim()) setFormData({ ...formData, correct_answer: option }); }}
                            className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              option.trim() && formData.correct_answer === option
                                ? 'border-green-500 bg-green-500' : 'border-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {option.trim() && formData.correct_answer === option && <Check size={14} className="text-white" />}
                          </button>
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => {
                              const newOpts = [...formData.options];
                              const old = newOpts[index];
                              newOpts[index] = e.target.value;
                              setFormData({ ...formData, options: newOpts, correct_answer: formData.correct_answer === old ? e.target.value : formData.correct_answer });
                            }}
                            className={`flex-1 px-3 py-2.5 rounded-xl border outline-none text-sm text-slate-900 bg-white ${
                              option.trim() && formData.correct_answer === option
                                ? 'border-green-300 bg-green-50/50 focus:border-green-500 focus:ring-2 focus:ring-green-500/20'
                                : 'border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20'
                            }`}
                            placeholder={`Opción ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">Haz clic en el círculo para marcar la correcta.</p>
                  </div>
                  {/* Preview Reading */}
                  {formData.question.trim() && formData.options.some(o => o.trim()) && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vista previa del estudiante</p>
                      {formData.question.startsWith('Read:') ? (
                        <>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                            <p className="text-[10px] text-blue-600 font-medium mb-1 flex items-center gap-1"><BookOpen size={10} /> Lee el siguiente texto:</p>
                            <p className="text-xs text-slate-700">{formData.question.replace(/^Read:\s*"/, '').replace(/"[^"]*$/, '')}</p>
                          </div>
                          <p className="text-sm font-bold text-slate-800 text-center mb-2">
                            {formData.question.match(/"([^"]*)"$/)?.[1] || ''}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-bold text-slate-800 text-center mb-3">{formData.question}</p>
                      )}
                      <div className="space-y-1.5">
                        {formData.options.filter(o => o.trim()).map((opt, i) => (
                          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                            opt === formData.correct_answer ? 'border-indigo-300 bg-indigo-50 font-medium' : 'border-slate-200 bg-white'
                          }`}>
                            <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                              opt === formData.correct_answer ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                            }`}>
                              {opt === formData.correct_answer && <div className="w-full h-full flex items-center justify-center"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
                            </div>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
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
