// src/pages/Admin/StudentProgressDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Circle, Clock, Zap, Flame,
  BookOpen, Target, TrendingUp, Award
} from 'lucide-react';
import AdminLayout from './AdminLayout';
import { supabase } from '../../lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────

interface StudentProfile {
  user_id: string;
  full_name: string | null;
  email: string;
  level: string | null;
  xp_total: number;
  lessons_completed: number;
  streak_days: number;
  is_active: boolean;
  last_seen: string | null;
}

interface LessonProgressRow {
  lesson_id: string;
  level: string;
  completed: boolean;
  progress: number;
  correct_count: number | null;
  total_questions: number | null;
  xp_earned: number;
  updated_at: string;
}

interface LessonCatalog {
  id: string;
  title: string;
  level: string;
  order_index: number;
}

interface LevelSection {
  level: string;
  totalLessons: number;
  completedCount: number;
  inProgressCount: number;
  lessons: LessonRow[];
}

interface LessonRow {
  id: string;
  title: string;
  order_index: number;
  status: 'completed' | 'in_progress' | 'not_started';
  progress: number;
  correct_count: number | null;
  total_questions: number | null;
  xp_earned: number;
  updated_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, { badge: string; bar: string; ring: string; section: string }> = {
  A1: { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', ring: 'ring-emerald-200', section: 'border-emerald-200 bg-emerald-50/40' },
  A2: { badge: 'bg-blue-100 text-blue-700',       bar: 'bg-blue-500',    ring: 'ring-blue-200',    section: 'border-blue-200 bg-blue-50/40' },
  B1: { badge: 'bg-amber-100 text-amber-700',      bar: 'bg-amber-500',   ring: 'ring-amber-200',   section: 'border-amber-200 bg-amber-50/40' },
  B2: { badge: 'bg-purple-100 text-purple-700',    bar: 'bg-purple-500',  ring: 'ring-purple-200',  section: 'border-purple-200 bg-purple-50/40' },
  C1: { badge: 'bg-rose-100 text-rose-700',        bar: 'bg-rose-500',    ring: 'ring-rose-200',    section: 'border-rose-200 bg-rose-50/40' },
  C2: { badge: 'bg-indigo-100 text-indigo-700',    bar: 'bg-indigo-500',  ring: 'ring-indigo-200',  section: 'border-indigo-200 bg-indigo-50/40' },
};

function levelStyle(level: string | null) {
  if (!level) return { badge: 'bg-slate-100 text-slate-500', bar: 'bg-slate-400', ring: 'ring-slate-200', section: 'border-slate-200 bg-slate-50/40' };
  return LEVEL_COLORS[level] ?? { badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', ring: 'ring-slate-200', section: 'border-slate-200 bg-slate-50' };
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
  }
  return (email?.[0] || '?').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-teal-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
];
function getAvatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── Component ────────────────────────────────────────────────

export default function StudentProgressDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [sections, setSections] = useState<LevelSection[]>([]);
  const [openLevels, setOpenLevels] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) loadData(userId);
  }, [userId]);

  const toggleLevel = (level: string) => {
    setOpenLevels(prev => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
  };

  const loadData = async (uid: string) => {
    try {
      const [profileResult, progressResult, lessonsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name, email, level, xp_total, lessons_completed, streak_days, is_active, last_seen')
          .eq('user_id', uid)
          .single(),
        supabase
          .from('lesson_progress')
          .select('lesson_id, level, completed, progress, correct_count, total_questions, xp_earned, updated_at')
          .eq('user_id', uid),
        supabase
          .from('lessons')
          .select('id, title, level, order_index')
          .order('level')
          .order('order_index'),
      ]);

      if (profileResult.error) throw profileResult.error;
      setProfile(profileResult.data);

      // Map: lesson_id -> progress row
      const progressMap = new Map<string, LessonProgressRow>();
      for (const row of (progressResult.data || [])) {
        progressMap.set(row.lesson_id, row);
      }

      // Group catalog by level
      const byLevel = new Map<string, LessonCatalog[]>();
      for (const l of (lessonsResult.data || [])) {
        if (!byLevel.has(l.level)) byLevel.set(l.level, []);
        byLevel.get(l.level)!.push(l);
      }

      // Build sections
      const built: LevelSection[] = [];
      for (const [level, catalog] of byLevel.entries()) {
        const rows: LessonRow[] = catalog.map(cat => {
          const prog = progressMap.get(cat.id);
          let status: LessonRow['status'] = 'not_started';
          if (prog) status = prog.completed ? 'completed' : 'in_progress';
          return {
            id: cat.id,
            title: cat.title,
            order_index: cat.order_index,
            status,
            progress: prog?.progress ?? 0,
            correct_count: prog?.correct_count ?? null,
            total_questions: prog?.total_questions ?? null,
            xp_earned: prog?.xp_earned ?? 0,
            updated_at: prog?.updated_at ?? null,
          };
        });

        const completedCount = rows.filter(r => r.status === 'completed').length;
        const inProgressCount = rows.filter(r => r.status === 'in_progress').length;

        built.push({ level, totalLessons: catalog.length, completedCount, inProgressCount, lessons: rows });
      }

      // Sort levels
      built.sort((a, b) => a.level.localeCompare(b.level));

      setSections(built);

      // Auto-open the student's current level
      const currentLevel = profileResult.data.level;
      if (currentLevel) setOpenLevels(new Set([currentLevel]));
    } catch (e) {
      console.error('Error cargando detalle de estudiante:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Detalle Estudiante">
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout title="Detalle Estudiante">
        <div className="py-20 text-center text-slate-400">
          <p className="font-medium">Estudiante no encontrado</p>
        </div>
      </AdminLayout>
    );
  }

  const avatarColor = getAvatarColor(profile.full_name || profile.email);
  const initials = getInitials(profile.full_name, profile.email);
  const style = levelStyle(profile.level);

  // Global accuracy
  const totalCorrect = sections.reduce((s, sec) =>
    s + sec.lessons.reduce((ls, l) => ls + (l.correct_count ?? 0), 0), 0);
  const totalQs = sections.reduce((s, sec) =>
    s + sec.lessons.reduce((ls, l) => ls + (l.total_questions ?? 0), 0), 0);
  const accuracy = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : null;

  const totalXPFromLessons = sections.reduce((s, sec) =>
    s + sec.lessons.reduce((ls, l) => ls + l.xp_earned, 0), 0);

  return (
    <AdminLayout
      title="Detalle Estudiante"
      subtitle={profile.full_name || profile.email}
    >
      {/* Back */}
      <button
        onClick={() => navigate('/admin/student-progress')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-5"
      >
        <ArrowLeft size={16} />
        Volver a Progreso Estudiantes
      </button>

      {/* Profile card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className={`w-16 h-16 rounded-2xl ${avatarColor} flex items-center justify-center text-white text-xl font-bold flex-shrink-0`}>
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-900">
                {profile.full_name || 'Sin nombre'}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${style.badge}`}>
                {profile.level || 'Sin nivel'}
              </span>
              {!profile.is_active && (
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-rose-100 text-rose-600">
                  Inactivo
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <p className="text-xs text-slate-400 mt-1">
              Última conexión: {formatDate(profile.last_seen)}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <BookOpen size={14} className="text-slate-400" />
              <span className="text-xs text-slate-500">Lecciones</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{profile.lessons_completed}</p>
            <p className="text-xs text-slate-400">completadas</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Zap size={14} className="text-amber-500" />
              <span className="text-xs text-slate-500">XP Total</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{(profile.xp_total || 0).toLocaleString()}</p>
            <p className="text-xs text-slate-400">puntos</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Flame size={14} className="text-orange-400" />
              <span className="text-xs text-slate-500">Racha</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">{profile.streak_days}</p>
            <p className="text-xs text-slate-400">días consecutivos</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Target size={14} className="text-indigo-400" />
              <span className="text-xs text-slate-500">Precisión</span>
            </div>
            <p className="text-2xl font-bold text-indigo-600">
              {accuracy !== null ? `${accuracy}%` : '—'}
            </p>
            <p className="text-xs text-slate-400">{totalCorrect}/{totalQs} correctas</p>
          </div>
        </div>
      </div>

      {/* Level overview mini cards */}
      {sections.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {sections.map(sec => {
            const s = levelStyle(sec.level);
            const pct = sec.totalLessons > 0 ? Math.round((sec.completedCount / sec.totalLessons) * 100) : 0;
            return (
              <button
                key={sec.level}
                onClick={() => { setOpenLevels(new Set([sec.level])); document.getElementById(`level-${sec.level}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className={`text-left p-4 rounded-xl border-2 transition-all ${s.section} ${s.ring} hover:shadow-sm`}
              >
                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold mb-2 ${s.badge}`}>
                  {sec.level}
                </span>
                <p className="text-sm font-semibold text-slate-900">{sec.completedCount} / {sec.totalLessons}</p>
                <p className="text-xs text-slate-500 mb-2">lecciones</p>
                <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                  <div className={`h-full ${s.bar} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 text-right">{pct}%</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Lesson detail per level */}
      <div className="space-y-4">
        {sections.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-100">
            <TrendingUp size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">Sin lecciones en el sistema</p>
          </div>
        ) : (
          sections.map(sec => {
            const s = levelStyle(sec.level);
            const pct = sec.totalLessons > 0 ? Math.round((sec.completedCount / sec.totalLessons) * 100) : 0;
            const isOpen = openLevels.has(sec.level);
            const isCurrent = profile.level === sec.level;

            return (
              <div
                key={sec.level}
                id={`level-${sec.level}`}
                className={`rounded-2xl border-2 overflow-hidden transition-all ${s.section}`}
              >
                {/* Level header — clickable to expand */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-black/5 transition-colors"
                  onClick={() => toggleLevel(sec.level)}
                >
                  <span className={`px-3 py-1 rounded-lg text-sm font-bold flex-shrink-0 ${s.badge}`}>
                    {sec.level}
                  </span>

                  {isCurrent && (
                    <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-slate-300 text-slate-500 flex-shrink-0">
                      Nivel actual
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                        <span className="hidden sm:inline">{sec.completedCount} completadas · {sec.inProgressCount} en progreso · {sec.totalLessons - sec.completedCount - sec.inProgressCount} sin iniciar</span>
                        <span className="sm:hidden">{sec.completedCount}/{sec.totalLessons} lecciones</span>
                      </span>
                      <span className="text-xs text-slate-500 ml-2 flex-shrink-0 font-semibold">{pct}%</span>
                    </div>
                    <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                      <div className={`h-full ${s.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <span className={`text-slate-400 transition-transform duration-200 flex-shrink-0 text-xs ${isOpen ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                </button>

                {/* Lessons list */}
                {isOpen && (
                  <div className="border-t border-current/10">
                    {/* Table header — solo desktop */}
                    <div className="hidden md:grid grid-cols-[1.5fr_90px_100px_110px_130px] gap-3 px-5 py-2.5 bg-white/50 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      <span>Lección</span>
                      <span>Estado</span>
                      <span>Progreso</span>
                      <span>Aciertos</span>
                      <span>Última actividad</span>
                    </div>

                    <div className="divide-y divide-current/5">
                      {sec.lessons.map((lesson, idx) => (
                        <div key={lesson.id} className="px-4 py-3.5 bg-white/30 hover:bg-white/60 transition-colors">

                          {/* Mobile layout */}
                          <div className="flex items-start gap-3 md:hidden">
                            <span className="text-xs font-mono text-slate-400 w-5 flex-shrink-0 pt-0.5">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                {lesson.status === 'completed' ? (
                                  <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                                ) : lesson.status === 'in_progress' ? (
                                  <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 flex-shrink-0" />
                                ) : (
                                  <Circle size={15} className="text-slate-300 flex-shrink-0" />
                                )}
                                <span className={`text-sm font-medium truncate ${lesson.status === 'not_started' ? 'text-slate-400' : 'text-slate-800'}`}>
                                  {lesson.title}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                {lesson.status === 'completed' && <span className="text-emerald-600 font-medium">Completada</span>}
                                {lesson.status === 'in_progress' && (
                                  <span className="text-amber-600 font-medium flex items-center gap-1">
                                    En curso · {Math.round(lesson.progress)}%
                                  </span>
                                )}
                                {lesson.correct_count !== null && lesson.total_questions !== null && (
                                  <span className="flex items-center gap-1">
                                    <Award size={11} className="text-indigo-400" />
                                    {lesson.correct_count}/{lesson.total_questions}
                                    ({lesson.total_questions > 0 ? Math.round((lesson.correct_count / lesson.total_questions) * 100) : 0}%)
                                  </span>
                                )}
                                {lesson.updated_at && (
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Clock size={10} />
                                    {formatDate(lesson.updated_at)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Desktop layout */}
                          <div className="hidden md:grid grid-cols-[1.5fr_90px_100px_110px_130px] gap-3 items-center">
                            {/* Título */}
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs font-mono text-slate-400 w-5 flex-shrink-0">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="flex items-center gap-2 min-w-0">
                                {lesson.status === 'completed' ? (
                                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                                ) : lesson.status === 'in_progress' ? (
                                  <div className="w-4 h-4 rounded-full border-2 border-amber-400 flex-shrink-0 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  </div>
                                ) : (
                                  <Circle size={16} className="text-slate-300 flex-shrink-0" />
                                )}
                                <span className={`text-sm truncate ${lesson.status === 'not_started' ? 'text-slate-400' : 'text-slate-800 font-medium'}`}>
                                  {lesson.title}
                                </span>
                              </div>
                            </div>

                            {/* Estado */}
                            <div>
                              {lesson.status === 'completed' ? (
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Completada</span>
                              ) : lesson.status === 'in_progress' ? (
                                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">En curso</span>
                              ) : (
                                <span className="text-xs text-slate-400">Sin iniciar</span>
                              )}
                            </div>

                            {/* Progreso % */}
                            <div className="flex items-center gap-2">
                              {lesson.status !== 'not_started' ? (
                                <>
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                                    <div
                                      className={`h-full rounded-full ${lesson.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                      style={{ width: `${Math.min(100, Math.round(lesson.progress))}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-500">{Math.round(lesson.progress)}%</span>
                                </>
                              ) : <span className="text-xs text-slate-300">—</span>}
                            </div>

                            {/* Aciertos */}
                            <div className="flex items-center gap-1.5 text-xs">
                              {lesson.correct_count !== null && lesson.total_questions !== null ? (
                                <>
                                  <Award size={12} className="text-indigo-400 flex-shrink-0" />
                                  <span className="text-slate-700 font-medium">{lesson.correct_count}/{lesson.total_questions}</span>
                                  <span className="text-slate-400">({lesson.total_questions > 0 ? Math.round((lesson.correct_count / lesson.total_questions) * 100) : 0}%)</span>
                                </>
                              ) : <span className="text-slate-300">—</span>}
                            </div>

                            {/* Última actividad */}
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              {lesson.updated_at ? (
                                <><Clock size={11} className="flex-shrink-0" />{formatDateTime(lesson.updated_at)}</>
                              ) : <span>—</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Level XP summary */}
                    {sec.lessons.some(l => l.xp_earned > 0) && (
                      <div className="px-5 py-3 bg-white/20 border-t border-current/10 flex justify-end">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                          <Zap size={12} />
                          {sec.lessons.reduce((s, l) => s + l.xp_earned, 0).toLocaleString()} XP ganados en este nivel
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Total XP from lessons */}
      {totalXPFromLessons > 0 && (
        <div className="mt-4 text-right">
          <span className="text-xs text-slate-400">
            XP total ganado en lecciones: <span className="font-semibold text-amber-600">{totalXPFromLessons.toLocaleString()}</span>
          </span>
        </div>
      )}
    </AdminLayout>
  );
}
