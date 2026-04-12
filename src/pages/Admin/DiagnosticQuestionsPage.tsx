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
  HelpCircle,
  BarChart2
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import {
  getDiagnosticQuestions,
  createDiagnosticQuestion,
  updateDiagnosticQuestion,
  deleteDiagnosticQuestion
} from '../../services/adminService';
import type { DiagnosticQuestion, Level } from '../../types/admin';

interface DiagnosticResult {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  correct_answers: number;
  level: string;
  created_at: string;
}

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
  reading_passage: string; // texto de lectura (solo para tipo reading)
  reading_question: string; // pregunta sobre el texto (solo para tipo reading)
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
  reading_passage: '',
  reading_question: '',
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
  const [activeTab, setActiveTab] = useState<'questions' | 'results'>('questions');
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    if (activeTab === 'results') loadDiagnosticResults();
  }, [activeTab]);

  const loadDiagnosticResults = async () => {
    setLoadingResults(true);
    try {
      const { data, error } = await supabase
        .from('diagnostic_results')
        .select('id, user_id, user_name, user_email, correct_answers, level, created_at')
        .order('created_at', { ascending: false });
      if (!error && data) setDiagnosticResults(data);
    } catch (e) {
      console.error('Error loading diagnostic results:', e);
    } finally {
      setLoadingResults(false);
    }
  };

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
    // Para word_order: extraer palabras correctas
    let words: string[] = [''];
    if (question.exercise_type === 'word_order' && question.correct_answer) {
      words = question.correct_answer.trim().split(/\s+/);
    }
    // Para cualquier tipo: separar el pasaje de la pregunta si usa formato Read:
    let readingPassage = '';
    let readingQuestion = '';
    if (question.question.startsWith('Read:')) {
      const match = question.question.match(/^Read:\s*"([^"]*)"\s*([\s\S]*)$/);
      if (match) {
        readingPassage = match[1];
        readingQuestion = match[2].trim();
      } else {
        readingQuestion = question.question;
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
      reading_passage: readingPassage,
      reading_question: readingQuestion,
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
      const hasPassageWO = formData.reading_passage.trim();
      const effectiveQuestionWO = hasPassageWO ? formData.reading_question : formData.question;
      if (!effectiveQuestionWO.trim()) {
        alert('El enunciado es requerido');
        return;
      }
      if (formData.word_order_words.filter(w => w.trim()).length < 2) {
        alert('Se necesitan al menos 2 palabras en orden correcto');
        return;
      }
    } else if (type === 'reading') {
      if (!formData.reading_passage.trim()) {
        alert('El texto de lectura es requerido');
        return;
      }
      if (!formData.reading_question.trim()) {
        alert('La pregunta sobre el texto es requerida');
        return;
      }
    } else {
      const hasPassage = formData.reading_passage.trim();
      const effectiveQuestion = hasPassage ? formData.reading_question : formData.question;
      if (!effectiveQuestion.trim()) {
        alert(hasPassage ? 'La pregunta sobre el texto es requerida' : 'La pregunta es requerida');
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
        // options = solo palabras correctas
        finalOptions = formData.word_order_words.filter(w => w.trim());
      } else if (needsOptions) {
        finalOptions = formData.options.filter((o) => o.trim());
      } else {
        finalOptions = [];
      }

      // Construir question según tipo
      let finalQuestion: string;
      if (type === 'reading' || (formData.reading_passage.trim())) {
        finalQuestion = `Read: "${formData.reading_passage.trim()}" ${formData.reading_question.trim()}`;
      } else if (type === 'speaking' && !formData.question.trim()) {
        finalQuestion = 'Repeat this sentence out loud';
      } else {
        finalQuestion = formData.question;
      }

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
      {/* Tab Switcher */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100 mb-4 flex gap-2">
        <button
          onClick={() => setActiveTab('questions')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'questions' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HelpCircle size={16} />
          Preguntas
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'results' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart2 size={16} />
          Resultados
          {diagnosticResults.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'results' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {diagnosticResults.length}
            </span>
          )}
        </button>
      </div>

      {/* Results Tab */}
      {activeTab === 'results' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loadingResults ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          ) : diagnosticResults.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
              <p>Aún no hay resultados de la prueba diagnóstica</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Usuario</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Puntaje</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Nivel</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnosticResults.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-slate-900">{r.user_name || 'Sin nombre'}</p>
                          <p className="text-xs text-slate-500">{r.user_email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-700 font-medium">{r.correct_answers} correctas</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${
                            r.level === 'A1' ? 'bg-green-100 text-green-700' :
                            r.level === 'A2' ? 'bg-blue-100 text-blue-700' :
                            r.level === 'B1' ? 'bg-yellow-100 text-yellow-700' :
                            r.level === 'B2' ? 'bg-purple-100 text-purple-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {r.level}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-slate-500">
                            {new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden divide-y divide-slate-100">
                {diagnosticResults.map((r) => (
                  <div key={r.id} className="p-4">
                    <p className="text-sm font-medium text-slate-900">{r.user_name || 'Sin nombre'}</p>
                    <p className="text-xs text-slate-500 mb-2">{r.user_email}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">{r.correct_answers} correctas</span>
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                        r.level === 'A1' ? 'bg-green-100 text-green-700' :
                        r.level === 'A2' ? 'bg-blue-100 text-blue-700' :
                        r.level === 'B1' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>{r.level}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Questions Tab Content */}
      {activeTab === 'questions' && <>

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
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm bg-white text-slate-900"
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
                    <div className="flex flex-wrap items-center gap-2">
                      {question.exercise_type === 'word_order' ? (
                        <>
                          {question.correct_answer.trim().split(/\s+/).map((word, i) => (
                            <span key={i} className="px-2 py-1 rounded-lg text-xs bg-green-100 text-green-700 font-medium inline-flex items-center gap-1">
                              <Check size={12} />
                              {word}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="px-3 py-1.5 rounded-lg text-xs bg-green-100 text-green-700 font-medium">
                          <Check size={12} className="inline mr-1" />
                          {question.correct_answer}
                        </span>
                      )}
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
                        reading_passage: '',
                        reading_question: '',
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
                  {/* Toggle para agregar texto de lectura */}
                  {!formData.reading_passage && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, reading_passage: ' ', reading_question: formData.question, question: '' })}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-blue-200 transition-colors"
                    >
                      <BookOpen size={13} />
                      + Agregar texto de lectura
                    </button>
                  )}

                  {/* Con texto de lectura: 2 campos separados */}
                  {formData.reading_passage ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <BookOpen size={13} className="text-blue-500" />
                            Texto de lectura *
                          </label>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, reading_passage: '', question: formData.reading_question, reading_question: '' })}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Quitar texto
                          </button>
                        </div>
                        <textarea
                          value={formData.reading_passage.trim()}
                          onChange={(e) => setFormData({ ...formData, reading_passage: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2.5 rounded-xl border border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none text-sm resize-none text-slate-900 bg-white"
                          placeholder='Ej: María lives in Madrid. She has a cat.'
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Pregunta *</label>
                        <input
                          type="text"
                          value={formData.reading_question}
                          onChange={(e) => setFormData({ ...formData, reading_question: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                          placeholder='Ej: Where does María live? / ¿Dónde vive María?'
                        />
                      </div>
                    </>
                  ) : (
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
                  )}
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
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = formData.options.filter((_, i) => i !== index);
                              setFormData({ ...formData, options: newOpts, correct_answer: formData.correct_answer === option ? '' : formData.correct_answer });
                            }}
                            className="shrink-0 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X size={15} className="text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, options: [...formData.options, ''] })}
                      className="mt-2 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      <Plus size={14} />
                      Agregar opción
                    </button>
                    <p className="mt-1.5 text-xs text-slate-400">Haz clic en el círculo para marcar la correcta.</p>
                  </div>
                  {/* Preview MCQ */}
                  {(formData.question.trim() || formData.reading_question.trim()) && formData.options.some(o => o.trim()) && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vista previa del estudiante</p>
                      {formData.reading_passage.trim() ? (
                        <>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                            <p className="text-[10px] text-blue-600 font-medium mb-1 flex items-center gap-1"><BookOpen size={10} /> Lee el siguiente texto:</p>
                            <p className="text-xs text-slate-700">{formData.reading_passage.trim()}</p>
                          </div>
                          <p className="text-sm font-bold text-slate-800 text-center mb-2">{formData.reading_question}</p>
                        </>
                      ) : formData.question.includes('___') ? (
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
                            opt === formData.correct_answer ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-800' : 'border-slate-200 bg-white text-slate-700'
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
                  {/* Preview Word Order */}
                  {formData.word_order_words.filter(w => w.trim()).length >= 2 && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vista previa del estudiante</p>
                      <p className="text-sm font-bold text-slate-800 text-center mb-2">{formData.question || 'Order these words to form a sentence'}</p>
                      <p className="text-[10px] text-indigo-500 text-center mb-3">Tap words to build the sentence</p>
                      <div className="bg-white rounded-lg p-3 border border-slate-200 mb-2">
                        <div className="flex flex-wrap gap-1.5 justify-center">
                          {(() => {
                            const words = formData.word_order_words.filter(w => w.trim());
                            const shuffled = [...words].sort(() => Math.random() - 0.5);
                            return shuffled.map((word, i) => (
                              <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium border shadow-sm bg-slate-50 text-slate-700 border-slate-300">
                                {word}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border-2 border-dashed border-slate-200 min-h-[40px] flex items-center justify-center">
                        <span className="text-[10px] text-slate-400">Tap words above to build your answer</span>
                      </div>
                      <div className="mt-2">
                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                          <p className="text-[10px] text-green-600 font-medium">Correcta: <span className="font-bold">{formData.word_order_words.filter(w => w.trim()).join(' ')}</span></p>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-400">
                        Total: {formData.word_order_words.filter(w => w.trim()).length} palabras
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
                            opt === formData.correct_answer ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-800' : 'border-slate-200 bg-white text-slate-700'
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
                      Texto de lectura *
                    </label>
                    <textarea
                      value={formData.reading_passage}
                      onChange={(e) => setFormData({ ...formData, reading_passage: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none text-sm resize-none text-slate-900 bg-white"
                      placeholder='Ej: María lives in Madrid. She has a cat and two dogs.'
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Pregunta sobre el texto *
                    </label>
                    <input
                      type="text"
                      value={formData.reading_question}
                      onChange={(e) => setFormData({ ...formData, reading_question: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                      placeholder='Ej: ¿Dónde vive María? / Where does María live?'
                    />
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
                  {formData.reading_passage.trim() && formData.options.some(o => o.trim()) && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Vista previa del estudiante</p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                        <p className="text-[10px] text-blue-600 font-medium mb-1 flex items-center gap-1"><BookOpen size={10} /> Lee el siguiente texto:</p>
                        <p className="text-xs text-slate-700">{formData.reading_passage}</p>
                      </div>
                      {formData.reading_question.trim() && (
                        <p className="text-sm font-bold text-slate-800 text-center mb-2">{formData.reading_question}</p>
                      )}
                      <div className="space-y-1.5">
                        {formData.options.filter(o => o.trim()).map((opt, i) => (
                          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                            opt === formData.correct_answer ? 'border-indigo-300 bg-indigo-50 font-medium text-indigo-800' : 'border-slate-200 bg-white text-slate-700'
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

      </>}
    </AdminLayout>
  );
}
