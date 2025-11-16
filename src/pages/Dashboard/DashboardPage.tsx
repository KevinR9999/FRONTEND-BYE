// src/pages/Dashboard/DashboardPage.tsx
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function DashboardPage() {
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-3 sm:px-4 py-4">
      {/* Contenedor tipo teléfono, sin scroll interno */}
      <div className="w-full max-w-md md:max-w-lg bg-white rounded-[2.5rem] shadow-2xl flex flex-col px-5 sm:px-6 pt-5 pb-3">
        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 flex flex-col gap-5 sm:gap-6">
          {/* HEADER GRADIENT */}
          <header className="bg-gradient-to-br from-indigo-500 to-violet-500 rounded-3xl text-white px-4 sm:px-5 pt-4 pb-4 sm:pb-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm opacity-80">¡Hola!</p>
                <h1 className="text-xl sm:text-2xl font-bold leading-snug">
                  Juan Pérez
                </h1>
                <p className="text-[11px] sm:text-xs text-white/80">
                  Continúa tu viaje de aprendizaje
                </p>
              </div>

              {/* Avatar + logout */}
              <div className="flex flex-col items-end gap-2">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
                  JP
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-[10px] sm:text-xs text-white/85 underline hover:text-white"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>

            {/* Racha + nivel */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white/12 rounded-2xl px-4 py-3 flex items-center justify-between backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <p className="text-[11px] opacity-80">Racha</p>
                    <p className="text-sm font-semibold">7 días</p>
                  </div>
                </div>
              </div>

              <div className="px-3 py-2 rounded-2xl bg-white/18 border border-white/30 text-[11px] font-medium backdrop-blur">
                Nivel B1
              </div>
            </div>
          </header>

          {/* STATS */}
          <section className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-100 px-3 sm:px-4 py-3 text-center space-y-1">
              <p className="text-[11px] sm:text-xs text-slate-400">
                XP Total
              </p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                2,450
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-100 px-3 sm:px-4 py-3 text-center space-y-1">
              <p className="text-[11px] sm:text-xs text-slate-400">
                Lecciones
              </p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                12
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl shadow-sm border border-slate-100 px-3 sm:px-4 py-3 text-center space-y-1">
              <p className="text-[11px] sm:text-xs text-slate-400">
                Precisión
              </p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">
                85%
              </p>
            </div>
          </section>

          {/* CONTINÚA APRENDIENDO */}
          <section className="space-y-3 sm:space-y-4">
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Continúa aprendiendo
            </h2>

            {/* Card 1: link a diagnóstica */}
            <Link to="/diagnostic" className="block">
              <div className="bg-slate-50 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-sm border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-100 transition">
                <div className="space-y-1">
                  <p className="text-sm sm:text-base font-semibold text-slate-900">
                    Present Simple
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Nivel B1 · 15 min
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs sm:text-sm text-slate-500">
                    60%
                  </span>
                  <div className="w-14 sm:w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500"
                      style={{ width: "60%" }}
                    />
                  </div>
                </div>
              </div>
            </Link>

            {/* Card 2 */}
            <div className="bg-slate-50 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-sm border border-slate-100 flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm sm:text-base font-semibold text-slate-900">
                  Daily Routines
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Nivel B1 · 20 min <span className="ml-1">🔒</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs sm:text-sm text-slate-500">0%</span>
                <div className="w-14 sm:w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500"
                    style={{ width: "0%" }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* NAVBAR INFERIOR */}
        <nav className="mt-4 border-t border-slate-100 pt-2 bg-white flex justify-between px-6 sm:px-8 py-2.5 text-[11px] sm:text-xs">
          <Link
            to="/"
            className="flex flex-col items-center gap-1 text-violet-500"
          >
            <span className="text-xl">🏠</span>
            <span className="font-medium">Inicio</span>
          </Link>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <span className="text-xl">📘</span>
            <span>Lecciones</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <span className="text-xl">🏆</span>
            <span>Rankings</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <span className="text-xl">👤</span>
            <span>Perfil</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
