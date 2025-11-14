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
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.register(email, password, fullName);
      navigate("/login");
    } catch (err: any) {
      setError(err?.message || "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-800 rounded-xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center">Crear cuenta</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm">Nombre completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 rounded text-black"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded text-black"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded text-black"
              required
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-brand-500 hover:bg-brand-600 font-semibold"
          >
            {loading ? "Creando cuenta..." : "Registrarse"}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-brand-500 underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
