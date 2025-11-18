// src/pages/Profile/Profilepage.tsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuthStore } from "../../store/authStore";

type Profile = {
  user_id: string;
  avatar_url: string | null;
  level: string | null;
  xp_total: number | null;
  streak_days: number | null;
  lessons_completed: number | null;
  is_private: boolean | null;
  diagnostic_completed: boolean | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState<string>("Usuario");
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          navigate("/login");
          return;
        }

        const user = data.user;
        const fullName =
          (user.user_metadata && user.user_metadata.full_name) ||
          user.user_metadata?.name ||
          "Usuario";

        setName(fullName);
        setEmail(user.email ?? "");

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Error cargando perfil:", profileError);
          // Perfil por defecto
          setProfile({
            user_id: user.id,
            avatar_url: null,
            level: "A1",
            xp_total: 0,
            streak_days: 0,
            lessons_completed: 0,
            is_private: false,
            diagnostic_completed: false,
          });
        } else if (profileRow) {
          setProfile(profileRow as Profile);
        }
      } catch (err) {
        console.error("Error inesperado cargando perfil:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "U";

  const xp = profile?.xp_total ?? 0;
  const streak = profile?.streak_days ?? 0;
  const lessonsCompleted = profile?.lessons_completed ?? 0;
  const level = profile?.level ?? "A1";

  const handleAvatarClick = () => {
    if (!profile || uploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    try {
      setUploadingAvatar(true);

      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${profile.user_id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) {
        console.error("Error subiendo avatar:", uploadError);
        alert("No se pudo subir la foto. Intenta de nuevo.");
        return;
      }

      const { data: publicData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicData.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", profile.user_id);

      if (updateError) {
        console.error("Error guardando avatar en profile:", updateError);
        alert("La imagen se subió, pero no se pudo guardar en tu perfil.");
        return;
      }

      setProfile((prev) =>
        prev ? { ...prev, avatar_url: publicUrl } : prev
      );
    } catch (err) {
      console.error("Error general subiendo avatar:", err);
      alert("Ocurrió un error al subir tu foto.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-sm sm:max-w-md h-[90vh] max-h-[820px] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        {/* HEADER CON GRADIENTE */}
        <header className="bg-gradient-to-b from-indigo-500 to-violet-500 px-6 pt-8 pb-6 text-white">
          {/* Avatar + nombre */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center text-violet-500 text-2xl font-bold shadow-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}

              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-[10px] text-white">Subiendo...</span>
                </div>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <div className="text-center">
              <h1 className="text-lg sm:text-xl font-semibold leading-snug">
                {name}
              </h1>
              <p className="text-xs sm:text-sm text-white/80">{email}</p>
              <p className="mt-1 text-[11px] sm:text-xs text-white/80">
                Nivel actual: <span className="font-semibold">{level}</span>
              </p>
              <p className="mt-1 text-[10px] text-white/70">
                Toca tu foto para cambiarla
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm sm:text-base font-bold">
                {loading ? "…" : xp.toLocaleString()}
              </p>
              <p className="text-[10px] sm:text-[11px] text-white/80">
                XP Total
              </p>
            </div>
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm sm:text-base font-bold">
                {loading ? "…" : streak}
              </p>
              <p className="text-[10px] sm:text-[11px] text-white/80">
                Racha
              </p>
            </div>
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm sm:text-base font-bold">
                {loading ? "…" : lessonsCompleted}
              </p>
              <p className="text-[10px] sm:text-[11px] text-white/80">
                Lecciones
              </p>
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 bg-slate-50 px-6 pt-4 pb-3 space-y-3 overflow-y-auto">
          <section className="space-y-2">
            {/* Estadísticas */}
            <Link to="/stats" className="block">
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Estadísticas
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Progreso y rendimiento
                    </p>
                  </div>
                </div>
                <span className="text-slate-300 text-xl">›</span>
              </div>
            </Link>

            {/* Logros */}
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏅</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Logros
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Desbloquea nuevas metas
                  </p>
                </div>
              </div>
              <span className="text-slate-300 text-xl">›</span>
            </div>

            {/* Amigos */}
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">👥</span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Mis Amigos
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Próximamente
                  </p>
                </div>
              </div>
              <span className="text-slate-300 text-xl">›</span>
            </div>

            {/* Configuración */}
            <Link to="/settings" className="block">
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚙️</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Configuración
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Privacidad y cuenta
                    </p>
                  </div>
                </div>
                <span className="text-slate-300 text-xl">›</span>
              </div>
            </Link>
          </section>

          {/* Botón cerrar sesión */}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 w-full py-2.5 rounded-2xl bg-red-500 text-white font-semibold text-sm shadow-md hover:bg-red-600 transition"
          >
            Cerrar sesión
          </button>
        </main>

        {/* NAV INFERIOR */}
        <nav className="border-t border-slate-100 bg-white px-6 py-2.5 flex justify-between text-[11px] sm:text-xs">
          <Link
            to="/"
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-violet-500"
          >
            <span className="text-xl">🏠</span>
            <span className="font-medium">Inicio</span>
          </Link>

          <Link
            to="/lessons"
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-violet-500"
          >
            <span className="text-xl">📘</span>
            <span>Lecciones</span>
          </Link>

          <button
            type="button"
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <span className="text-xl">🏆</span>
            <span>Rankings</span>
          </button>

          <Link
            to="/profile"
            className="flex flex-col items-center gap-1 text-violet-500"
          >
            <span className="text-xl">👤</span>
            <span className="font-medium">Perfil</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
