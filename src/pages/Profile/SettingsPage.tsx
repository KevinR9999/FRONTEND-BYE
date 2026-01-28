// src/pages/Profile/SettingsPage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, BookOpen, Trophy, User } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

type UserInfo = {
  id: string;
  email: string | null;
};

function Switch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
        enabled ? "bg-indigo-500" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          enabled ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [email, setEmail] = useState<string>("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  // Toggles locales (UI)
  const [dailyReminder, setDailyReminder] = useState(true);
  const [streakAlert, setStreakAlert] = useState(true);
  const [newLessons, setNewLessons] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState(true);
  const [friendsActivity, setFriendsActivity] = useState(false);
  const [appSounds, setAppSounds] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [dailyGoalMinutes] = useState(15);

  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        // Aseguramos que haya data y user antes de usarlo
        if (error || !data || !data.user) {
          navigate("/login");
          return;
        }

        const u = data.user;
        setUser({ id: u.id, email: u.email ?? null });
        setEmail(u.email ?? "");

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("is_private")
          .eq("user_id", u.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            "Error cargando perfil en configuración:",
            profileError
          );
        } else if (profileRow) {
          setIsPrivate(!!profileRow.is_private);
        }
      } catch (err) {
        console.error("Error cargando configuración:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  const handleTogglePrivacy = async () => {
    if (!user) return;
    const next = !isPrivate;
    setIsPrivate(next);
    setSavingPrivacy(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_private: next })
        .eq("user_id", user.id);

      if (error) {
        console.error("Error actualizando privacidad:", error);
        alert("No se pudo actualizar la privacidad del perfil.");
        setIsPrivate(!next);
      }
    } catch (err) {
      console.error("Error general actualizando privacidad:", err);
      alert("Ocurrió un error al guardar la privacidad.");
      setIsPrivate(!next);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!user) return;

    const newEmail = window.prompt("Introduce tu nuevo correo:", email);
    if (!newEmail || newEmail === email) return;

    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) {
        console.error("Error actualizando email:", error);
        alert("No se pudo actualizar el correo: " + error.message);
        return;
      }

      setEmail(newEmail);
      alert(
        "Hemos enviado un correo de confirmación a tu nuevo email. Puede que debas verificarlo para completar el cambio."
      );
    } catch (err) {
      console.error("Error general actualizando email:", err);
      alert("Ocurrió un error al actualizar el correo.");
    } finally {
      setSavingEmail(false);
    }
  };

  const privacyLabel = isPrivate ? "Privado" : "Público";

  return (
    <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
      {/* 👇 aquí damos color de texto oscuro por defecto */}
      <div className="h-full w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-slate-900">
        {/* HEADER */}
        <header className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ←
          </button>
          <h1 className="flex-1 text-center text-lg sm:text-xl font-semibold text-slate-900">
            Configuración
          </h1>
          <div className="w-5" />
        </header>

        {/* CONTENIDO SCROLLABLE */}
        <main className="flex-1 bg-slate-50 overflow-y-auto text-sm">
          {/* NOTIFICACIONES */}
          <section className="mt-2">
            <div className="px-6 py-2 bg-slate-100 text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
              Notificaciones
            </div>

            <div className="bg-white">
              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100">
                <span>Recordatorio diario</span>
                <Switch
                  enabled={dailyReminder}
                  onChange={() => setDailyReminder((v) => !v)}
                />
              </div>

              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100">
                <span>Hora del recordatorio</span>
                <span className="text-xs text-slate-500">19:00</span>
              </div>

              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100">
                <span>Alerta de racha</span>
                <Switch
                  enabled={streakAlert}
                  onChange={() => setStreakAlert((v) => !v)}
                />
              </div>

              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100">
                <span>Nuevas lecciones</span>
                <Switch
                  enabled={newLessons}
                  onChange={() => setNewLessons((v) => !v)}
                />
              </div>

              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100">
                <span>Logros desbloqueados</span>
                <Switch
                  enabled={unlockedAchievements}
                  onChange={() =>
                    setUnlockedAchievements((v) => !v)
                  }
                />
              </div>

              <div className="px-6 py-3 flex items-center justify-between">
                <span>Actividad de amigos</span>
                <Switch
                  enabled={friendsActivity}
                  onChange={() => setFriendsActivity((v) => !v)}
                />
              </div>
            </div>
          </section>

          {/* CUENTA */}
          <section className="mt-4">
            <div className="px-6 py-2 bg-slate-100 text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
              Cuenta
            </div>

            <div className="bg-white">
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="w-full px-6 py-3 flex items-center justify-between border-b border-slate-100 text-left"
              >
                <span>Cambiar contraseña</span>
                <span className="text-slate-300 text-lg">›</span>
              </button>

              <button
                type="button"
                onClick={savingEmail ? undefined : handleChangeEmail}
                className="w-full px-6 py-3 flex items-center justify-between border-b border-slate-100 text-left"
              >
                <span>Email</span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  {loading ? "Cargando..." : email || "—"}
                  <span className="text-slate-300 text-lg">›</span>
                </span>
              </button>

              <button
                type="button"
                onClick={savingPrivacy ? undefined : handleTogglePrivacy}
                className="w-full px-6 py-3 flex items-center justify-between text-left"
              >
                <span>Privacidad del perfil</span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  {savingPrivacy ? "Guardando..." : privacyLabel}
                  <span className="text-slate-300 text-lg">›</span>
                </span>
              </button>
            </div>
          </section>

          {/* APRENDIZAJE */}
          <section className="mt-4 mb-4">
            <div className="px-6 py-2 bg-slate-100 text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
              Aprendizaje
            </div>

            <div className="bg-white">
              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100">
                <span>Objetivo diario</span>
                <span className="text-xs text-slate-500">
                  {dailyGoalMinutes} min
                </span>
              </div>

              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100">
                <span>Sonidos de la app</span>
                <Switch
                  enabled={appSounds}
                  onChange={() => setAppSounds((v) => !v)}
                />
              </div>

              <div className="px-6 py-3 flex items-center justify-between">
                <span>Modo offline</span>
                <Switch
                  enabled={offlineMode}
                  onChange={() => setOfflineMode((v) => !v)}
                />
              </div>
            </div>
          </section>
        </main>

        {/* NAV INFERIOR */}
        <nav className="border-t border-slate-200 bg-white px-6 py-3 flex justify-around text-[11px]">
          <Link to="/" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
            <Home size={26} strokeWidth={2.5} className="stroke-current" />
            <span>Inicio</span>
          </Link>

          <Link to="/lessons" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
            <BookOpen size={26} strokeWidth={2.5} className="stroke-current" />
            <span>Lecciones</span>
          </Link>

          <Link to="/rankings" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
            <Trophy size={26} strokeWidth={2.5} className="stroke-current" />
            <span>Rankings</span>
          </Link>

          <Link to="/profile" className="flex flex-col items-center gap-1.5 text-indigo-600 transition-colors">
            <User size={26} strokeWidth={2.5} className="stroke-current" />
            <span className="font-medium">Perfil</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
