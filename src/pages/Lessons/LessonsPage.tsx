// src/pages/Lessons/LessonsPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

interface LessonRow {
  id: string;
  title: string;
  level: string;
  order_index: number;
  estimated_minutes: number | null;
}

interface LessonWithSlug extends LessonRow {
  slug: string;
}

const slugify = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const LOCAL_META: Record<
  string,
  {
    focus: string;
  }
> = {
  "present-simple": { focus: "Hábitos y rutinas" },
  "past-simple": { focus: "Acciones terminadas en el pasado" },
  "present-continuous": { focus: "Acciones en progreso ahora" },
  "future-with-will": { focus: "Decisiones espontáneas y predicciones" },
};

export default function LessonsPage() {
  const [lessons, setLessons] = useState<LessonWithSlug[]>([]);
  const [progressBySlug, setProgressBySlug] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Usuario
        const { data: userData, error: userError } = await supabase.auth.getUser();

        // Lecciones desde la tabla lessons
        const { data: lessonsData, error: lessonsError } = await supabase
          .from("lessons")
          .select("*")
          .order("order_index", { ascending: true });

        if (lessonsError) {
          console.error("Error cargando lessons:", lessonsError);
        }

        const mappedLessons: LessonWithSlug[] =
          (lessonsData as LessonRow[] | null)?.map((row) => ({
            ...row,
            slug: slugify(row.title),
          })) ?? [];

        setLessons(mappedLessons);

        if (userError || !userData?.user) {
          setLoading(false);
          return;
        }

        // Progreso por usuario
        const { data: progressRows, error: progressError } = await supabase
          .from("user_lesson_progress")
          .select("lesson_id, percentage")
          .eq("user_id", userData.user.id);

        if (progressError) {
          console.error("Error cargando progreso de lecciones:", progressError);
          setLoading(false);
          return;
        }

        const progressMap: Record<string, number> = {};
        for (const lesson of mappedLessons) {
          const match = (progressRows || []).find(
            (row: any) => row.lesson_id === lesson.id
          );
          progressMap[lesson.slug] = match?.percentage ?? 0;
        }

        setProgressBySlug(progressMap);
      } catch (err) {
        console.error("Error inesperado cargando lecciones:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      {/* Contenedor tipo teléfono */}
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-[2.5rem] shadow-2xl px-6 sm:px-7 py-6 sm:py-7 flex flex-col h-[90vh] max-h-[800px]">
        {/* HEADER */}
        <header className="mb-4 sm:mb-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <Link
              to="/"
              className="text-[11px] sm:text-xs text-violet-500 hover:underline"
            >
              ← Volver al inicio
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Lecciones
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Practica tiempos verbales y tus habilidades de listening, reading,
            writing y speaking.
          </p>
        </header>

        {/* LISTA DE LECCIONES */}
        <main className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading && (
            <p className="text-xs sm:text-sm text-slate-400">
              Cargando lecciones...
            </p>
          )}

          {!loading &&
            lessons.map((lesson) => {
              const progress = progressBySlug[lesson.slug] ?? 0;
              const meta = LOCAL_META[lesson.slug];

              return (
                <Link
                  key={lesson.id}
                  to={`/lessons/${lesson.slug}`}
                  className="block"
                >
                  <div className="bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100 hover:bg-slate-100 transition flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm sm:text-base font-semibold text-slate-900">
                        {lesson.title}
                      </p>
                      <p className="text-[11px] sm:text-xs text-slate-500">
                        {lesson.level} · {lesson.estimated_minutes ?? 10} min
                      </p>
                      <p className="text-[11px] sm:text-xs text-slate-500">
                        {meta?.focus ?? "Práctica de tiempo verbal"}
                      </p>
                      <p className="text-[11px] sm:text-xs text-slate-400">
                        Skills: Listening · Reading · Writing · Speaking
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs sm:text-sm text-slate-500">
                        {progress}%
                      </span>
                      <div className="w-14 sm:w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

          {!loading && lessons.length === 0 && (
            <p className="text-xs sm:text-sm text-slate-400">
              No hay lecciones configuradas en la base de datos.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
