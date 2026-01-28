import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Home, BookOpen, Trophy, User } from "lucide-react";
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
    <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
      <div className="h-full w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto">
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
                <div className="lessons-scroll space-y-3 pr-2">
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
          </div>
        </div>

        {/* NAV INFERIOR */}
        <nav className="border-t border-slate-200 bg-white px-6 py-3 flex justify-around text-[11px]">
          <Link to="/" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
            <Home size={26} strokeWidth={2.5} className="stroke-current" />
            <span>Inicio</span>
          </Link>

          <Link to="/lessons" className="flex flex-col items-center gap-1.5 text-indigo-600 transition-colors">
            <BookOpen size={26} strokeWidth={2.5} className="stroke-current" />
            <span className="font-medium">Lecciones</span>
          </Link>

          <Link to="/rankings" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
            <Trophy size={26} strokeWidth={2.5} className="stroke-current" />
            <span>Rankings</span>
          </Link>

          <Link to="/profile" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
            <User size={26} strokeWidth={2.5} className="stroke-current" />
            <span>Perfil</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
