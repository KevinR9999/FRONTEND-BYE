
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../services/authService";
import { loadAppSettings } from "../../services/appSettingsService";
import { useAuthStore } from "../../store/authStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [maintenanceActive, setMaintenanceActive] = useState(false);

  const navigate = useNavigate();
  const { setAuthenticated, isAuthenticated, isAdmin, checkSession, blockedMessage, clearBlockedMessage } = useAuthStore((s) => ({
    setAuthenticated: s.setAuthenticated,
    isAuthenticated: s.isAuthenticated,
    isAdmin: s.isAdmin,
    checkSession: s.checkSession,
    blockedMessage: s.blockedMessage,
    clearBlockedMessage: s.clearBlockedMessage,
  }));


  // Mostrar mensaje de cuenta bloqueada si existe
  useEffect(() => {
    if (blockedMessage) {
      setError(blockedMessage);
      clearBlockedMessage();
    }
  }, [blockedMessage, clearBlockedMessage]);

  // Verificar si la app está en mantenimiento
  useEffect(() => {
    loadAppSettings().then((s) => setMaintenanceActive(s.maintenance_mode)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // Auto-redirect: admins to /admin, users to /
      const redirectPath = isAdmin ? "/admin" : "/";
      console.log('🚀 Redirecting to:', redirectPath, 'isAdmin:', isAdmin);
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.login(email, password);
      // IMPORTANTE: Primero cargar la sesión y el perfil
      await checkSession();

      // Leer el estado actualizado directamente del store
      const currentState = useAuthStore.getState();
      console.log('✅ Login exitoso. Estado actual:', {
        isAdmin: currentState.isAdmin,
        role: currentState.user?.role
      });

      // Redirigir basado en el rol
      const redirectPath = currentState.isAdmin ? "/admin" : "/";
      console.log('🚀 Redirigiendo a:', redirectPath);
      navigate(redirectPath, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      await authService.loginWithProvider("google");
    } catch (err: any) {
      setError(err?.message || "Error al iniciar sesión con Google");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-[2.5rem] shadow-2xl px-6 sm:px-7 py-6 sm:py-7 flex flex-col">
        {/* Encabezado */}
        <div className="mb-5 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
            Inicia sesión
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Bienvenido de nuevo a BYE. Continúa mejorando tu inglés.
          </p>
        </div>

        {/* Banner de mantenimiento */}
        {maintenanceActive && (
          <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-xs text-amber-700 font-medium">
              La aplicación está en mantenimiento temporalmente. Solo administradores pueden acceder.
            </p>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block mb-1 text-xs sm:text-sm text-slate-700">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              placeholder="tucorreo@email.com"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs sm:text-sm text-slate-700">
                Contraseña
              </label>
              <Link
                to="/forgot-password"
                className="text-[11px] sm:text-xs text-violet-500 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs sm:text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 font-semibold text-white text-sm shadow-md hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        {/* Separador */}
        <div className="relative my-4 sm:my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-2 text-[11px] sm:text-xs text-slate-400">
              O continúa con
            </span>
          </div>
        </div>

        {/* Botón Google */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Continuar con Google</span>
          </button>
        </div>

        {/* Registro */}
        <p className="mt-4 text-[11px] sm:text-xs text-center text-slate-500">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-violet-500 font-semibold">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
