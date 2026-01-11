import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DiagnosticModal from "../../components/DiagnosticModal";
import { supabase } from "../../lib/supabaseClient";
import { useAuthStore } from "../../store/authStore";

export default function DashboardPage() {
  const logout = useAuthStore((s) => s.logout);
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

  useEffect(() => {
    let mounted = true;

    async function loadUserData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          navigate("/login");
          return;
        }

        console.log('📂 Cargando datos para user:', user.id);

        // ✅ CORREGIDO: Leer solo campos que existen en la tabla
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('diagnostic_completed, level')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('❌ Error al leer profile:', profileError);
        }

        console.log('👤 Profile leído:', profile);
        console.log('📋 diagnostic_completed:', profile?.diagnostic_completed);

        //  Guardar email
        setUserEmail(user.email || "");

        // ✅ CORREGIDO: Obtener nombre SOLO de user_metadata (NO de profile)
        let finalName = "Usuario";
        if (user.user_metadata?.full_name) finalName = user.user_metadata.full_name;
        else if (user.user_metadata?.name) finalName = user.user_metadata.name;
        else if (user.email) finalName = user.email.split("@")[0];

        if (!mounted) return;

        setUserName(finalName);

        // Iniciales
        const names = finalName.trim().split(" ");
        if (names.length >= 2)
          setUserInitials(names[0][0].toUpperCase() + names[1][0].toUpperCase());
        } else {
          setUserInitials(names[0][0].toUpperCase());
        }

        // ✅ Mostrar modal SOLO si NO ha completado diagnóstico
        if (!profile?.diagnostic_completed) {
          console.log('⚠️ Usuario NO ha completado diagnóstico, mostrando modal');
          setShowDiagnosticModal(true);
        } else {
          console.log('✅ Usuario YA completó diagnóstico, NO mostrar modal');
          setShowDiagnosticModal(false);
        }
      } catch (error) {
        console.error("❌ Error en loadUserData:", error);
      }
    }

    loadUserData();

    // refrescar al volver a la pestaña
    const onFocus = () => loadUserData();
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
  };

  const xpFmt = new Intl.NumberFormat("es-CO").format(xpTotal);

  return (
    <>
      {/* ✅ Modal diagnóstico */}
      <DiagnosticModal 
        isOpen={showDiagnosticModal} 
        onClose={() => setShowDiagnosticModal(false)} 
      />

      <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
        <div className="h-full w-full max-w-md md:max-w-lg bg-white rounded-[2.5rem] shadow-2xl flex flex-col justify-between overflow-hidden">
          <div>
            <header className="bg-gradient-to-br from-indigo-500 to-violet-500 px-5 sm:px-6 pt-5 pb-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm opacity-80">¡Hola!</p>
                  <h1 className="text-xl sm:text-2xl font-bold leading-snug">{userName}</h1>
                  <p className="text-[11px] sm:text-xs text-white/80">
                    Continúa tu viaje de aprendizaje
                  </p>
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
                      <p className="text-sm font-semibold">7 días</p>
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
                <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                  Continúa aprendiendo
                </h2>

                <Link to="/lessons" className="block">
                  <div className="bg-slate-50 rounded-2xl px-4 py-3 shadow-sm border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-100 transition">
                    <div className="space-y-1">
                      <p className="text-sm sm:text-base font-semibold text-slate-900">
                        Ir a Lecciones
                      </p>
                      <p className="text-[11px] sm:text-xs text-slate-500">
                        {userLevel ? `Nivel ${userLevel}` : "Selecciona un nivel"} · Practica y gana XP
                      </p>
                    </div>
                    <div className="text-xl">➡️</div>
                  </div>
                </Link>
              </section>
            </main>
          </div>

          <nav className="border-t border-slate-100 bg-white px-6 py-2.5 flex justify-between text-[11px] sm:text-xs">
            <Link to="/" className="flex flex-col items-center gap-1 text-violet-500">
              <span className="text-xl">🏠</span>
              <span className="font-medium">Inicio</span>
            </Link>

            <Link to="/lessons" className="flex flex-col items-center gap-1 text-slate-400 hover:text-violet-500">
              <span className="text-xl">📘</span>
              <span>Lecciones</span>
            </Link>

            <button type="button" className="flex flex-col items-center gap-1 text-slate-400">
              <span className="text-xl">🏆</span>
              <span>Rankings</span>
            </button>

            <Link to="/profile" className="flex flex-col items-center gap-1 text-slate-400 hover:text-violet-500">
              <span className="text-xl">👤</span>
              <span>Perfil</span>
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
