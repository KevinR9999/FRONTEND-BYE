import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BottomNav from "../../components/BottomNav";
import { supabase } from "../../lib/supabaseClient";

type LessonRow = {
  id: string;
  level: string;
};

// 🔧 Si tu progreso está en otra tabla/columnas, ajusta SOLO esta función.
async function fetchCompletedLessonIds(userId: string): Promise<string[]> {
  const attempts: Array<{
    table: string;
    select: string;
    userCol: string;
    completedCol?: string;
    completedVal?: boolean;
    lessonIdField: string;
  }> = [
    // ✅ opción 1 (común): lesson_progress(user_id, lesson_id, completed)
    {
      table: "lesson_progress",
      select: "lesson_id, completed",
      userCol: "user_id",
      completedCol: "completed",
      completedVal: true,
      lessonIdField: "lesson_id",
    },
    // ✅ opción 2 (común): lesson_progress(user_id, lesson_id, is_completed)
    {
      table: "lesson_progress",
      select: "lesson_id, is_completed",
      userCol: "user_id",
      completedCol: "is_completed",
      completedVal: true,
      lessonIdField: "lesson_id",
    },
    // ✅ opción 3: lesson_completions(user_id, lesson_id)
    {
      table: "lesson_completions",
      select: "lesson_id",
      userCol: "user_id",
      lessonIdField: "lesson_id",
    },
    // ✅ opción 4: user_lesson_progress(user_id, lesson_id, completed)
    {
      table: "user_lesson_progress",
      select: "lesson_id, completed",
      userCol: "user_id",
      completedCol: "completed",
      completedVal: true,
      lessonIdField: "lesson_id",
    },
  ];

  for (const a of attempts) {
    try {
      let q: any = supabase.from(a.table).select(a.select).eq(a.userCol, userId);
      if (a.completedCol) q = q.eq(a.completedCol, a.completedVal ?? true);

      const { data, error } = await q;
      if (!error && Array.isArray(data)) {
        const ids = (data as any[])
          .map((r) => r?.[a.lessonIdField])
          .filter((x) => typeof x === "string" && x.length > 0);

        // Si la tabla existe y devolvió data (aunque sea vacío), ya es la fuente correcta.
        return Array.from(new Set(ids));
      }
    } catch {
      // Si la tabla/columnas no existen, probamos la siguiente opción.
    }
  }

  return [];
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export default function LessonsHomePage() {
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✅ progreso: ids de lecciones completadas por el usuario
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      // 1) cargar usuario
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id ?? "";

      // 2) cargar lecciones (tu lógica igual)
      const { data, error } = await supabase
        .from("lessons")
        .select("id, level")
        .order("level", { ascending: true });

      if (!mounted) return;

      if (error) {
        setErrorMsg(error.message);
        setRows([]);
        setCompletedLessonIds([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as LessonRow[]);

      // 3) cargar progreso (solo si hay usuario logueado)
      if (userId) {
        const completed = await fetchCompletedLessonIds(userId);
        if (mounted) setCompletedLessonIds(completed);
      } else {
        setCompletedLessonIds([]);
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Niveles dinámicos derivados de los datos
  const dynamicLevels = useMemo(() => {
    const levelSet = new Set<string>();
    rows.forEach((r) => { if (r.level) levelSet.add(r.level); });
    // Orden: primero los conocidos (A1, A2, B1, B2), luego el resto alfabéticamente
    const knownOrder = ["A1", "A2", "B1", "B2"];
    const known = knownOrder.filter(l => levelSet.has(l));
    const rest = Array.from(levelSet).filter(l => !knownOrder.includes(l)).sort();
    return [...known, ...rest];
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => { c[r.level] = (c[r.level] || 0) + 1; });
    return c;
  }, [rows]);

  const completedCounts = useMemo(() => {
    const c: Record<string, number> = {};
    const set = new Set(completedLessonIds);
    rows.forEach((r) => {
      if (!c[r.level]) c[r.level] = 0;
      if (set.has(r.id)) c[r.level] += 1;
    });
    return c;
  }, [rows, completedLessonIds]);

  // Descripciones y subtítulos para niveles conocidos + default para nuevos
  const levelDesc: Record<string, string> = {
    A1: "Básico",
    A2: "Básico +",
    B1: "Intermedio",
    B2: "Intermedio +",
    C1: "Avanzado",
    C2: "Maestría",
  };

  const levelSub: Record<string, string> = {
    A1: "Fundamentos del idioma",
    A2: "Construcción de habilidades",
    B1: "Conversación práctica",
    B2: "Fluidez avanzada",
    C1: "Dominio del idioma",
    C2: "Nivel nativo",
  };

  type LevelUI = {
    cardBg: string;
    badgeBg: string;
    progressFill: string;
    hoverBorder: string;
    leftAccent: string;
    softGlow: string;
  };

  const levelUI: Record<string, LevelUI> = {
    A1: {
      cardBg: "bg-emerald-50/80",
      badgeBg: "bg-emerald-400",
      progressFill: "bg-emerald-400",
      hoverBorder: "hover:border-emerald-200",
      leftAccent: "bg-emerald-400",
      softGlow: "from-emerald-200/40 to-transparent",
    },
    A2: {
      cardBg: "bg-amber-50/80",
      badgeBg: "bg-amber-300",
      progressFill: "bg-amber-300",
      hoverBorder: "hover:border-amber-200",
      leftAccent: "bg-amber-300",
      softGlow: "from-amber-200/40 to-transparent",
    },
    B1: {
      cardBg: "bg-indigo-50/70",
      badgeBg: "bg-indigo-500",
      progressFill: "bg-indigo-500",
      hoverBorder: "hover:border-indigo-300",
      leftAccent: "bg-indigo-500",
      softGlow: "from-indigo-200/40 to-transparent",
    },
    B2: {
      cardBg: "bg-rose-50/80",
      badgeBg: "bg-rose-400",
      progressFill: "bg-rose-400",
      hoverBorder: "hover:border-rose-200",
      leftAccent: "bg-rose-400",
      softGlow: "from-rose-200/40 to-transparent",
    },
    C1: {
      cardBg: "bg-cyan-50/80",
      badgeBg: "bg-cyan-500",
      progressFill: "bg-cyan-500",
      hoverBorder: "hover:border-cyan-200",
      leftAccent: "bg-cyan-500",
      softGlow: "from-cyan-200/40 to-transparent",
    },
    C2: {
      cardBg: "bg-purple-50/80",
      badgeBg: "bg-purple-500",
      progressFill: "bg-purple-500",
      hoverBorder: "hover:border-purple-200",
      leftAccent: "bg-purple-500",
      softGlow: "from-purple-200/40 to-transparent",
    },
  };

  // Default para niveles nuevos no definidos arriba
  const defaultUI: LevelUI = {
    cardBg: "bg-violet-50/80",
    badgeBg: "bg-violet-500",
    progressFill: "bg-violet-500",
    hoverBorder: "hover:border-violet-200",
    leftAccent: "bg-violet-500",
    softGlow: "from-violet-200/40 to-transparent",
  };

  return (
    <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
      <div className="h-full w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Línea superior degradada (mockup) */}
        <div className="h-1 w-full bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400" />

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 sm:p-8">
            {/* Botón volver (pill) */}
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <span className="text-base leading-none">‹</span>
              Volver al inicio
            </Link>

            {/* Título (mockup style) */}
            <h1 className="mt-4 text-[2.1rem] leading-tight font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Lecciones
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Elige un nivel para ver tus lecciones.
            </p>

            {/* Estados */}
            <div className="mt-6">
              {loading && (
                <div className="space-y-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-slate-200 animate-pulse" />
                        <div className="flex-1">
                          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                          <div className="mt-2 h-3 w-44 bg-slate-200 rounded animate-pulse" />
                          <div className="mt-4 h-2 w-full bg-slate-200 rounded-full animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {errorMsg && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Error: {errorMsg}
                </div>
              )}

              {!loading && !errorMsg && (
                <div className="space-y-4">
                  {dynamicLevels.map((lvl) => {
                    const ui = levelUI[lvl] || defaultUI;
                    const total = counts[lvl] || 0;
                    const done = completedCounts[lvl] || 0;
                    const progress = total > 0 ? clamp01(done / total) : 0;

                    return (
                      <Link
                        key={lvl}
                        to={`/lessons/${lvl}`}
                        className={[
                          "group relative block overflow-hidden rounded-3xl border border-transparent p-5 shadow-sm transition",
                          ui.cardBg,
                          ui.hoverBorder,
                          "hover:shadow-md hover:-translate-y-[1px]",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60",
                        ].join(" ")}
                      >
                        {/* Glow suave */}
                        <div
                          className={[
                            "pointer-events-none absolute -top-8 -left-8 h-40 w-40 rounded-full blur-2xl opacity-70",
                            "bg-gradient-to-br",
                            ui.softGlow,
                          ].join(" ")}
                        />

                        {/* Acento lateral */}
                        <div
                          className={[
                            "pointer-events-none absolute left-0 top-0 h-full w-1.5 opacity-80",
                            ui.leftAccent,
                          ].join(" ")}
                        />

                        <div className="relative flex items-start gap-4">
                          {/* Badge nivel */}
                          <div
                            className={[
                              "h-12 w-12 rounded-2xl text-white font-extrabold flex items-center justify-center shadow-md",
                              ui.badgeBg,
                            ].join(" ")}
                          >
                            {lvl}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-lg font-bold text-slate-900">
                                  {levelDesc[lvl] || lvl}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {levelSub[lvl] || `Nivel ${lvl}`}
                                </div>
                              </div>

                              {/* Pill lecciones */}
                              <div className="shrink-0 rounded-full bg-white/70 border border-slate-200 px-3 py-1 text-xs text-slate-700 flex items-center gap-2 shadow-sm">
                                <BookOpen
                                  size={14}
                                  strokeWidth={2.5}
                                  className="text-slate-700"
                                />
                                <span>{total} lecciones</span>
                              </div>
                            </div>

                            {/* Barra progreso */}
                            <div className="mt-4 h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                              <div
                                className={["h-full rounded-full", ui.progressFill].join(" ")}
                                style={{ width: `${Math.round(progress * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <BottomNav />
      </div>
    </div>
  );
}
