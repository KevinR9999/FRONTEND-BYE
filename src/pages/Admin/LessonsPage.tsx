// src/pages/Admin/LessonsPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  GripVertical
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import {
  getLessons,
  getLevels,
  createLesson,
  updateLesson,
  deleteLesson
} from '../../services/adminService';
import type { Lesson, Level } from '../../types/admin';

interface LessonFormData {
  title: string;
  level: Level;
  estimated_minutes: number;
  is_locked: boolean;
}

export default function LessonsPage() {
  // Niveles dinámicos
  const [levels, setLevels] = useState<{ code: string; count: number }[]>([]);
  const [activeLevel, setActiveLevel] = useState<string>('');
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
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [levelsData, lessonsData] = await Promise.all([
        getLevels(),
        getLessons()
      ]);
      setLevels(levelsData);
      setLessons(lessonsData);
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
      if (editingLesson) {
        await updateLesson(editingLesson.id, formData);
        setLessons((prev) =>
          prev.map((l) =>
            l.id === editingLesson.id ? { ...l, ...formData } : l
          )
        );
      } else {
        const sameLevel = lessons.filter((l) => l.level === formData.level);
        const maxOrder = sameLevel.length > 0
          ? Math.max(...sameLevel.map((l) => l.order_index))
          : 0;

        const newLesson = await createLesson({
          ...formData,
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
      alert('Error al guardar la lección');
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

  return (
    <AdminLayout
      title="Lecciones"
      subtitle={`Total: ${lessons.length} lecciones`}
    >
      {/* Level Tabs - Dinámicos */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100 mb-4">
        <div className="flex gap-2 overflow-x-auto items-center">
          {levels.map((level) => (
            <button
              key={level.code}
              onClick={() => setActiveLevel(level.code)}
              className={`min-w-[80px] px-4 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeLevel === level.code
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {level.code}
              <span className={`ml-1.5 text-xs ${activeLevel === level.code ? 'text-violet-200' : 'text-slate-400'}`}>
                ({level.count})
              </span>
            </button>
          ))}

          {/* Botón Agregar Nivel */}
          <button
            onClick={() => setShowLevelModal(true)}
            className="min-w-[80px] px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border-2 border-dashed border-slate-300 text-slate-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus size={16} />
            Nivel
          </button>
        </div>
      </div>

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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm bg-white"
            />
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
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
            <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
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
              className="mt-4 text-violet-600 text-sm font-medium hover:underline"
            >
              Crear primera lección
            </button>
          </div>
        ) : (
          filteredLessons.map((lesson) => (
            <div
              key={lesson.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4">
                {/* Order Number */}
                <div className="flex items-center gap-2">
                  <GripVertical size={16} className="text-slate-300" />
                  <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">
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
                    <Link
                      to={`/admin/lessons/${lesson.id}/questions`}
                      className="flex items-center gap-1 text-violet-600 hover:underline"
                    >
                      <FileText size={12} />
                      Ver preguntas
                    </Link>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Link
                    to={`/admin/lessons/${lesson.id}/questions`}
                    className="p-2 hover:bg-violet-50 rounded-lg transition-colors"
                    title="Ver ejercicios"
                  >
                    <ChevronRight size={18} className="text-violet-500" />
                  </Link>
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
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm"
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
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
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
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm"
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
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm text-slate-900 bg-white"
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
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm"
                />
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
                    formData.is_locked ? 'bg-violet-500' : 'bg-slate-300'
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
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingLesson ? 'Guardar Cambios' : 'Crear Lección'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
