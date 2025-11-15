// src/pages/Auth/RegisterPage.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../services/authService";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados solo visuales (no cambian tu lógica de registro)
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // 🔹 Lógica original: no se ha tocado
      await authService.register(email, password, fullName);
      navigate("/login");
    } catch (err: any) {
      setError(err?.message || "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      {/* Card tipo "teléfono" */}
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-[2.5rem] shadow-2xl px-6 sm:px-8 py-6 sm:py-7 flex flex-col">
        <div>
          {/* Títulos */}
          <div className="mb-7 space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">
              Crea tu cuenta
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Comienza tu viaje de aprendizaje hoy
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block mb-1 text-xs text-slate-700">
                Nombre completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                required
              />
            </div>

            <div>
              <label className="block mb-1 text-xs text-slate-700">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                required
              />
            </div>

            <div>
              <label className="block mb-1 text-xs text-slate-700">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                required
              />
            </div>

            {/* Campo visual de confirmar contraseña */}
            <div>
              <label className="block mb-1 text-xs text-slate-700">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
            </div>

            {/* Checkbox de términos (solo visual, no cambia la lógica de submit) */}
            <div className="flex items-start gap-2 mt-1">
              <input
                id="terms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-violet-500 focus:ring-violet-500"
              />
              <label
                htmlFor="terms"
                className="text-[11px] sm:text-xs text-slate-500"
              >
                Acepto los{" "}
                <span className="text-violet-500 font-medium">
                  términos y condiciones
                </span>{" "}
                y la{" "}
                <span className="text-violet-500 font-medium">
                  política de privacidad
                </span>
                .
              </label>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 font-semibold text-white text-sm shadow-md hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Creando cuenta..." : "Crear Cuenta"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-5 text-xs sm:text-sm text-center text-slate-500">
          ¿Ya tienes cuenta?{" "}
          <Link
            to="/login"
            className="text-violet-500 font-semibold hover:underline"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
