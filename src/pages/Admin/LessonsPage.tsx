// src/pages/Admin/LessonsPage.tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronRight,
  Clock,
  FileText,
  Check,
  X,
  GripVertical,
  AlertTriangle,
  Lock
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import {
  getLessons,
  getLevels,
  createLesson,
  updateLesson,
  deleteLesson,
  deleteLessonsByLevel,
  setLevelRequirement,
  getLevelRequirements
} from '../../services/adminService';
import type { Lesson, Level } from '../../types/admin';

interface LessonFormData {
  title: string;
  level: Level;
  estimated_minutes: number;
  is_locked: boolean;
  required_level: string;
}

export default function LessonsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Niveles dinámicos
  const [levels, setLevels] = useState<{ code: string; count: number }[]>([]);
  const [activeLevel, setActiveLevel] = useState<string>(searchParams.get('level') ?? '');
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [newLevelCode, setNewLevelCode] = useState('');

  // Lecciones
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [formData, setFormData] = useState<LessonFormData>({
    title: '',
    level: '',
    estimated_minutes: 15,
    is_locked: false,
    required_level: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLevelConfirm, setDeleteLevelConfirm] = useState<string | null>(null);
  const [deletingLevel, setDeletingLevel] = useState(false);

  // Requisitos por nivel
  const [levelReqs, setLevelReqs] = useState<Record<string, string | null>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [levelsData, lessonsData, reqs] = await Promise.all([
        getLevels(),
        getLessons(),
        getLevelRequirements()
      ]);
      setLevels(levelsData);
      setLessons(lessonsData);
      setLevelReqs(reqs);
      if (levelsData.length > 0 && !activeLevel) {
        setActiveLevel(levelsData[0].code);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar lecciones del nivel activo
  const filteredLessons = lessons
    .filter((l) => {
      const matchesLevel = l.level === activeLevel;
      const matchesSearch = search
        ? l.title.toLowerCase().includes(search.toLowerCase())
        : true;
      return matchesLevel && matchesSearch;
    })
    .sort((a, b) => a.order_index - b.order_index);

  // ========== NIVELES ==========

  const handleAddLevel = () => {
    const code = newLevelCode.trim().toUpperCase();
    if (!code) {
      alert('Escribe un código de nivel (ej: C1, C2)');
      return;
    }
    if (levels.some(l => l.code === code)) {
      alert('Ese nivel ya existe');
      return;
    }
    // Agregar nivel a la lista local (se persistirá cuando creen la primera lección)
    setLevels(prev => [...prev, { code, count: 0 }]);
    setActiveLevel(code);
    setNewLevelCode('');
    setShowLevelModal(false);
  };

  // ========== LECCIONES ==========

  const openCreateModal = () => {
    setEditingLesson(null);
    setFormData({
      title: '',
      level: activeLevel,
      estimated_minutes: 15,
      is_locked: false,
      required_level: '',
    });
    setShowModal(true);
  };

  const openEditModal = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setFormData({
      title: lesson.title,
      level: lesson.level,
      estimated_minutes: lesson.estimated_minutes,
      is_locked: lesson.is_locked,
      required_level: lesson.required_level || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert('El título es requerido');
      return;
    }

    setSaving(true);
    try {
      const saveData = {
        ...formData,
        required_level: formData.required_level || null,
      };

      if (editingLesson) {
        await updateLesson(editingLesson.id, saveData);
        setLessons((prev) =>
          prev.map((l) =>
            l.id === editingLesson.id ? { ...l, ...saveData } : l
          )
        );
      } else {
        const sameLevel = lessons.filter((l) => l.level === formData.level);
        const maxOrder = sameLevel.length > 0
          ? Math.max(...sameLevel.map((l) => l.order_index))
          : 0;

        const newLesson = await createLesson({
          ...saveData,
          order_index: maxOrder + 1,
        });
        setLessons((prev) => [...prev, newLesson]);

        // Actualizar conteo de niveles
        setLevels(prev =>
          prev.map(l =>
            l.code === formData.level ? { ...l, count: l.count + 1 } : l
          )
        );
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error saving lesson:', error);
      alert('Error al guardar la lección: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const lesson = lessons.find(l => l.id === id);
      await deleteLesson(id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
      setDeleteConfirm(null);

      // Actualizar conteo de niveles
      if (lesson) {
        setLevels(prev =>
          prev.map(l =>
            l.code === lesson.level ? { ...l, count: Math.max(0, l.count - 1) } : l
          )
        );
      }
    } catch (error) {
      console.error('Error deleting lesson:', error);
      alert('Error al eliminar la lección');
    }
  };

  const handleDeleteLevel = async (levelCode: string) => {
    setDeletingLevel(true);
    try {
      const count = levels.find(l => l.code === levelCode)?.count || 0;
      if (count > 0) {
        await deleteLessonsByLevel(levelCode);
      }
      // Remover lecciones locales de ese nivel
      setLessons(prev => prev.filter(l => l.level !== levelCode));
      // Remover el nivel de la lista
      setLevels(prev => prev.filter(l => l.code !== levelCode));
      // Si el nivel activo era este, cambiar al primero disponible
      if (activeLevel === levelCode) {
        const remaining = levels.filter(l => l.code !== levelCode);
        setActiveLevel(remaining.length > 0 ? remaining[0].code : '');
      }
      setDeleteLevelConfirm(null);
    } catch (error) {
      console.error('Error deleting level:', error);
      alert('Error al eliminar el nivel: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setDeletingLevel(false);
    }
  };

  const handleLevelReqChange = async (levelCode: string, reqLevel: string) => {
    const value = reqLevel || null;
    try {
      await setLevelRequirement(levelCode, value);
      setLevelReqs(prev => ({ ...prev, [levelCode]: value }));
      // Actualizar lecciones locales
      setLessons(prev =>
        prev.map(l => l.level === levelCode ? { ...l, required_level: value } : l)
      );
    } catch (error) {
      console.error('Error setting level requirement:', error);
      alert('Error al configurar el requisito del nivel');
    }
  };

  return (
    <AdminLayout
      title="Lecciones"
      subtitle={`Total: ${lessons.length} lecciones`}
    >
      {/* Level Tabs - Dinámicos */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100 mb-4">
        <div className="flex gap-2 overflow-x-auto items-center">
          {levels.map((level) => (
            <div key={level.code} className="relative group flex items-center">
              <button
                onClick={() => setActiveLevel(level.code)}
                className={`min-w-[80px] px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap pr-8 ${
                  activeLevel === level.code
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {level.code}
                <span className={`ml-1.5 text-xs ${activeLevel === level.code ? 'text-slate-300' : 'text-slate-400'}`}>
                  ({level.count})
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteLevelConfirm(level.code);
                }}
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md transition-all opacity-0 group-hover:opacity-100 ${
                  activeLevel === level.code
                    ? 'hover:bg-slate-600 text-slate-300 hover:text-white'
                    : 'hover:bg-red-100 text-slate-300 hover:text-red-500'
                }`}
                title={`Eliminar nivel ${level.code}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {/* Botón Agregar Nivel */}
          <button
            onClick={() => setShowLevelModal(true)}
            className="min-w-[80px] px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus size={16} />
            Nivel
          </button>
        </div>
      </div>

      {/* Requisito del nivel activo */}
      {activeLevel && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 mb-4 flex items-center gap-3">
          <Lock size={16} className="text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
            Para desbloquear {activeLevel}:
          </span>
          <select
            value={levelReqs[activeLevel] || ''}
            onChange={(e) => handleLevelReqChange(activeLevel, e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-xs text-slate-900 bg-white"
          >
            <option value="">Sin requisito (siempre disponible)</option>
            {levels
              .filter(l => l.code !== activeLevel)
              .map((l) => (
                <option key={l.code} value={l.code}>
                  Completar nivel {l.code} primero
                </option>
              ))}
          </select>
          {levelReqs[activeLevel] && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-lg whitespace-nowrap">
              Requiere {levelReqs[activeLevel]}
            </span>
          )}
        </div>
      )}

      {/* Search + Add Lesson Button */}
      {activeLevel && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar lección..."
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
            <span>Nueva Lección</span>
          </button>
        </div>
      )}

      {/* Lessons List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : !activeLevel ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <p className="text-slate-500">Selecciona un nivel o crea uno nuevo</p>
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <p className="text-slate-500">No hay lecciones en el nivel {activeLevel}</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-slate-600 text-sm font-medium hover:underline"
            >
              Crear primera lección
            </button>
          </div>
        ) : (
          filteredLessons.map((lesson) => (
            <div
              key={lesson.id}
              onClick={() => navigate(`/admin/lessons/${lesson.id}/questions`)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {/* Order Number */}
                <div className="flex items-center gap-2">
                  <GripVertical size={16} className="text-slate-300" />
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
                    {lesson.order_index}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {lesson.title}
                    </h3>
                    {lesson.is_locked && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-xs">
                        Bloqueada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {lesson.estimated_minutes} min
                    </span>
                    <span className="flex items-center gap-1 text-slate-600">
                      <FileText size={12} />
                      Ver preguntas
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEditModal(lesson)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Editar lección"
                  >
                    <Edit2 size={16} className="text-slate-400" />
                  </button>
                  {deleteConfirm === lesson.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(lesson.id)}
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
                      onClick={() => setDeleteConfirm(lesson.id)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar lección"
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

      {/* Modal: Agregar Nivel */}
      {showLevelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Agregar Nuevo Nivel
              </h2>
              <button
                onClick={() => { setShowLevelModal(false); setNewLevelCode(''); }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Código del nivel *
                </label>
                <input
                  type="text"
                  value={newLevelCode}
                  onChange={(e) => setNewLevelCode(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                  placeholder="Ej: C1, C2, Beginner..."
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLevel()}
                />
              </div>
              <p className="text-xs text-slate-400">
                El nivel aparecerá como tab. Después podrás agregarle lecciones.
              </p>
            </div>

            <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => { setShowLevelModal(false); setNewLevelCode(''); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddLevel}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Agregar Nivel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear/Editar Lección */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingLesson ? 'Editar Lección' : `Nueva Lección (${activeLevel})`}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                  placeholder="Ej: Present Simple"
                  autoFocus
                />
              </div>

              {/* Level */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nivel
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                >
                  {levels.map((l) => (
                    <option key={l.code} value={l.code}>{l.code} ({l.count} lecciones)</option>
                  ))}
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Duración Estimada (minutos)
                </label>
                <input
                  type="number"
                  value={formData.estimated_minutes}
                  onChange={(e) => setFormData({ ...formData, estimated_minutes: parseInt(e.target.value) || 15 })}
                  min={5}
                  max={120}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                />
              </div>

              {/* Required Level */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Requiere completar nivel (opcional)
                </label>
                <select
                  value={formData.required_level}
                  onChange={(e) => setFormData({ ...formData, required_level: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 outline-none text-sm text-slate-900 bg-white"
                >
                  <option value="">Sin requisito</option>
                  {levels
                    .filter(l => l.code !== formData.level)
                    .map((l) => (
                      <option key={l.code} value={l.code}>
                        Completar {l.code} ({l.count} lecciones)
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  El estudiante debe completar todas las lecciones del nivel seleccionado antes de acceder a esta.
                </p>
              </div>

              {/* Is Locked */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Bloqueada</p>
                  <p className="text-xs text-slate-500">
                    Los usuarios necesitan completar la anterior
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_locked: !formData.is_locked })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    formData.is_locked ? 'bg-slate-700' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                      formData.is_locked ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
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
                {saving ? 'Guardando...' : editingLesson ? 'Guardar Cambios' : 'Crear Lección'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar eliminación de nivel */}
      {deleteLevelConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertTriangle size={28} className="text-red-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Eliminar nivel "{deleteLevelConfirm}"
              </h2>
              {(() => {
                const count = levels.find(l => l.code === deleteLevelConfirm)?.count || 0;
                return (
                  <p className="text-sm text-slate-500">
                    {count > 0
                      ? <>Se eliminarán <span className="font-semibold text-red-600">{count} lección{count > 1 ? 'es' : ''}</span> y todas sus preguntas. Esta acción no se puede deshacer.</>
                      : 'Este nivel no tiene lecciones. Se eliminará el nivel vacío.'
                    }
                  </p>
                );
              })()}
            </div>

            <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteLevelConfirm(null)}
                disabled={deletingLevel}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteLevel(deleteLevelConfirm)}
                disabled={deletingLevel}
                className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deletingLevel ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
