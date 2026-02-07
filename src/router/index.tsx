// src/router/index.tsx
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ForgotPasswordPage from "../pages/Auth/ForgotPasswordPage";
import LoginPage from "../pages/Auth/LoginPage";
import RegisterPage from "../pages/Auth/RegisterPage";
import ResetPasswordPage from "../pages/Auth/ResetPasswordPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import DiagnosticResultsPage from "../pages/Diagnostic/DiagnosticResultsPage";
import DiagnosticTestPage from "../pages/Diagnostic/DiagnosticTestPage";
import LessonsByLevelPage from "../pages/Lessons/LessonsByLevelPage";
import LessonsHomePage from "../pages/Lessons/LessonsHomePage";
import DiagnosticResultPage from "../pages/Onboarding/DiagnosticResultPage";
import PaymentPage from "../pages/Payment/PaymentPage";
import ProfilePage from "../pages/Profile/ProfilePage";
import SettingsPage from "../pages/Profile/SettingsPage";
import StatsPage from "../pages/Profile/StatsPage";
import RankingPage from "../pages/Ranking/RankingPage";
import AchievementsPage from "../pages/Achievements/AchievementsPage";
import { useAuthStore } from "../store/authStore";

// ✅ FRIENDS PAGES (AGREGADO)
import ChatPage from "../pages/Friends/ChatPage";
import ChatsPage from "../pages/Friends/ChatsPage"; // ✅ NUEVO: lista de chats
import FriendProfilePage from "../pages/Friends/FriendProfilePage";
import FriendsPage from "../pages/Friends/FriendsPage";

// Admin Pages
import AdminDashboardPage from "../pages/Admin/DashboardPage";
import AdminDiagnosticQuestionsPage from "../pages/Admin/DiagnosticQuestionsPage";
import AdminLessonQuestionsPage from "../pages/Admin/LessonQuestionsPage";
import AdminLessonsPage from "../pages/Admin/LessonsPage";
import AdminNotificationsPage from "../pages/Admin/NotificationsPage";
import AdminPaymentPlansPage from "../pages/Admin/PaymentPlansPage";
import AdminPaymentsPage from "../pages/Admin/PaymentsPage";
import AdminSettingsPage from "../pages/Admin/SettingsPage";
import AdminUsersPage from "../pages/Admin/UsersPage";

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, initialized, logout } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          console.warn("Usuario no válido, cerrando sesión...");
          await logout();
          return;
        }

        setIsChecking(false);
      } catch (error) {
        console.error("Error verificando autenticación:", error);
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

// Admin Route - Solo para usuarios con rol admin
function AdminRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, initialized, isAdmin, logout } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          console.warn("Usuario no válido, cerrando sesión...");
          await logout();
          return;
        }

        setIsChecking(false);
      } catch (error) {
        console.error("Error verificando autenticación:", error);
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

  // Si no es admin, redirigir al dashboard principal
  if (initialized && isAuthenticated && !isAdmin) {
    return <Navigate to="/" replace />;
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

    <Route
      path="/diagnostic/results"
      element={
        <PrivateRoute>
          <DiagnosticResultsPage />
        </PrivateRoute>
      }
    />

    {/* Lecciones: selector de niveles */}
    <Route
      path="/lessons"
      element={
        <PrivateRoute>
          <LessonsHomePage />
        </PrivateRoute>
      }
    />

    {/* Lecciones por nivel (A1/A2/B1/B2) */}
    <Route
      path="/lessons/:level"
      element={
        <PrivateRoute>
          <LessonsByLevelPage />
        </PrivateRoute>
      }
    />

    {/* Lección específica dentro del nivel */}
    <Route
      path="/lessons/:level/:lessonId"
      element={
        <PrivateRoute>
          <LessonsByLevelPage />
        </PrivateRoute>
      }
    />

    {/* ✅ AMIGOS (AGREGADO) */}
    <Route
      path="/friends"
      element={
        <PrivateRoute>
          <FriendsPage />
        </PrivateRoute>
      }
    />
    <Route
      path="/friends/:id"
      element={
        <PrivateRoute>
          <FriendProfilePage />
        </PrivateRoute>
      }
    />

    {/* ✅ NUEVO: LISTA DE CHATS */}
    <Route
      path="/friends/chats"
      element={
        <PrivateRoute>
          <ChatsPage />
        </PrivateRoute>
      }
    />

    <Route
      path="/friends/chat/:friendId"
      element={
        <PrivateRoute>
          <ChatPage />
        </PrivateRoute>
      }
    />

    {/* Perfil */}
    <Route
      path="/profile"
      element={
        <PrivateRoute>
          <ProfilePage />
        </PrivateRoute>
      }
    />

    <Route
      path="/stats"
      element={
        <PrivateRoute>
          <StatsPage />
        </PrivateRoute>
      }
    />

    <Route
      path="/settings"
      element={
        <PrivateRoute>
          <SettingsPage />
        </PrivateRoute>
      }
    />

    {/* Logros */}
    <Route
      path="/achievements"
      element={
        <PrivateRoute>
          <AchievementsPage />
        </PrivateRoute>
      }
    />

    {/* Rankings */}
    <Route
      path="/rankings"
      element={
        <PrivateRoute>
          <RankingPage />
        </PrivateRoute>
      }
    />

    {/* Pasarela de pagos */}
    <Route
      path="/payment"
      element={
        <PrivateRoute>
          <PaymentPage />
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

    {/* ============ ADMIN ROUTES ============ */}
    <Route
      path="/admin"
      element={
        <AdminRoute>
          <AdminDashboardPage />
        </AdminRoute>
      }
    />

    <Route
      path="/admin/users"
      element={
        <AdminRoute>
          <AdminUsersPage />
        </AdminRoute>
      }
    />

    <Route
      path="/admin/lessons"
      element={
        <AdminRoute>
          <AdminLessonsPage />
        </AdminRoute>
      }
    />

    <Route
      path="/admin/lessons/:lessonId/questions"
      element={
        <AdminRoute>
          <AdminLessonQuestionsPage />
        </AdminRoute>
      }
    />

    <Route
      path="/admin/diagnostic"
      element={
        <AdminRoute>
          <AdminDiagnosticQuestionsPage />
        </AdminRoute>
      }
    />

    <Route
      path="/admin/notifications"
      element={
        <AdminRoute>
          <AdminNotificationsPage />
        </AdminRoute>
      }
    />

    <Route
      path="/admin/settings"
      element={
        <AdminRoute>
          <AdminSettingsPage />
        </AdminRoute>
      }
    />

    <Route
      path="/admin/payments"
      element={
        <AdminRoute>
          <AdminPaymentsPage />
        </AdminRoute>
      }
    />

    <Route
      path="/admin/payment-plans"
      element={
        <AdminRoute>
          <AdminPaymentPlansPage />
        </AdminRoute>
      }
    />

    {/* Fallback para evitar pantalla gris */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);
