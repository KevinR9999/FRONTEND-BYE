// src/pages/Auth/ForgotPasswordPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../services/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  //  NUEVO: Estado para countdown del reenvío
  const [countdown, setCountdown] = useState(0);
  
  const navigate = useNavigate();

  //  NUEVO: Función para iniciar countdown
  const startCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await authService.resetPassword(email);
      setSuccess(true);
      startCountdown(); //  NUEVO: Iniciar countdown al enviar
    } catch (err: any) {
      setError(err?.message || "Error al enviar el correo");
    } finally {
      setLoading(false);
    }
  };

  //  NUEVO: Función para reenviar correo
  const handleResend = async () => {
    if (countdown > 0) return;
    
    setLoading(true);
    setError(null);

    try {
      await authService.resetPassword(email);
      setSuccess(true);
      startCountdown();
    } catch (err: any) {
      setError(err?.message || "Error al reenviar el correo");
    } finally {
      setLoading(false);
    }
  };

  //  NUEVO: Función para cambiar email
  const handleChangeEmail = () => {
    setSuccess(false);
    setCountdown(0);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-xl">
        <button
          onClick={() => navigate("/login")}
          className="text-purple-600 text-2xl mb-6 hover:text-purple-700 transition"
        >
          ←
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Recuperar contraseña
          </h1>
          <p className="text-gray-600">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña
          </p>
        </div>

        {/*  MEJORADO: Mensaje de éxito con consejos */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-4 rounded-xl mb-4">
            <p className="font-semibold mb-2">✓ Correo enviado</p>
            <p className="text-sm mb-3">
              Revisa tu bandeja de entrada en <span className="font-medium">{email}</span>
            </p>
            <div className="bg-green-100 rounded-lg px-3 py-2 text-xs space-y-1">
              <p className="font-medium"> Consejos:</p>
              <p>• Revisa la carpeta de spam</p>
              <p>• El enlace expira en 1 hora</p>
              <p>• Puede tardar 1-2 minutos</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Correo electrónico
            </label>
            {/*  MEJORADO: Input con botón "Cambiar" cuando está deshabilitado */}
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-gray-800 disabled:bg-gray-100 disabled:text-gray-600"
                required
                disabled={success}
              />
              {success && (
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-purple-600 hover:text-purple-700 font-semibold"
                >
                  Cambiar
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/*  BOTÓN PRINCIPAL: Enviar o Reenviar */}
          {!success ? (
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || loading}
              className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {countdown > 0 ? `Reenviar en ${countdown}s` : loading ? "Reenviando..." : "🔄 Reenviar correo"}
            </button>
          )}
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          ¿Recordaste tu contraseña?{" "}
          <Link
            to="/login"
            className="text-purple-600 font-semibold hover:text-purple-700 hover:underline transition"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}