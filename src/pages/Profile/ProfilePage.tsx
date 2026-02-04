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
      if (updateAuthErr)
        console.warn("No se pudo sincronizar Auth metadata:", updateAuthErr);

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
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4 py-6">
      {/* CONTENEDOR TIPO MÓVIL */}
      <div className="h-[820px] w-full max-w-[390px] rounded-[34px] bg-white shadow-2xl overflow-hidden flex flex-col relative">
        {/* HEADER (como el mockup) */}
        <header className="relative px-6 pt-10 pb-7 text-white bg-gradient-to-b from-indigo-500 via-violet-500 to-purple-600">
          {/* decor circles */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-[1px]" />
          <div className="pointer-events-none absolute -top-10 -left-20 h-44 w-44 rounded-full bg-white/10 blur-[1px]" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-black/10" />

          <div className="relative flex flex-col items-center">
            {/* Avatar con aro dorado */}
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={!profile || uploadingAvatar}
              className="group relative rounded-full focus:outline-none focus:ring-2 focus:ring-white/70 disabled:opacity-70"
              title="Cambiar foto de perfil"
            >
              <div className="rounded-full p-[4px] bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-500 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                <div className="w-[92px] h-[92px] rounded-full bg-white/95 overflow-hidden grid place-items-center">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-violet-600 text-2xl font-extrabold">
                      {initials}
                    </span>
                  )}
                </div>
              </div>

              {/* glow */}
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-full blur-xl bg-white/20 opacity-70" />

              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/35 flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-white">
                    Subiendo...
                  </span>
                </div>
              )}
            </button>

            {/* Botón Cambiar foto (pill blanco) */}
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={!profile || uploadingAvatar}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-1.5 text-[11px] font-extrabold text-violet-700 shadow-md hover:bg-white transition disabled:opacity-60"
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

            <div className="mt-4 text-center">
              <h1 className="text-[22px] font-extrabold leading-tight">
                {name}
              </h1>

              <p className="mt-1 text-[12px] text-white/85">{email}</p>

              <p className="mt-2 text-[12px] text-white/85">
                Nivel actual:{" "}
                <span className="font-extrabold text-white">{level}</span>
              </p>

              <p className="mt-1 text-[11px] text-white/70">
                Toca tu foto para cambiarla
              </p>
            </div>

            {/* Stats (3 cards) */}
            <div className="mt-6 grid w-full grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/12 border border-white/20 backdrop-blur px-2.5 py-3 text-center shadow-sm">
                <p className="text-[16px] font-extrabold tracking-tight">
                  {loading ? "…" : xp.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-white/80">
                  XP Total
                </p>
              </div>

              <div className="rounded-2xl bg-white/12 border border-white/20 backdrop-blur px-2.5 py-3 text-center shadow-sm">
                <p className="text-[16px] font-extrabold tracking-tight">
                  {loading ? "…" : streak}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-white/80">
                  Racha
                </p>
              </div>

              <div className="rounded-2xl bg-white/12 border border-white/20 backdrop-blur px-2.5 py-3 text-center shadow-sm">
                <p className="text-[16px] font-extrabold tracking-tight">
                  {loading ? "…" : lessonsCompleted}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-white/80">
                  Lecciones
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENIDO SCROLLEABLE */}
        <main className="flex-1 bg-slate-50 overflow-y-auto">
          <div className="-mt-6 rounded-t-[28px] bg-slate-50 px-5 pt-5 pb-6">
            <section className="space-y-3">
              {/* Nombre completo + editar */}
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">
                      Nombre completo
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Este nombre se usa para buscarte en Amigos
                    </p>
                  </div>

                  {!editingName ? (
                    <button
                      type="button"
                      onClick={startNameEdit}
                      className="shrink-0 rounded-full bg-violet-600 px-4 py-2 text-white font-extrabold text-[11px] flex items-center gap-2 shadow-sm hover:bg-violet-700 transition"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                  ) : (
                    <div className="shrink-0 flex gap-2">
                      <button
                        type="button"
                        onClick={cancelNameEdit}
                        disabled={savingName}
                        className="rounded-full bg-slate-100 px-3 py-2 text-slate-800 font-extrabold text-[11px] flex items-center gap-2 hover:bg-slate-200 transition disabled:opacity-60"
                      >
                        <X size={14} />
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveFullName}
                        disabled={savingName}
                        className="rounded-full bg-violet-600 px-3 py-2 text-white font-extrabold text-[11px] flex items-center gap-2 hover:bg-violet-700 transition disabled:opacity-60"
                      >
                        <Check size={14} />
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
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
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shadow-sm border border-blue-100">
                      <BarChart3 size={20} className="text-blue-600" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">
                        Estadísticas
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Progreso y rendimiento
                      </p>
                    </div>
                  </div>
                  <span className="text-slate-300 text-2xl leading-none">›</span>
                </div>
              </Link>

              {/* Logros */}
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shadow-sm border border-amber-100">
                    <Award size={20} className="text-amber-600" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">Logros</p>
                    <p className="text-[11px] text-slate-400">Desbloquea nuevas metas</p>
                  </div>
                </div>
                <span className="text-slate-300 text-2xl leading-none">›</span>
              </div>

              {/* Amigos */}
              <Link to="/friends" className="block">
                <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shadow-sm border border-purple-100">
                      <Users size={20} className="text-purple-600" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">Mis Amigos</p>
                      <p className="text-[11px] text-slate-400">Buscar, agregar y chatear</p>
                    </div>
                  </div>
                  <span className="text-slate-300 text-2xl leading-none">›</span>
                </div>
              </Link>

              {/* Pagar Mensualidad */}
              <Link to="/payment" className="block">
                <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center shadow-sm border border-cyan-100">
                      <CreditCard size={20} className="text-cyan-600" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">Pagar Mensualidad</p>
                      <p className="text-[11px] text-slate-400">Pago del instituto</p>
                    </div>
                  </div>
                  <span className="text-slate-300 text-2xl leading-none">›</span>
                </div>
              </Link>

              {/* Configuración */}
              <Link to="/settings" className="block">
                <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shadow-sm border border-slate-200">
                      <Settings size={20} className="text-slate-600" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">Configuración</p>
                      <p className="text-[11px] text-slate-400">Privacidad y cuenta</p>
                    </div>
                  </div>
                  <span className="text-slate-300 text-2xl leading-none">›</span>
                </div>
              </Link>

              {/* espacio para que no quede pegado al footer */}
              <div className="h-4" />
            </section>
          </div>
        </main>

        {/* FOOTER FIJO: BOTÓN CERRAR SESIÓN + BARRA DE ICONOS */}
        <footer className="bg-white border-t border-slate-200">
          <div className="px-5 pt-3">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 rounded-2xl bg-rose-500 text-white font-extrabold text-sm shadow-md hover:bg-rose-600 transition"
            >
              Cerrar sesión
            </button>
          </div>

          <nav className="px-6 py-3 flex justify-around text-[11px]">
            <Link
              to="/"
              className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-violet-600 transition-colors"
            >
              <Home size={26} strokeWidth={2.5} className="stroke-current" />
              <span>Inicio</span>
            </Link>

            <Link
              to="/lessons"
              className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-violet-600 transition-colors"
            >
              <BookOpen size={26} strokeWidth={2.5} className="stroke-current" />
              <span>Lecciones</span>
            </Link>

            <Link
              to="/rankings"
              className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-violet-600 transition-colors"
            >
              <Trophy size={26} strokeWidth={2.5} className="stroke-current" />
              <span>Rankings</span>
            </Link>

            <Link
              to="/profile"
              className="flex flex-col items-center gap-1.5 text-violet-600 transition-colors"
            >
              <User size={26} strokeWidth={2.5} className="stroke-current" />
              <span className="font-extrabold">Perfil</span>
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
