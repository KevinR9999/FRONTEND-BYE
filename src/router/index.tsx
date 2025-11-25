// src/router/index.tsx
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ForgotPasswordPage from "../pages/Auth/ForgotPasswordPage";
import LoginPage from "../pages/Auth/LoginPage";
import RegisterPage from "../pages/Auth/RegisterPage";
import ResetPasswordPage from "../pages/Auth/ResetPasswordPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import LessonsPage from "../pages/Lessons/LessonsPage";
import VerbLessonPage from "../pages/Lessons/VerbLessonPage";
import DiagnosticResultPage from "../pages/Onboarding/DiagnosticResultPage";
import DiagnosticTestPage from "../pages/Diagnostic/DiagnosticTestPage";
import DiagnosticResultsPage from "../pages/Diagnostic/DiagnosticResultsPage"; // ✅ NUEVO
import ProfilePage from "../pages/Profile/ProfilePage";
import SettingsPage from "../pages/Profile/SettingsPage";
import StatsPage from "../pages/Profile/StatsPage";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabaseClient";

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, initialized, logout } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          console.warn('Usuario no válido, cerrando sesión...');
          await logout();
          return;
        }

        setIsChecking(false);
      } catch (error) {
        console.error('Error verificando autenticación:', error);
        await logout();
      }
    };

    if (initialized && isAuthenticated) {
      checkAuth();
    } else {
      setIsChecking(false);
    }
  }, [initialized, isAuthenticated, logout]);

  if (!initialized || isChecking) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (initialized && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export const AppRouter = () => (
  <Routes>
    {/* Auth */}
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />

    {/* Recuperación de contraseña */}
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />

    {/* Prueba diagnóstica */}
    <Route
      path="/diagnostic-test"
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

    {/*  NUEVA RUTA: Resultados detallados del diagnóstico */}
    <Route
      path="/diagnostic/results"
      element={
        <PrivateRoute>
          <DiagnosticResultsPage />
        </PrivateRoute>
      }
    />

    {/* Lecciones: listado */}
    <Route
      path="/lessons"
      element={
        <PrivateRoute>
          <LessonsPage />
        </PrivateRoute>
      }
    />

    {/* Lección individual: /lessons/:lessonId */}
    <Route
      path="/lessons/:lessonId"
      element={
        <PrivateRoute>
          <VerbLessonPage />
        </PrivateRoute>
      }
    />

    {/* Perfil del usuario */}
    <Route
      path="/profile"
      element={
        <PrivateRoute>
          <ProfilePage />
        </PrivateRoute>
      }
    />

    {/* Estadísticas del perfil */}
    <Route
      path="/stats"
      element={
        <PrivateRoute>
          <StatsPage />
        </PrivateRoute>
      }
    />

    {/* Configuración */}
    <Route
      path="/settings"
      element={
        <PrivateRoute>
          <SettingsPage />
        </PrivateRoute>
      }
    />

    {/* Dashboard principal */}
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