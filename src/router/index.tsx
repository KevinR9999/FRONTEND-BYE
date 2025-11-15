// src/router/index.tsx
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/Auth/LoginPage";
import RegisterPage from "../pages/Auth/RegisterPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import DiagnosticResultPage from "../pages/Onboarding/DiagnosticResultPage";
import DiagnosticTestPage from "../pages/Onboarding/DiagnosticTestPage";
import { useAuthStore } from "../store/authStore";

const SPLASH_PROGRESS_TIME = 1000; // duración de la barra en el splash (1s)

// Pantalla de carga tipo "splash" usando Tailwind (responsive + barra con progreso)
function LoadingSplash() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const percentage = Math.min(
        (elapsed / SPLASH_PROGRESS_TIME) * 100,
        100
      );
      setProgress(percentage);

      if (percentage >= 100) {
        window.clearInterval(interval);
      }
    }, 50);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      <div
        className="
        w-full 
        max-w-sm sm:max-w-md 
        bg-white 
        rounded-[2.5rem] 
        shadow-2xl 
        px-6 sm:px-8 
        py-6 sm:py-8 
        flex flex-col 
        justify-between 
        h-[80vh] 
        max-h-[720px]
      "
      >
        {/* Contenido principal */}
        <div className="flex flex-col items-center mt-2 sm:mt-4">
          {/* Logo */}
          <div
            className="
            w-24 h-24 
            sm:w-32 sm:h-32 
            rounded-[2rem] 
            bg-gradient-to-br from-violet-500 to-fuchsia-500 
            shadow-xl 
            flex items-center justify-center 
            mb-6 sm:mb-8
          "
          >
            <span className="text-3xl sm:text-4xl font-bold text-white">
              LS
            </span>
          </div>

          {/* Títulos */}
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1 text-center">
            Boost Your English
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 text-center max-w-xs sm:max-w-sm">
            Aprende inglés de forma divertida y efectiva
          </p>

          {/* Barra de progreso con movimiento 0 → 100% */}
          <div className="w-full mt-8 sm:mt-10">
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-100"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] sm:text-xs text-slate-400 text-center">
              Preparando tu experiencia...
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] sm:text-[11px] text-slate-400 text-center mt-4">
          © 2024 Let&apos;s Speak
        </p>
      </div>
    </div>
  );
}

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, initialized } = useAuthStore();

  // Mientras no se haya inicializado el estado de auth,
  // mostramos la pantalla de carga
  if (!initialized) {
    return <LoadingSplash />;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export const AppRouter = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />

    <Route
      path="/diagnostic"
      element={
        <PrivateRoute>
          <DiagnosticTestPage />
        </PrivateRoute>
      }
    />

    <Route
      path="/diagnostic/result"
      element={
        <PrivateRoute>
          <DiagnosticResultPage />
        </PrivateRoute>
      }
    />

    <Route
      path="/"
      element={
        <PrivateRoute>
          <DashboardPage />
        </PrivateRoute>
      }
    />
  </Routes>
);
