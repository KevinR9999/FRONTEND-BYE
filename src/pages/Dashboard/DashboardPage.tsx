// src/pages/Dashboard/DashboardPage.tsx
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function DashboardPage() {
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 shadow">
        <h1 className="text-xl font-bold">BYE - Dashboard</h1>
        <button
          onClick={handleLogout}
          className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-sm"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="flex-1 p-6 space-y-4">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="font-semibold mb-2">Progreso general</h2>
            <p className="text-sm text-slate-300">
              Aquí irán tus estadísticas: XP, racha, lecciones completadas, etc.
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="font-semibold mb-2">Siguiente acción</h2>
            <p className="text-sm text-slate-300 mb-2">
              Empecemos con tu prueba diagnóstica si aún no la has hecho.
            </p>
            <Link
              to="/diagnostic"
              className="inline-flex items-center px-3 py-1 rounded bg-brand-500 hover:bg-brand-600 text-sm font-semibold"
            >
              Ir a prueba diagnóstica
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
