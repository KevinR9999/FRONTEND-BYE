// src/pages/Profile/StatsPage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type LessonProgress = {
  id: string;
  lesson_id: string | null;
  percentage: number | null;
  is_completed: boolean | null;
  lesson_title: string | null;
  lesson_level: string | null;
  updated_at: string | null;
};

export default function StatsPage() {
  const [progressList, setProgressList] = useState<LessonProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadStats = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          navigate("/login");
          return;
        }

        const user = data.user;

        const { data: progressRows, error: progressError } = await supabase
          .from("user_lesson_progress")
          .select(
            "id, lesson_id, percentage, is_completed, lesson_title, lesson_level, updated_at"
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (progressError) {
          console.error("Error cargando progreso de lecciones:", progressError);
          setProgressList([]);
        } else if (progressRows) {
          setProgressList(progressRows as LessonProgress[]);
        }
      } catch (err) {
        console.error("Error inesperado cargando estadísticas:", err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [navigate]);

  const totalLessons = progressList.length;
  const completedLessons = progressList.filter((p) => p.is_completed).length;
  const avgPercentage =
    totalLessons === 0
      ? 0
      : Math.round(
          progressList.reduce(
            (sum, p) => sum + (p.percentage ?? 0),
            0
          ) / totalLessons
        );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-sm sm:max-w-md h-[90vh] max-h-[820px] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="bg-gradient-to-b from-indigo-500 to-violet-500 px-6 pt-6 pb-4 text-white rounded-t-[2.5rem]">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="text-sm text-white/90 hover:text-white"
            >
              ← Perfil
            </button>
            <span className="text-[11px] text-white/80">
              Estadísticas de lecciones
            </span>
          </div>

          <h1 className="text-lg sm:text-xl font-semibold">
            Progreso y rendimiento
          </h1>
          <p className="text-[11px] sm:text-xs text-white/80 mt-1">
            Revisa cómo vas en cada lección
          </p>

          {/* Resumen */}
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm font-bold">{totalLessons}</p>
              <p className="text-[10px] text-white/80">Lecciones</p>
            </div>
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm font-bold">{completedLessons}</p>
              <p className="text-[10px] text-white/80">Completadas</p>
            </div>
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm font-bold">{avgPercentage}%</p>
              <p className="text-[10px] text-white/80">Promedio</p>
            </div>
          </div>
        </header>

        {/* CONTENIDO */}
        <main className="flex-1 bg-slate-50 px-6 pt-3 pb-3 overflow-y-auto">
          {loading ? (
            <p className="text-[11px] text-slate-500">
              Cargando progreso de lecciones...
            </p>
          ) : progressList.length === 0 ? (
            <p className="text-[11px] text-slate-500">
              Aún no has realizado ninguna lección. Completa tu primera
              lección para ver estadísticas aquí.
            </p>
          ) : (
            <ul className="space-y-3">
              {progressList.map((p) => {
                const percentage = Math.min(p.percentage ?? 0, 100);

                return (
                  <li
                    key={p.id}
                    className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {p.lesson_title || "Lección"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {p.lesson_level || "Nivel desconocido"}
                        {p.updated_at && (
                          <>
                            {" · "}
                            Actualizado{" "}
                            {new Date(p.updated_at).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[11px] text-slate-600">
                        {percentage}%
                      </span>
                      <div className="w-16 sm:w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      {p.is_completed && (
                        <span className="text-[9px] text-emerald-600 font-medium">
                          Completada ✓
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>

        {/* NAV INFERIOR (opcional, igual que Perfil) */}
        <nav className="border-t border-slate-100 bg-white px-6 py-2.5 flex justify-between text-[11px] sm:text-xs">
          <Link
            to="/"
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-violet-500"
          >
            <span className="text-xl">🏠</span>
            <span className="font-medium">Inicio</span>
          </Link>

          <Link
            to="/lessons"
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-violet-500"
          >
            <span className="text-xl">📘</span>
            <span>Lecciones</span>
          </Link>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <span className="text-xl">🏆</span>
            <span>Rankings</span>
          </button>

          <Link
            to="/profile"
            className="flex flex-col items-center gap-1 text-violet-500"
          >
            <span className="text-xl">👤</span>
            <span className="font-medium">Perfil</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
