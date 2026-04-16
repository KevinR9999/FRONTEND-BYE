// src/pages/Admin/StudentProgressPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Users, BookOpen, Clock, Zap, Flame, ChevronRight } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { supabase } from '../../lib/supabaseClient';

interface StudentProgressEntry {
  user_id: string;
  full_name: string | null;
  email: string;
  level: string | null;
  xp_total: number;
  lessons_completed: number;
  streak_days: number;
  is_active: boolean;
  // lesson_progress data
  current_lesson_title: string | null;
  current_lesson_level: string | null;
  current_lesson_progress: number;
  last_activity: string | null;
  // level completion
  lessons_in_level: number;
}

const LEVEL_COLORS: Record<string, { badge: string; bar: string }> = {
  A1: { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  A2: { badge: 'bg-blue-100 text-blue-700',       bar: 'bg-blue-500' },
  B1: { badge: 'bg-amber-100 text-amber-700',      bar: 'bg-amber-500' },
  B2: { badge: 'bg-purple-100 text-purple-700',    bar: 'bg-purple-500' },
  C1: { badge: 'bg-rose-100 text-rose-700',        bar: 'bg-rose-500' },
  C2: { badge: 'bg-indigo-100 text-indigo-700',    bar: 'bg-indigo-500' },
};

function getLevelBadge(level: string | null) {
  if (!level) return 'bg-slate-100 text-slate-500';
  return LEVEL_COLORS[level]?.badge ?? 'bg-slate-100 text-slate-600';
}

function getLevelBar(level: string | null) {
  if (!level) return 'bg-slate-400';
  return LEVEL_COLORS[level]?.bar ?? 'bg-slate-400';
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (email?.[0] || '?').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-teal-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
];

function getAvatarColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function StudentProgressPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentProgressEntry[]>([]);
  const [filtered, setFiltered] = useState<StudentProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [levels, setLevels] = useState<string[]>([]);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    let result = students;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        (s.full_name || '').toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    }
    if (levelFilter !== 'all') {
      result = result.filter(s => s.level === levelFilter);
    }
    setFiltered(result);
  }, [students, search, levelFilter]);

  const loadData = async () => {
    try {
      // 3 queries en paralelo: perfiles, progreso lecciones, catálogo lecciones
      const [profilesResult, progressResult, lessonsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name, email, level, xp_total, lessons_completed, streak_days, is_active')
          .eq('role', 'student')
          .order('lessons_completed', { ascending: false }),
        supabase
          .from('lesson_progress')
          .select('user_id, lesson_id, level, completed, progress, updated_at')
          .order('updated_at', { ascending: false }),
        supabase
          .from('lessons')
          .select('id, title, level'),
      ]);

      if (profilesResult.error) throw profilesResult.error;

      // Map: lesson_id -> title
      const lessonMap = new Map<string, { title: string; level: string }>();
      for (const l of (lessonsResult.data || [])) {
        lessonMap.set(l.id, { title: l.title, level: l.level });
      }

      // Count lessons per level in the catalog
      const lessonsPerLevel = new Map<string, number>();
      for (const l of (lessonsResult.data || [])) {
        if (l.level) lessonsPerLevel.set(l.level, (lessonsPerLevel.get(l.level) ?? 0) + 1);
      }

      // Map: user_id -> most recent lesson_progress entry (already sorted desc by updated_at)
      const latestByUser = new Map<string, any>();
      for (const entry of (progressResult.data || [])) {
        if (!latestByUser.has(entry.user_id)) {
          latestByUser.set(entry.user_id, entry);
        }
      }

      const merged: StudentProgressEntry[] = (profilesResult.data || []).map(p => {
        const latest = latestByUser.get(p.user_id);
        const lessonInfo = latest?.lesson_id ? lessonMap.get(latest.lesson_id) : null;
        return {
          ...p,
          current_lesson_title: lessonInfo?.title ?? null,
          current_lesson_level: lessonInfo?.level ?? latest?.level ?? null,
          current_lesson_progress: latest?.progress ?? 0,
          last_activity: latest?.updated_at ?? null,
          lessons_in_level: p.level ? (lessonsPerLevel.get(p.level) ?? 0) : 0,
        };
      });

      const uniqueLevels = [...new Set(merged.map(s => s.level).filter(Boolean))] as string[];
      uniqueLevels.sort();

      setStudents(merged);
      setFiltered(merged);
      setLevels(uniqueLevels);
    } catch (e) {
      console.error('Error cargando progreso de estudiantes:', e);
    } finally {
      setLoading(false);
    }
  };

  const activeCount = students.filter(s => s.is_active).length;
  const avgLessons = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.lessons_completed, 0) / students.length)
    : 0;
  const withActivityCount = students.filter(s => s.last_activity).length;
  const totalXP = students.reduce((sum, s) => sum + (s.xp_total || 0), 0);

  return (
    <AdminLayout
      title="Progreso Estudiantes"
      subtitle={`${students.length} estudiante${students.length !== 1 ? 's' : ''} registrado${students.length !== 1 ? 's' : ''}`}
    >
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-blue-500" />
            <span className="text-xs text-slate-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{students.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">estudiantes</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-emerald-500" />
            <span className="text-xs text-slate-500">Activos</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
          <p className="text-xs text-slate-400 mt-0.5">cuentas activas</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={16} className="text-amber-500" />
            <span className="text-xs text-slate-500">Promedio</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{avgLessons}</p>
          <p className="text-xs text-slate-400 mt-0.5">lecciones / estudiante</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-purple-500" />
            <span className="text-xs text-slate-500">XP total</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalXP.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-0.5">entre todos</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <select
          value={levelFilter}
          onChange={e => setLevelFilter(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="all" className="text-slate-900">Todos los niveles</option>
          {levels.map(l => (
            <option key={l} value={l} className="text-slate-900">{l}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <TrendingUp size={44} className="mx-auto mb-3 opacity-25" />
            <p className="font-medium">Sin estudiantes</p>
            <p className="text-sm mt-1">No hay resultados para esta búsqueda</p>
          </div>
        ) : (
          <>
            {/* Header desktop */}
            <div className="hidden lg:grid grid-cols-[1.4fr_70px_160px_1fr_120px_90px_32px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
              <span>Estudiante</span>
              <span>Nivel</span>
              <span>Progreso en nivel</span>
              <span>Última lección activa</span>
              <span>Última actividad</span>
              <span>XP / Racha</span>
              <span></span>
            </div>

            <div className="divide-y divide-slate-100">
              {filtered.map(s => {
                const avatarColor = getAvatarColor(s.full_name || s.email);
                const initials = getInitials(s.full_name, s.email);
                const levelPct = s.lessons_in_level > 0
                  ? Math.min(100, Math.round((s.lessons_completed / s.lessons_in_level) * 100))
                  : 0;
                const barColor = getLevelBar(s.level);

                return (
                  <div
                    key={s.user_id}
                    onClick={() => navigate(`/admin/student-progress/${s.user_id}`)}
                    className="grid grid-cols-1 lg:grid-cols-[1.4fr_70px_160px_1fr_120px_90px_32px] gap-3 lg:gap-4 px-5 py-4 hover:bg-indigo-50/50 cursor-pointer transition-colors"
                  >
                    {/* Estudiante */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {s.full_name || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{s.email}</p>
                        {!s.is_active && (
                          <span className="text-[10px] text-rose-500 font-semibold">Inactivo</span>
                        )}
                      </div>
                    </div>

                    {/* Nivel */}
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getLevelBadge(s.level)}`}>
                        {s.level || '—'}
                      </span>
                    </div>

                    {/* Progreso en nivel */}
                    <div className="flex flex-col justify-center gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-700 font-medium">
                          {s.lessons_completed}
                          {s.lessons_in_level > 0 && (
                            <span className="text-slate-400 font-normal"> / {s.lessons_in_level} lecciones</span>
                          )}
                        </span>
                        {s.lessons_in_level > 0 && (
                          <span className="text-[10px] text-slate-500 font-medium">{levelPct}%</span>
                        )}
                      </div>
                      {s.lessons_in_level > 0 ? (
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barColor} rounded-full transition-all`}
                            style={{ width: `${levelPct}%` }}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">{s.lessons_completed} completadas</span>
                      )}
                    </div>

                    {/* Última lección activa */}
                    <div className="flex flex-col justify-center min-w-0">
                      {s.current_lesson_title ? (
                        <>
                          <p className="text-sm text-slate-800 truncate font-medium">
                            {s.current_lesson_title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {s.current_lesson_level && s.current_lesson_level !== s.level && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${getLevelBadge(s.current_lesson_level)}`}>
                                {s.current_lesson_level}
                              </span>
                            )}
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[64px]">
                              <div
                                className="h-full bg-indigo-400 rounded-full"
                                style={{ width: `${Math.min(100, Math.round(s.current_lesson_progress))}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {Math.round(s.current_lesson_progress)}%
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin actividad aún</span>
                      )}
                    </div>

                    {/* Última actividad */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock size={12} className="flex-shrink-0" />
                      {formatDate(s.last_activity)}
                    </div>

                    {/* XP + Racha */}
                    <div className="flex flex-col justify-center gap-1">
                      <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <Zap size={11} />
                        {(s.xp_total || 0).toLocaleString()} XP
                      </div>
                      {s.streak_days > 0 && (
                        <div className="flex items-center gap-1 text-xs text-orange-500">
                          <Flame size={11} />
                          {s.streak_days} días
                        </div>
                      )}
                    </div>

                    {/* Chevron */}
                    <div className="hidden lg:flex items-center justify-center">
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 mt-3 text-right">
          Mostrando {filtered.length} de {students.length} estudiante{students.length !== 1 ? 's' : ''}
        </p>
      )}
    </AdminLayout>
  );
}
