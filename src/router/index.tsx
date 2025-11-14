// src/router/index.tsx
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/Auth/LoginPage";
import RegisterPage from "../pages/Auth/RegisterPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import DiagnosticResultPage from "../pages/Onboarding/DiagnosticResultPage";
import DiagnosticTestPage from "../pages/Onboarding/DiagnosticTestPage";
import { useAuthStore } from "../store/authStore";

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Cargando...</p>
      </div>
    );
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
