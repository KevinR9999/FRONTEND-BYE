import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  getMyFriendships,
  getMyUserId,
  getProfile,
  sendFriendRequest,
} from "../../services/friendsService";
import type { FriendshipRow, PublicProfile } from "../../types/social";

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

export default function FriendProfilePage() {
  const { id } = useParams(); // friend user_id
  const friendId = id || "";
  const navigate = useNavigate();

  const [me, setMe] = useState<string>("");
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ NUEVO: stats como StatsPage pero para friendId
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsErr, setStatsErr] = useState<string | null>(null);

  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);

  // ✅ amistad robusta (no depende del orden user1/user2)
  const friendship = useMemo(() => {
    if (!me || !friendId) return null;
    return (
      friendships.find(
        (f) =>
          (f.user1 === me && f.user2 === friendId) ||
          (f.user2 === me && f.user1 === friendId)
      ) ?? null
    );
  }, [me, friendId, friendships]);

  const isFriend = friendship?.status === "accepted";
  const isPending = friendship?.status === "pending";

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

  // --- métricas iguales a StatsPage ---
  const totalXp = useMemo(() => progress.reduce((acc, r) => acc + Number(r.xp_earned ?? 0), 0), [progress]);

  const lessonsAttempted = useMemo(() => {
    return progress.filter((r) => Number(r.total_questions ?? 0) > 0 || Number(r.progress ?? 0) > 0).length;
  }, [progress]);

  const lessonsCompleted = useMemo(() => progress.filter((r) => r.completed === true).length, [progress]);

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

  const xpFmt = useMemo(() => new Intl.NumberFormat("es-CO").format(totalXp), [totalXp]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);

        const uid = await getMyUserId();
        if (!mounted) return;
        setMe(uid);

        const f = await getMyFriendships();
        if (!mounted) return;
        setFriendships(f);

        const p = await getProfile(friendId);
        if (!mounted) return;
        setProfile(p);

        // ✅ stats solo si son amigos
        const rel =
          f.find(
            (row) =>
              (row.user1 === uid && row.user2 === friendId) ||
              (row.user2 === uid && row.user1 === friendId)
          ) ?? null;

        const accepted = rel?.status === "accepted";

        // reset
        setStatsErr(null);
        setLessons([]);
        setProgress([]);
        setStreakDays(0);
        setUserLevel(null);

        if (!accepted) return;

        setStatsLoading(true);

        // ✅ 1) profiles: level + streak_days (igual StatsPage)
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("level, streak_days")
          .eq("user_id", friendId)
          .maybeSingle();

        if (profErr) throw profErr;

        const pr = (prof ?? null) as ProfileRow | null;
        if (!mounted) return;
        setUserLevel(pr?.level ?? p?.level ?? null);
        setStreakDays(Number(pr?.streak_days ?? 0));

        // ✅ 2) lessons catálogo
        const { data: lessonsData, error: lessonsErr } = await supabase
          .from("lessons")
          .select("id, level, title, order_index, estimated_minutes")
          .order("level", { ascending: true })
          .order("order_index", { ascending: true });

        if (lessonsErr) throw lessonsErr;

        // ✅ 3) lesson_progress del amigo
        const { data: progData, error: progErr } = await supabase
          .from("lesson_progress")
          .select("user_id, lesson_id, level, progress, completed, correct_count, total_questions, xp_earned")
          .eq("user_id", friendId);

        if (progErr) throw progErr;

        if (!mounted) return;
        setLessons((lessonsData ?? []) as LessonRow[]);
        setProgress((progData ?? []) as ProgressRow[]);
      } catch (e: any) {
        console.error(e);
        if (!mounted) return;
        setStatsErr(e?.message ?? "Error cargando estadísticas");
      } finally {
        if (mounted) {
          setStatsLoading(false);
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [friendId]);

  async function handleAdd() {
    try {
      setSending(true);
      setError(null);
      await sendFriendRequest(friendId);
      const f = await getMyFriendships();
      setFriendships(f);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "No se pudo enviar la solicitud");
    } finally {
      setSending(false);
    }
  }

  if (!friendId) {
    return <div className="min-h-screen bg-slate-50 p-6 text-slate-700">Usuario inválido</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <button onClick={() => navigate(-1)} className="text-slate-700 font-semibold">
          ← Volver
        </button>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-slate-600">Cargando…</div>
        ) : !profile ? (
          <div className="mt-6 text-slate-600">No se encontró el usuario.</div>
        ) : (
          <>
            {/* ✅ tu header NO lo cambio */}
            <div className="mt-4 rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-3">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="avatar"
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xl">
                    {(profile.full_name?.[0] || "U").toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-900 truncate">
                    {profile.full_name || "Usuario"}
                  </div>
                  <div className="text-slate-600 truncate">Nivel {userLevel ?? profile.level ?? "—"}</div>
                </div>

                <div className="ml-auto flex gap-2">
                  {isFriend ? (
                    <button
                      onClick={() => navigate(`/friends/chat/${profile.user_id}`)}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-white font-semibold"
                    >
                      Chatear
                    </button>
                  ) : isPending ? (
                    <span className="rounded-xl bg-slate-100 px-4 py-2 text-slate-700 font-semibold">
                      Pendiente
                    </span>
                  ) : (
                    <button
                      onClick={handleAdd}
                      disabled={sending}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-white font-semibold disabled:opacity-50"
                    >
                      {sending ? "Enviando…" : "Agregar"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ✅ SOLO CAMBIO ESTA PARTE: ESTADÍSTICAS (mockup + data StatsPage) */}
            <div className="mt-5 rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900">Estadísticas</h2>
              <p className="text-slate-600 text-sm">
                {isFriend
                  ? "Estas estadísticas se muestran porque son amigos."
                  : "Las estadísticas completas se muestran cuando sean amigos."}
              </p>

              {!isFriend ? (
                <div className="mt-4 text-slate-600">
                  No disponible (aún no son amigos o la privacidad lo limita).
                </div>
              ) : statsLoading ? (
                <div className="mt-4 text-slate-600">Cargando estadísticas…</div>
              ) : statsErr ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
                  {statsErr}
                </div>
              ) : (
                <>
                  {/* Summary mockup */}
                  <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-700">
                        Nivel actual: <span className="font-semibold">{userLevel ?? profile.level ?? "—"}</span>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                        🔥 {streakDays} días
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-700 shadow-sm">
                          ⚡
                        </div>
                        <div className="text-2xl font-extrabold text-slate-900">{xpFmt}</div>
                        <div className="text-[11px] text-slate-500">XP Total</div>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm">
                          ✅
                        </div>
                        <div className="text-2xl font-extrabold text-slate-900">{lessonsCompleted}</div>
                        <div className="text-[11px] text-slate-500">Completadas</div>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-indigo-700 shadow-sm">
                          🎯
                        </div>
                        <div className="text-2xl font-extrabold text-slate-900">{globalAccuracy}%</div>
                        <div className="text-[11px] text-slate-500">Precisión</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                      <div className="text-center">Intentadas: <b className="text-slate-700">{lessonsAttempted}</b></div>
                      <div className="text-center">Promedio: <b className="text-slate-700">{avgScore}%</b></div>
                      <div className="text-center">Tiempo estimado: <b className="text-slate-700">{totalMinutesEstimated} min</b></div>
                    </div>
                  </div>

                  {/* Progreso por nivel */}
                  <div className="mt-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">Progreso por nivel</div>
                        <div className="text-[11px] text-slate-400">Completadas / Total y promedio</div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-3">
                      {LEVELS.map((lv) => {
                        const s = levelStats[lv];
                        const pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;

                        return (
                          <div key={lv} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                            <div className="flex items-center justify-between text-[12px]">
                              <span className="font-semibold text-slate-800">{lv}</span>
                              <span className="text-slate-500">
                                {s.completed}/{s.total} · Promedio {s.avg}%
                              </span>
                            </div>
                            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-violet-500 transition-all"
                                style={{ width: `${clamp(pct, 0, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Siguiente objetivo */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">Siguiente objetivo</div>
                        <div className="text-[11px] text-slate-400">La siguiente lección pendiente del usuario</div>
                      </div>
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700 shadow-sm">
                        🎯
                      </div>
                    </div>

                    <div className="mt-3">
                      {nextLesson ? (
                        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {nextLesson.title}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Nivel {nextLesson.level} · Progreso: {Math.round(Number(nextLesson.pct ?? 0))}%
                            </p>
                          </div>
                          <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-blue-700 shadow-sm">
                            📖
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-900">
                          🎉 Ya completó todas las lecciones disponibles.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lecciones completadas */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">Lecciones completadas</div>
                        <div className="text-[11px] text-slate-400">
                          {completedList.length} aprobadas con ≥ 80%
                        </div>
                      </div>
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm">
                        ✅
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                      {completedList.length === 0 ? (
                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600 text-center">
                          Aún no ha completado lecciones
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
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
