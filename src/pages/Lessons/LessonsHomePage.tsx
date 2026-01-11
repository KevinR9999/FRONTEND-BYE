import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type Level = "A1" | "A2" | "B1" | "B2";

type LessonRow = {
  id: string;
  level: Level;
};

const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

export default function LessonsHomePage() {
  const [rows, setRows] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("lessons")
        .select("id, level")
        .order("level", { ascending: true });

      if (!mounted) return;

      if (error) {
        setErrorMsg(error.message);
        setRows([]);
      } else {
        setRows(((data ?? []) as LessonRow[]).filter((r) => LEVELS.includes(r.level)));
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
    rows.forEach((r) => (c[r.level] += 1));
    return c;
  }, [rows]);

  const levelDesc: Record<Level, string> = {
    A1: "Básico",
    A2: "Básico +",
    B1: "Intermedio",
    B2: "Intermedio +",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-100 to-slate-200 px-4 py-8">
      <div className="mx-auto w-full max-w-lg rounded-[2.25rem] bg-white shadow-2xl">
        <div className="p-6 sm:p-8">
          <Link to="/" className="text-xs text-slate-500 hover:underline">
            ← Volver al inicio
          </Link>

          <h1 className="mt-2 text-2xl font-bold text-slate-900">Lecciones</h1>
          <p className="mt-1 text-sm text-slate-600">
            Elige un nivel para ver sus lecciones.
          </p>

          <div className="mt-6 rounded-3xl bg-slate-50/80 p-4">
            {loading && <p className="text-sm text-slate-600">Cargando niveles...</p>}

            {errorMsg && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Error: {errorMsg}
              </div>
            )}

            {!loading && !errorMsg && (
              <div className="lessons-scroll max-h-[56vh] space-y-3 overflow-y-auto pr-2">
                {LEVELS.map((lvl) => (
                  <Link
                    key={lvl}
                    to={`/lessons/${lvl}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-900">{lvl}</div>
                        <div className="text-xs text-slate-500">{levelDesc[lvl]}</div>
                      </div>
                      <div className="text-xs text-slate-600">{counts[lvl]} lecciones</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}
