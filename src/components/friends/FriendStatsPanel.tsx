import { useEffect, useMemo, useState } from "react";
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

export default function FriendStatsPanel({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
        // Profile: nivel + racha (igual que StatsPage)
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("level, streak_days")
          .eq("user_id", userId)
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

        // Progress del usuario (amigo)
        const { data: progData, error: progErr } = await supabase
          .from("lesson_progress")
          .select("user_id, lesson_id, level, progress, completed, correct_count, total_questions, xp_earned")
          .eq("user_id", userId);

        if (progErr) throw progErr;

        if (!alive) return;
        setLessons((lessonsData ?? []) as LessonRow[]);
        setProgress((progData ?? []) as ProgressRow[]);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setErr(e?.message ?? "Error cargando estadísticas del usuario");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

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

  const totalXp = useMemo(() => {
    return progress.reduce((acc, r) => acc + Number(r.xp_earned ?? 0), 0);
  }, [progress]);

  const lessonsAttempted = useMemo(() => {
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
    let sum = 0;
    for (const p of progress) {
      if (p.completed !== true) continue;
      const l = lessonsById.get(p.lesson_id);
      if (!l) continue;
      sum += toNumber(l.estimated_minutes);
    }
    return sum;
  }, [progress, lessonsById]);

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

    LEVELS.forEach((lv) => {
      stats[lv].avg = sums[lv].n > 0 ? Math.round(sums[lv].s / sums[lv].n) : 0;
    });

    return stats;
  }, [lessons, progressByLessonId]);

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
    return <div className="text-slate-600">Cargando estadísticas…</div>;
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
        {err}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {/* mini header (sin cambiar tu layout principal) */}
      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
        <div className="text-sm font-semibold text-slate-900">
          Nivel actual: {userLevel ? userLevel : "—"} · Racha: <span className="font-bold">{streakDays}</span> días
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="bg-white rounded-2xl px-2.5 py-2 border border-slate-100">
            <p className="text-sm sm:text-base font-bold text-slate-900">{xpFmt}</p>
            <p className="text-[10px] sm:text-[11px] text-slate-500">XP Total</p>
          </div>
          <div className="bg-white rounded-2xl px-2.5 py-2 border border-slate-100">
            <p className="text-sm sm:text-base font-bold text-slate-900">{lessonsCompleted}</p>
            <p className="text-[10px] sm:text-[11px] text-slate-500">Completadas</p>
          </div>
          <div className="bg-white rounded-2xl px-2.5 py-2 border border-slate-100">
            <p className="text-sm sm:text-base font-bold text-slate-900">{globalAccuracy}%</p>
            <p className="text-[10px] sm:text-[11px] text-slate-500">Precisión</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white border border-slate-100 px-3 py-1 text-[11px] text-slate-700">
            Intentadas: <b>{lessonsAttempted}</b>
          </span>
          <span className="rounded-full bg-white border border-slate-100 px-3 py-1 text-[11px] text-slate-700">
            Promedio: <b>{avgScore}%</b>
          </span>
          <span className="rounded-full bg-white border border-slate-100 px-3 py-1 text-[11px] text-slate-700">
            Tiempo estimado: <b>{totalMinutesEstimated} min</b>
          </span>
        </div>
      </div>

      {/* Progreso por nivel */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Progreso por nivel</p>
            <p className="text-[11px] text-slate-400">Completadas / Total y promedio</p>
          </div>
          <span className="text-lg">📈</span>
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
                    className="h-full rounded-full bg-violet-500 transition-all"
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
            <p className="text-[11px] text-slate-400">La siguiente lección pendiente del usuario</p>
          </div>
          <span className="text-lg">🎯</span>
        </div>

        <div className="mt-3">
          {nextLesson ? (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{nextLesson.title}</p>
                <p className="text-[11px] text-slate-500">
                  Nivel {nextLesson.level} · Progreso {Math.round(Number(nextLesson.pct ?? 0))}%
                </p>
              </div>
              <div className="text-xl">➡️</div>
            </div>
          ) : (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-900">
              🎉 ¡Excelente! Parece que ya completó todas las lecciones disponibles.
            </div>
          )}
        </div>
      </section>

      {/* Lecciones completadas */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Lecciones completadas</p>
            <p className="text-[11px] text-slate-400">{completedList.length} aprobadas con ≥ 80%</p>
          </div>
          <span className="text-lg">✅</span>
        </div>

        <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
          {completedList.length === 0 ? (
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
              Aún no ha completado lecciones.
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

                <div className="shrink-0 text-[11px] font-bold text-violet-700 px-2 py-1 rounded-lg bg-violet-50 border border-violet-100">
                  +{row.xp} XP
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
