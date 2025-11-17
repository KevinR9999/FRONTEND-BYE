// src/pages/Dashboard/DashboardPage.tsx
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function DashboardPage() {
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200">
      {/* Contenedor full-width y full-height */}
      <div className="w-full px-4 sm:px-6 lg:px-10 py-5 sm:py-8 flex flex-col min-h-screen">
        {/* HEADER PRINCIPAL (card grande con bordes redondeados) */}
        <header className="bg-gradient-to-br from-indigo-500 to-violet-500 rounded-3xl text-white px-5 sm:px-7 lg:px-10 py-5 sm:py-6 lg:py-7 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm opacity-80">¡Hola!</p>
              <h1 className="text-2xl sm:text-3xl font-bold leading-snug">
                Juan Pérez
              </h1>
              <p className="text-xs sm:text-sm text-white/80">
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
                className="text-[11px] sm:text-xs text-white/90 underline hover:text-white"
              >
                Cerrar sesión
              </button>
            </div>
          </div>

          {/* Racha + nivel */}
          <div className="mt-5 sm:mt-6 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[180px] bg-white/15 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="text-2xl sm:text-3xl">🔥</span>
                <div>
                  <p className="text-[11px] sm:text-xs opacity-80">Racha</p>
                  <p className="text-sm sm:text-base font-semibold">7 días</p>
                </div>
              </div>
            </div>

            <div className="px-4 py-2 sm:px-5 sm:py-3 rounded-2xl bg-white/15 border border-white/30 text-xs sm:text-sm font-medium backdrop-blur">
              Nivel B1
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="mt-5 sm:mt-6 flex-1 flex flex-col gap-6 sm:gap-7">
          {/* Stats */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 sm:px-5 py-3 sm:py-4 text-center space-y-1">
              <p className="text-[11px] sm:text-xs text-slate-400">XP Total</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">
                2,450
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 sm:px-5 py-3 sm:py-4 text-center space-y-1">
              <p className="text-[11px] sm:text-xs text-slate-400">
                Lecciones
              </p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">
                12
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 sm:px-5 py-3 sm:py-4 text-center space-y-1">
              <p className="text-[11px] sm:text-xs text-slate-400">
                Precisión
              </p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">
                85%
              </p>
            </div>
          </section>

          {/* Continúa aprendiendo */}
          <section className="space-y-4">
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Continúa aprendiendo
            </h2>

            {/* Lección 1: Present Simple */}
            <Link to="/diagnostic" className="block">
              <div className="bg-white rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-sm border border-slate-100 flex items-center justify-between gap-4 hover:bg-slate-50 transition">
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
                  <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500"
                      style={{ width: "60%" }}
                    />
                  </div>
                </div>
              </div>
            </Link>

            {/* Lección 2: Daily Routines */}
            <div className="bg-white rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-sm border border-slate-100 flex items-center justify-between gap-4">
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
                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500"
                    style={{ width: "0%" }}
                  />
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* NAVBAR INFERIOR (full width, bordes redondeados) */}
        <nav className="mt-4 sm:mt-6 mb-1 rounded-2xl bg-white/95 border border-slate-100 px-6 sm:px-10 py-3 flex justify-between text-[11px] sm:text-xs">
          <Link
            to="/"
            className="flex flex-col items-center gap-1 text-violet-500"
          >
            <span className="text-xl sm:text-2xl">🏠</span>
            <span className="font-medium">Inicio</span>
          </Link>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <span className="text-xl sm:text-2xl">📘</span>
            <span>Lecciones</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <span className="text-xl sm:text-2xl">🏆</span>
            <span>Rankings</span>
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <span className="text-xl sm:text-2xl">👤</span>
            <span>Perfil</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
