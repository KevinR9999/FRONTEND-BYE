// src/pages/Auth/ResetPasswordPage.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { authService } from "../../services/authService";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  
  // ✅ NUEVO: Estados para mostrar/ocultar contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // ✅ NUEVO: Estado para medir fortaleza
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const navigate = useNavigate();

  // Validación SILENCIOSA del token (SIN CAMBIOS)
  useEffect(() => {
    const validateToken = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log("✅ Token válido, sesión activa");
          setTokenValid(true);
        } else {
          console.log("❌ No hay sesión activa");
          setError("El enlace ha expirado o es inválido. Por favor, solicita un nuevo enlace.");
        }
      } catch (err) {
        console.error("Error validando token:", err);
        setError("Error al validar el enlace. Por favor, solicita un nuevo enlace.");
      } finally {
        setValidatingToken(false);
      }
    };

    validateToken();
  }, []);

  // ✅ NUEVO: Calcular fortaleza de contraseña
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;

    setPasswordStrength(Math.min(strength, 100));
  }, [password]);

  // ✅ NUEVO: Funciones auxiliares para el medidor
  const getStrengthColor = () => {
    if (passwordStrength < 30) return "bg-red-500";
    if (passwordStrength < 60) return "bg-yellow-500";
    if (passwordStrength < 80) return "bg-blue-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (passwordStrength < 30) return "Débil";
    if (passwordStrength < 60) return "Regular";
    if (passwordStrength < 80) return "Buena";
    return "Fuerte";
  };

  // Función handleSubmit (SIN CAMBIOS)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tokenValid) {
      setError("El enlace ha expirado. Por favor, solicita un nuevo enlace de recuperación.");
      return;
    }

    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener mínimo 8 caracteres");
      setLoading(false);
      return;
    }

    try {
      await authService.updatePassword(password);
      setSuccess(true);
      
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err: any) {
      const errorMessage = err?.message || "";
      
      if (errorMessage.includes("session") || errorMessage.includes("token") || errorMessage.includes("expired")) {
        setError("El enlace ha expirado. Por favor, solicita un nuevo enlace de recuperación.");
      } else {
        setError("Error al actualizar la contraseña. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de validación (SIN CAMBIOS)
  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
        <div className="w-full max-w-sm sm:max-w-md bg-white rounded-[2.5rem] shadow-2xl px-6 sm:px-8 py-6 sm:py-7 flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mb-4"></div>
          <p className="text-sm text-slate-600">Verificando enlace de seguridad...</p>
          <p className="text-xs text-slate-400 mt-2">Esto tomará solo un momento</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-[2.5rem] shadow-2xl px-6 sm:px-8 py-6 sm:py-7 flex flex-col">
        <div>
          <div className="mb-7 space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              Nueva contraseña
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Ingresa tu nueva contraseña
            </p>
          </div>

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4">
              <p className="font-semibold mb-1 text-sm">✓ Contraseña actualizada</p>
              <p className="text-xs">Redirigiendo al inicio de sesión...</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* ✅ INPUT CON BOTÓN MOSTRAR/OCULTAR */}
            <div>
              <label className="block mb-1 text-xs text-slate-700">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                  required
                  disabled={success || !tokenValid}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>

              {/* ✅ MEDIDOR DE FORTALEZA */}
              {password && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-600">nivel de seguridad de contraseña:</span>
                    <span className={`text-xs font-medium ${
                      passwordStrength < 30 ? "text-red-600" :
                      passwordStrength < 60 ? "text-yellow-600" :
                      passwordStrength < 80 ? "text-blue-600" :
                      "text-green-600"
                    }`}>
                      {getStrengthText()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ✅ CONFIRMAR CONTRASEÑA CON BOTÓN MOSTRAR/OCULTAR */}
            <div>
              <label className="block mb-1 text-xs text-slate-700">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                  required
                  disabled={success || !tokenValid}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>

              {/* ✅ VALIDACIÓN VISUAL EN TIEMPO REAL */}
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Las contraseñas no coinciden</p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                {error}
              </p>
            )}

            {!tokenValid && !error && (
              <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 rounded-xl">
                <p className="text-xs text-yellow-800">
                  ⚠️ El enlace no es válido. Por favor, solicita un nuevo enlace desde la página de inicio de sesión.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || success || !tokenValid}
              className="w-full mt-1.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 font-semibold text-white text-sm shadow-md hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Actualizando..." : success ? "Contraseña actualizada" : "Actualizar contraseña"}
            </button>

            {!tokenValid && (
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full mt-2 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition"
              >
                Volver al inicio de sesión
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}