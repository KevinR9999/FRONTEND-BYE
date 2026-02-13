// src/pages/Stats/StatsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, User, Target, ArrowRight, CheckCircle, TrendingUp, Sparkles, Rocket } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type Level = "A1" | "A2" | "B1" | "B2";
const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

type ProfileRow = {
  level: string | null;
  streak_days: number | null;
};

type LessonRow = {
  id: string;
  level: Level;
  title: string;
  order_index: number | string;
  estimated_minutes: number | string;
};

type ProgressRow = {
  user_id: string;
  lesson_id: string;
  level: Level | null;
  progress: number | null; // 0-100
  completed: boolean | null;
  correct_count: number | null;
  total_questions: number | null;
  xp_earned: number | null;
};

function toNumber(v: any) {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function StatsPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [userName, setUserName] = useState("Usuario");
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState(0);

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;

        if (!user) {
          navigate("/login");
          return;
        }

        const finalName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          (user.email ? user.email.split("@")[0] : "Usuario");

        if (!alive) return;
        setUserName(finalName);

        // Profile: nivel actual + racha
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("level, streak_days")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profErr) console.warn("⚠️ profiles error:", profErr);

        const pr = (prof ?? null) as ProfileRow | null;
        if (!alive) return;
        setUserLevel(pr?.level ?? null);
        setStreakDays(Number(pr?.streak_days ?? 0));

        // Lessons catálogo
        const { data: lessonsData, error: lessonsErr } = await supabase
          .from("lessons")
          .select("id, level, title, order_index, estimated_minutes")
          .order("level", { ascending: true })
          .order("order_index", { ascending: true });

        if (lessonsErr) throw lessonsErr;

        // Progress del usuario
        const { data: progData, error: progErr } = await supabase
          .from("lesson_progress")
          .select(
            "user_id, lesson_id, level, progress, completed, correct_count, total_questions, xp_earned"
          )
          .eq("user_id", user.id);

        if (progErr) throw progErr;

        if (!alive) return;
        setLessons((lessonsData ?? []) as LessonRow[]);
        setProgress((progData ?? []) as ProgressRow[]);
      } catch (e: any) {
        setErr(e?.message ?? "Error cargando estadísticas");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  const lessonsById = useMemo(() => {
    const m = new Map<string, LessonRow>();
    lessons.forEach((l) => m.set(l.id, l));
    return m;
  }, [lessons]);

  const progressByLessonId = useMemo(() => {
    const m = new Map<string, ProgressRow>();
    progress.forEach((p) => m.set(p.lesson_id, p));
    return m;
  }, [progress]);

  // --- Métricas globales ---
  const totalXp = useMemo(() => {
    return progress.reduce((acc, r) => acc + Number(r.xp_earned ?? 0), 0);
  }, [progress]);

  const lessonsAttempted = useMemo(() => {
    // intentadas = filas con total_questions > 0 o progress > 0
    return progress.filter((r) => Number(r.total_questions ?? 0) > 0 || Number(r.progress ?? 0) > 0).length;
  }, [progress]);

  const lessonsCompleted = useMemo(() => {
    return progress.filter((r) => r.completed === true).length;
  }, [progress]);

  const globalAccuracy = useMemo(() => {
    const sumCorrect = progress.reduce((acc, r) => acc + Number(r.correct_count ?? 0), 0);
    const sumTotal = progress.reduce((acc, r) => acc + Number(r.total_questions ?? 0), 0);
    return sumTotal > 0 ? Math.round((sumCorrect / sumTotal) * 100) : 0;
  }, [progress]);

  const avgScore = useMemo(() => {
    const rows = progress.filter((r) => Number(r.total_questions ?? 0) > 0);
    if (!rows.length) return 0;
    const s = rows.reduce((acc, r) => acc + Number(r.progress ?? 0), 0);
    return Math.round(s / rows.length);
  }, [progress]);

  const totalMinutesEstimated = useMemo(() => {
    // suma minutos de lecciones completadas (estimado)
    let sum = 0;
    for (const p of progress) {
      if (p.completed !== true) continue;
      const l = lessonsById.get(p.lesson_id);
      if (!l) continue;
      sum += toNumber(l.estimated_minutes);
    }
    return sum;
  }, [progress, lessonsById]);

  // --- Progreso por nivel ---
  const levelStats = useMemo(() => {
    const stats: Record<Level, { total: number; completed: number; avg: number }> = {
      A1: { total: 0, completed: 0, avg: 0 },
      A2: { total: 0, completed: 0, avg: 0 },
      B1: { total: 0, completed: 0, avg: 0 },
      B2: { total: 0, completed: 0, avg: 0 },
    };

    const sums: Record<Level, { s: number; n: number }> = {
      A1: { s: 0, n: 0 },
      A2: { s: 0, n: 0 },
      B1: { s: 0, n: 0 },
      B2: { s: 0, n: 0 },
    };

    lessons.forEach((l) => {
      stats[l.level].total += 1;

      const p = progressByLessonId.get(l.id);
      if (p?.completed === true) stats[l.level].completed += 1;

      const pr = Number(p?.progress ?? 0);
      if (Number(p?.total_questions ?? 0) > 0) {
        sums[l.level].s += pr;
        sums[l.level].n += 1;
      }
    });

    (LEVELS as Level[]).forEach((lv) => {
      stats[lv].avg = sums[lv].n > 0 ? Math.round(sums[lv].s / sums[lv].n) : 0;
    });

    return stats;
  }, [lessons, progressByLessonId]);

  // --- Lista completadas (con título/nivel) ---
  const completedList = useMemo(() => {
    const rows = progress
      .filter((p) => p.completed === true)
      .map((p) => {
        const l = lessonsById.get(p.lesson_id);
        return {
          lesson_id: p.lesson_id,
          title: l?.title ?? "Lección",
          level: (l?.level ?? p.level ?? "A1") as Level,
          order_index: toNumber(l?.order_index),
          pct: Math.round(Number(p.progress ?? 0)),
          xp: Number(p.xp_earned ?? 0),
          minutes: toNumber(l?.estimated_minutes),
        };
      });

    rows.sort((a, b) => {
      if (a.level !== b.level) return a.level.localeCompare(b.level);
      return a.order_index - b.order_index;
    });

    return rows;
  }, [progress, lessonsById]);

  // --- “Siguiente objetivo”: primera lección pendiente en el camino ---
  const nextLesson = useMemo(() => {
    const sorted = lessons
      .slice()
      .sort((a, b) => {
        if (a.level !== b.level) return a.level.localeCompare(b.level);
        return toNumber(a.order_index) - toNumber(b.order_index);
      });

    for (const l of sorted) {
      const p = progressByLessonId.get(l.id);
      const done = p?.completed === true && Number(p?.progress ?? 0) >= 80;
      if (!done) {
        const pct = Math.round(Number(p?.progress ?? 0));
        return { ...l, pct };
      }
    }
    return null;
  }, [lessons, progressByLessonId]);

  const xpFmt = new Intl.NumberFormat("es-CO").format(totalXp);

  if (loading) {
    return (
      <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
        <div className="w-full max-w-md rounded-[2.5rem] bg-white p-6 shadow-2xl">
          <div className="text-slate-700 font-semibold">Cargando estadísticas…</div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
        <div className="w-full max-w-md rounded-[2.5rem] bg-white p-6 shadow-2xl">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
            {err}
          </div>
          <div className="mt-4">
            <Link to="/profile" className="text-sm font-semibold text-blue-600 hover:underline">
              ← Volver
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
      <div className="h-full w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-gradient-to-b from-indigo-500 to-blue-500 px-6 pt-7 pb-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-white/80">Estadísticas</p>
              <h1 className="text-lg sm:text-xl font-semibold leading-snug">
                {userName}
              </h1>
              <p className="mt-1 text-[11px] text-white/80">
                {userLevel ? `Nivel actual: ${userLevel}` : "Nivel actual: —"} · Racha:{" "}
                <span className="font-semibold">{streakDays}</span> días
              </p>
            </div>

            <Link
              to="/profile"
              className="text-[11px] font-semibold underline text-white/90 hover:text-white"
            >
              Volver
            </Link>
          </div>

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm sm:text-base font-bold">{xpFmt}</p>
              <p className="text-[10px] sm:text-[11px] text-white/80">XP Total</p>
            </div>
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm sm:text-base font-bold">{lessonsCompleted}</p>
              <p className="text-[10px] sm:text-[11px] text-white/80">Completadas</p>
            </div>
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm sm:text-base font-bold">{globalAccuracy}%</p>
              <p className="text-[10px] sm:text-[11px] text-white/80">Precisión</p>
            </div>
          </div>

          {/* Extra mini stats */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] text-white/90">
              Intentadas: <b>{lessonsAttempted}</b>
            </span>
            <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] text-white/90">
              Promedio: <b>{avgScore}%</b>
            </span>
            <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] text-white/90">
              Tiempo estimado: <b>{totalMinutesEstimated} min</b>
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 bg-slate-50 px-6 pt-4 pb-3 space-y-3 overflow-y-auto">
          {/* Progreso por nivel */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Progreso por nivel</p>
                <p className="text-[11px] text-slate-400">Completadas / Total y promedio</p>
              </div>
              <div className="p-2 rounded-xl bg-blue-50"><TrendingUp size={20} className="text-blue-500" /></div>
            </div>

            <div className="mt-3 space-y-3">
              {LEVELS.map((lv) => {
                const s = levelStats[lv];
                const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;

                return (
                  <div key={lv} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800">{lv}</span>
                      <span className="text-slate-500">
                        {s.completed}/{s.total} · Promedio {s.avg}%
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${clamp(pct, 0, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Siguiente objetivo */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Siguiente objetivo</p>
                <p className="text-[11px] text-slate-400">
                  La siguiente lección pendiente en tu camino
                </p>
              </div>
              <div className="p-2 rounded-xl bg-rose-50"><Target size={20} className="text-rose-500" /></div>
            </div>

            <div className="mt-3">
              {nextLesson ? (
                <Link to={`/lessons/${nextLesson.level}/${nextLesson.id}`} className="block">
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 hover:bg-slate-100 transition flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {nextLesson.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Nivel {nextLesson.level} · Progreso {Math.round(Number(nextLesson.pct ?? 0))}%
                      </p>
                    </div>
                    <div className="p-1.5 rounded-lg bg-blue-50"><ArrowRight size={16} className="text-blue-500" /></div>
                  </div>
                </Link>
              ) : (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-900">
                  <span className="flex items-center gap-2"><Sparkles size={16} className="text-emerald-500" /> ¡Excelente! Parece que ya completaste todas las lecciones disponibles.</span>
                </div>
              )}
            </div>
          </section>

          {/* Lista de lecciones completadas */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Lecciones completadas</p>
                <p className="text-[11px] text-slate-400">
                  {completedList.length} aprobadas con ≥ 80%
                </p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50"><CheckCircle size={20} className="text-emerald-500" /></div>
            </div>

            <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
              {completedList.length === 0 ? (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
                  <span className="flex items-center gap-2">Aún no has completado lecciones. Ve a <b>Lecciones</b> y completa tu primera. <Rocket size={14} className="text-blue-500" /></span>
                </div>
              ) : (
                completedList.map((row) => (
                  <div
                    key={row.lesson_id}
                    className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{row.title}</p>
                      <p className="text-[11px] text-slate-500">
                        Nivel {row.level} · {row.pct}% · {row.minutes} min
                      </p>
                    </div>

                    <div className="shrink-0 text-[11px] font-bold text-blue-700 px-2 py-1 rounded-lg bg-blue-50 border border-blue-100">
                      +{row.xp} XP
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Acciones rápidas */}
          <section className="space-y-2">
            <Link to="/lessons" className="block">
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2">
                  <BookOpen size={20} strokeWidth={2} className="text-slate-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Ir a Lecciones</p>
                    <p className="text-[11px] text-slate-400">Practica y mejora tu precisión</p>
                  </div>
                </div>
                <span className="text-slate-300 text-xl">›</span>
              </div>
            </Link>

            <Link to="/profile" className="block">
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2">
                  <User size={20} strokeWidth={2} className="text-slate-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Volver al Perfil</p>
                    <p className="text-[11px] text-slate-400">Tu información y logros</p>
                  </div>
                </div>
                <span className="text-slate-300 text-xl">›</span>
              </div>
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}
