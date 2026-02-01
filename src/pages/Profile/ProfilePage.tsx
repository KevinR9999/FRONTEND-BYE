// src/pages/Profile/Profilepage.tsx
import {
  Award,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  CreditCard,
  Home,
  Pencil,
  Settings,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuthStore } from "../../store/authStore";

type Profile = {
  user_id: string;
  avatar_url: string | null;
  full_name: string | null; // ✅ usamos esto
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

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Editar nombre completo (full_name)
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          navigate("/login");
          return;
        }

        const user = data.user;
        setEmail(user.email ?? "");

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Error cargando perfil:", profileError);

          const fallbackName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            "Usuario";

          setName(fallbackName);

          setProfile({
            user_id: user.id,
            avatar_url: null,
            full_name: fallbackName,
            level: "A1",
            xp_total: 0,
            streak_days: 0,
            lessons_completed: 0,
            is_private: false,
            diagnostic_completed: false,
          });
        } else if (profileRow) {
          const p = profileRow as Profile;
          setProfile(p);

          const fullName =
            (p.full_name && p.full_name.trim()) ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            "Usuario";

          setName(fullName);
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

  // Avatar: siempre editable
  const handleAvatarClick = () => {
    if (!profile || uploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    try {
      setUploadingAvatar(true);

      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${profile.user_id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

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

      setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
    } catch (err) {
      console.error("Error general subiendo avatar:", err);
      alert("Ocurrió un error al subir tu foto.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  // Editar full_name
  const startNameEdit = () => {
    setNameError(null);
    setEditingName(true);
    setNameDraft(name || "");
  };

  const cancelNameEdit = () => {
    setNameError(null);
    setEditingName(false);
    setNameDraft("");
  };

  const validateFullName = (value: string) => {
    const v = value.trim();
    if (!v) return "El nombre no puede estar vacío.";
    if (v.length < 3) return "Mínimo 3 caracteres.";
    if (v.length > 60) return "Máximo 60 caracteres.";
    return null;
  };

  const saveFullName = async () => {
    if (!profile) return;

    const cleaned = nameDraft.trim().replace(/\s+/g, " ");
    const err = validateFullName(cleaned);
    if (err) {
      setNameError(err);
      return;
    }

    try {
      setSavingName(true);
      setNameError(null);

      // 1) Guardar en BD (profiles.full_name)
      const { error: updateProfileErr } = await supabase
        .from("profiles")
        .update({ full_name: cleaned })
        .eq("user_id", profile.user_id);

      if (updateProfileErr) {
        console.error("Error actualizando full_name:", updateProfileErr);
        setNameError("No se pudo guardar el nombre en la base de datos.");
        return;
      }

      // 2) (Opcional recomendado) sincronizar también Auth metadata
      const { error: updateAuthErr } = await supabase.auth.updateUser({
        data: { full_name: cleaned, name: cleaned },
      });
      if (updateAuthErr) console.warn("No se pudo sincronizar Auth metadata:", updateAuthErr);

      setName(cleaned);
      setProfile((prev) => (prev ? { ...prev, full_name: cleaned } : prev));
      setEditingName(false);
      setNameDraft("");
    } catch (e) {
      console.error(e);
      setNameError("Ocurrió un error guardando el nombre.");
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
      <div className="h-full w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* HEADER CON GRADIENTE */}
        <header className="bg-gradient-to-b from-indigo-500 to-violet-500 px-6 pt-8 pb-6 text-white">
          {/* Avatar + nombre */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center text-violet-500 text-2xl font-bold shadow-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/70"
              title="Cambiar foto de perfil"
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

            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={!profile || uploadingAvatar}
              className="text-[11px] text-white/90 flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 hover:bg-white/15 transition disabled:opacity-60"
            >
              <Camera size={14} />
              Cambiar foto
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
              <p className="text-[10px] sm:text-[11px] text-white/80">XP Total</p>
            </div>
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm sm:text-base font-bold">{loading ? "…" : streak}</p>
              <p className="text-[10px] sm:text-[11px] text-white/80">Racha</p>
            </div>
            <div className="bg-white/10 rounded-2xl px-2.5 py-2 backdrop-blur border border-white/20">
              <p className="text-sm sm:text-base font-bold">{loading ? "…" : lessonsCompleted}</p>
              <p className="text-[10px] sm:text-[11px] text-white/80">Lecciones</p>
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 bg-slate-50 px-6 pt-4 pb-3 space-y-3 overflow-y-auto">
          <section className="space-y-2">
            {/* Editar nombre completo */}
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Nombre completo</p>
                  <p className="text-[11px] text-slate-400">Este nombre se usa para buscarte en Amigos</p>
                </div>

                {!editingName ? (
                  <button
                    type="button"
                    onClick={startNameEdit}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-slate-800 font-semibold text-xs flex items-center gap-2 hover:bg-slate-200 transition"
                  >
                    <Pencil size={16} />
                    Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cancelNameEdit}
                      disabled={savingName}
                      className="rounded-xl bg-slate-100 px-3 py-2 text-slate-800 font-semibold text-xs flex items-center gap-2 hover:bg-slate-200 transition disabled:opacity-60"
                    >
                      <X size={16} />
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={saveFullName}
                      disabled={savingName}
                      className="rounded-xl bg-violet-600 px-3 py-2 text-white font-semibold text-xs flex items-center gap-2 hover:bg-violet-700 transition disabled:opacity-60"
                    >
                      <Check size={16} />
                      {savingName ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                )}
              </div>

              {editingName && (
                <div className="mt-3">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Tu nombre completo"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
                    maxLength={60}
                  />
                  {nameError && (
                    <p className="mt-2 text-[12px] text-red-600 font-semibold">
                      {nameError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Estadísticas */}
            <Link to="/stats" className="block">
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <BarChart3 size={20} className="text-blue-600" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Estadísticas</p>
                    <p className="text-[11px] text-slate-400">Progreso y rendimiento</p>
                  </div>
                </div>
                <span className="text-slate-300 text-xl">›</span>
              </div>
            </Link>

            {/* Logros */}
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Award size={20} className="text-amber-600" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Logros</p>
                  <p className="text-[11px] text-slate-400">Desbloquea nuevas metas</p>
                </div>
              </div>
              <span className="text-slate-300 text-xl">›</span>
            </div>

            {/* Amigos */}
            <Link to="/friends" className="block">
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Users size={20} className="text-purple-600" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Mis Amigos</p>
                    <p className="text-[11px] text-slate-400">Buscar, agregar y chatear</p>
                  </div>
                </div>
                <span className="text-slate-300 text-xl">›</span>
              </div>
            </Link>

            {/* Pagar Mensualidad */}
            <Link to="/payment" className="block">
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center">
                    <CreditCard size={20} className="text-cyan-600" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Pagar Mensualidad</p>
                    <p className="text-[11px] text-slate-400">Pago del instituto</p>
                  </div>
                </div>
                <span className="text-slate-300 text-xl">›</span>
              </div>
            </Link>

            {/* Configuración */}
            <Link to="/settings" className="block">
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Settings size={20} className="text-slate-600" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Configuración</p>
                    <p className="text-[11px] text-slate-400">Privacidad y cuenta</p>
                  </div>
                </div>
                <span className="text-slate-300 text-xl">›</span>
              </div>
            </Link>
          </section>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 w-full py-2.5 rounded-2xl bg-red-500 text-white font-semibold text-sm shadow-md hover:bg-red-600 transition"
          >
            Cerrar sesión
          </button>
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
