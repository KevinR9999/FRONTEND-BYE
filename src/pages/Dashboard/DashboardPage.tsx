// src/pages/Dashboard/DashboardPage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, BookOpen, Trophy, User, Settings } from "lucide-react";
import DiagnosticModal from "../../components/DiagnosticModal";
import { InstallBanner } from "../../components/InstallPWA";
import { supabase } from "../../lib/supabaseClient";
import { useAuthStore } from "../../store/authStore";

type ProfileRow = {
  diagnostic_completed: boolean | null;
  level: string | null;
  xp_total: number | null;
  lessons_completed: number | null;
  streak_days: number | null;
};

type LessonProgressRow = {
  correct_count: number | null;
  total_questions: number | null;
};

export default function DashboardPage() {
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const navigate = useNavigate();

  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [userName, setUserName] = useState("Usuario");
  const [userInitials, setUserInitials] = useState("U");
  const [userEmail, setUserEmail] = useState("");

  // ✅ stats reales
  const [xpTotal, setXpTotal] = useState(0);
  const [lessonsDone, setLessonsDone] = useState(0);
  const [accuracyPct, setAccuracyPct] = useState(0);
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadUserData = async () => {
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) console.error("❌ supabase.auth.getUser error:", userErr);

        if (!user) {
          navigate("/login");
          return;
        }

        // Guardar email
        if (!mounted) return;
        setUserEmail(user.email || "");

        // ✅ Obtener nombre SOLO de user_metadata (NO de profile)
        let finalName = "Usuario";
        if ((user.user_metadata as any)?.full_name) finalName = (user.user_metadata as any).full_name;
        else if ((user.user_metadata as any)?.name) finalName = (user.user_metadata as any).name;
        else if (user.email) finalName = user.email.split("@")[0];

        if (!mounted) return;
        setUserName(finalName);

        // ✅ FIX: Iniciales (antes tenías el if/else roto)
        const names = finalName.trim().split(" ").filter(Boolean);
        if (names.length >= 2) {
          setUserInitials((names[0][0] || "U").toUpperCase() + (names[1][0] || "U").toUpperCase());
        } else {
          setUserInitials((names[0]?.[0] || "U").toUpperCase());
        }

        console.log("📂 Cargando datos para user:", user.id);

        // ✅ Leer profile (usa user_id, NO id) - incluye streak_days
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("diagnostic_completed, level, xp_total, lessons_completed, streak_days")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("❌ Error al leer profile:", profileError);
        }

        const p = (profile ?? null) as ProfileRow | null;

        if (!mounted) return;

        // Nivel del usuario
        setUserLevel(p?.level ?? null);

        // XP y lecciones (si existen en profiles)
        setXpTotal(Number(p?.xp_total ?? 0));
        setLessonsDone(Number(p?.lessons_completed ?? 0));
        setStreakDays(Number(p?.streak_days ?? 0));

        // ✅ Mostrar modal SOLO si NO ha completado diagnóstico
        const diagnosticDone = Boolean(p?.diagnostic_completed);
        setShowDiagnosticModal(!diagnosticDone);

        // ✅ Precisión real desde lesson_progress
        const { data: progRows, error: progErr } = await supabase
          .from("lesson_progress")
          .select("correct_count, total_questions")
          .eq("user_id", user.id);

        if (progErr) {
          console.error("❌ Error leyendo lesson_progress:", progErr);
        }

        const rows = (Array.isArray(progRows) ? (progRows as LessonProgressRow[]) : []) as LessonProgressRow[];

        const sumCorrect = rows.reduce((acc, r) => acc + Number(r.correct_count ?? 0), 0);
        const sumTotal = rows.reduce((acc, r) => acc + Number(r.total_questions ?? 0), 0);

        const pct = sumTotal > 0 ? Math.round((sumCorrect / sumTotal) * 100) : 0;
        if (!mounted) return;
        setAccuracyPct(pct);
      } catch (error) {
        console.error("❌ Error en loadUserData:", error);
      }
    };

    loadUserData();

    // refrescar al volver a la pestaña
    const onFocus = () => {
      loadUserData();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const xpFmt = new Intl.NumberFormat("es-CO").format(xpTotal);

  return (
    <>
      {/* ✅ Modal diagnóstico */}
      <DiagnosticModal isOpen={showDiagnosticModal} onClose={() => setShowDiagnosticModal(false)} />

      <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
        <div className="h-full w-full max-w-md md:max-w-lg bg-white rounded-[2.5rem] shadow-2xl flex flex-col justify-between overflow-hidden">
          <div>
            <header className="bg-gradient-to-br from-indigo-500 to-violet-500 px-5 sm:px-6 pt-5 pb-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm opacity-80">¡Hola!</p>
                  <h1 className="text-xl sm:text-2xl font-bold leading-snug">{userName}</h1>
                  <p className="text-[11px] sm:text-xs text-white/80">Continúa tu viaje de aprendizaje</p>
                  {userEmail ? <p className="text-[10px] sm:text-[11px] text-white/70">{userEmail}</p> : null}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
                    {userInitials}
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-[10px] sm:text-xs text-white/90 underline hover:text-white"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 bg-white/15 rounded-2xl px-4 py-2.5 flex items-center justify-between backdrop-blur">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔥</span>
                    <div>
                      <p className="text-[11px] opacity-80">Racha</p>
                      <p className="text-sm font-semibold">{streakDays} días</p>
                    </div>
                  </div>
                </div>

                <div className="px-3 py-2 rounded-2xl bg-white/20 border border-white/40 text-[11px] font-medium backdrop-blur">
                  {userLevel ? `Nivel ${userLevel}` : "Nivel —"}
                </div>
              </div>
            </header>

            <main className="px-5 sm:px-6 pt-3 pb-3 space-y-4">
              <section className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-100 px-3 py-2.5 text-center space-y-1">
                  <p className="text-[11px] text-slate-400">XP Total</p>
                  <p className="text-lg font-bold text-slate-900">{xpFmt}</p>
                </div>

                <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-100 px-3 py-2.5 text-center space-y-1">
                  <p className="text-[11px] text-slate-400">Lecciones</p>
                  <p className="text-lg font-bold text-slate-900">{lessonsDone}</p>
                </div>

                <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-100 px-3 py-2.5 text-center space-y-1">
                  <p className="text-[11px] text-slate-400">Precisión</p>
                  <p className="text-lg font-bold text-slate-900">{accuracyPct}%</p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm sm:text-base font-semibold text-slate-900">Continúa aprendiendo</h2>

                <Link to="/lessons" className="block">
                  <div className="bg-slate-50 rounded-2xl px-4 py-3 shadow-sm border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-100 transition">
                    <div className="space-y-1">
                      <p className="text-sm sm:text-base font-semibold text-slate-900">Ir a Lecciones</p>
                      <p className="text-[11px] sm:text-xs text-slate-500">
                        {userLevel ? `Nivel ${userLevel}` : "Selecciona un nivel"} · Practica y gana XP
                      </p>
                    </div>
                    <div className="text-xl">➡️</div>
                  </div>
                </Link>

                {/* Admin Panel Link - Solo visible para admins */}
                {isAdmin && (
                  <Link to="/admin" className="block">
                    <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between gap-3 hover:opacity-90 transition">
                      <div className="space-y-1">
                        <p className="text-sm sm:text-base font-semibold text-white">Panel de Administración</p>
                        <p className="text-[11px] sm:text-xs text-white/80">
                          Gestionar usuarios, lecciones y contenido
                        </p>
                      </div>
                      <Settings size={24} className="text-white" />
                    </div>
                  </Link>
                )}

                {/* Banner de instalación PWA */}
                <InstallBanner />
              </section>
            </main>
          </div>

          <nav className="border-t border-slate-200 bg-white px-6 py-3 flex justify-around text-[11px]">
            <Link to="/" className="flex flex-col items-center gap-1.5 text-indigo-600 transition-colors">
              <Home size={26} strokeWidth={2.5} className="stroke-current" />
              <span className="font-medium">Inicio</span>
            </Link>

            <Link to="/lessons" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
              <BookOpen size={26} strokeWidth={2.5} className="stroke-current" />
              <span>Lecciones</span>
            </Link>

            <button type="button" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
              <Trophy size={26} strokeWidth={2.5} className="stroke-current" />
              <span>Rankings</span>
            </button>

            <Link to="/profile" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
              <User size={26} strokeWidth={2.5} className="stroke-current" />
              <span>Perfil</span>
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
