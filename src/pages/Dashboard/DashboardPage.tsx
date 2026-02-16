// src/pages/Dashboard/DashboardPage.tsx
import { Bell, BookOpen, Check, ChevronRight, Flame, Home, Settings, Trophy, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DiagnosticModal from "../../components/DiagnosticModal";
import { InstallBanner } from "../../components/InstallPWA";
import { supabase } from "../../lib/supabaseClient";
import { useAuthStore } from "../../store/authStore";
import { getNotificationsForUser, markAsRead, markAllAsRead, type StudentNotification } from "../../services/notificationService";

type ProfileRow = {
  diagnostic_completed: boolean | null;
  level: string | null;
  xp_total: number | null;
  lessons_completed: number | null;
  streak_days: number | null;
};

type LessonProgressRow = {
  correct_count: number | null;
  total_questions: number | null;
};

export default function DashboardPage() {
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const navigate = useNavigate();

  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [userName, setUserName] = useState("Usuario");
  const [userInitials, setUserInitials] = useState("U");
  const [userEmail, setUserEmail] = useState("");

  // ✅ stats reales
  const [xpTotal, setXpTotal] = useState(0);
  const [lessonsDone, setLessonsDone] = useState(0);
  const [accuracyPct, setAccuracyPct] = useState(0);
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState(0);

  // Notificaciones
  const [notifications, setNotifications] = useState<(StudentNotification & { is_read: boolean })[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Cerrar panel al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    if (showNotifPanel) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifPanel]);

  useEffect(() => {
    let mounted = true;

    const loadUserData = async () => {
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) console.error("❌ supabase.auth.getUser error:", userErr);

        if (!user) {
          navigate("/login");
          return;
        }

        // Guardar email
        if (!mounted) return;
        setUserEmail(user.email || "");

        // ✅ Obtener nombre SOLO de user_metadata (NO de profile)
        let finalName = "Usuario";
        if ((user.user_metadata as any)?.full_name) finalName = (user.user_metadata as any).full_name;
        else if ((user.user_metadata as any)?.name) finalName = (user.user_metadata as any).name;
        else if (user.email) finalName = user.email.split("@")[0];

        if (!mounted) return;
        setUserName(finalName);

        // ✅ Iniciales
        const names = finalName.trim().split(" ").filter(Boolean);
        if (names.length >= 2) {
          setUserInitials((names[0][0] || "U").toUpperCase() + (names[1][0] || "U").toUpperCase());
        } else {
          setUserInitials((names[0]?.[0] || "U").toUpperCase());
        }

        // ✅ Leer profile (usa user_id, NO id) - incluye streak_days
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("diagnostic_completed, level, xp_total, lessons_completed, streak_days")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("❌ Error al leer profile:", profileError);
        }

        const p = (profile ?? null) as ProfileRow | null;

        if (!mounted) return;

        // Nivel del usuario
        setUserLevel(p?.level ?? null);

        // XP y lecciones
        setXpTotal(Number(p?.xp_total ?? 0));
        setLessonsDone(Number(p?.lessons_completed ?? 0));
        setStreakDays(Number(p?.streak_days ?? 0));

        // ✅ Mostrar modal SOLO si NO ha completado diagnóstico
        const diagnosticDone = Boolean(p?.diagnostic_completed);
        setShowDiagnosticModal(!diagnosticDone);

        // ✅ Precisión real desde lesson_progress
        const { data: progRows, error: progErr } = await supabase
          .from("lesson_progress")
          .select("correct_count, total_questions")
          .eq("user_id", user.id);

        if (progErr) {
          console.error("❌ Error leyendo lesson_progress:", progErr);
        }

        const rows = (Array.isArray(progRows) ? (progRows as LessonProgressRow[]) : []) as LessonProgressRow[];

        const sumCorrect = rows.reduce((acc, r) => acc + Number(r.correct_count ?? 0), 0);
        const sumTotal = rows.reduce((acc, r) => acc + Number(r.total_questions ?? 0), 0);

        const pct = sumTotal > 0 ? Math.round((sumCorrect / sumTotal) * 100) : 0;
        if (!mounted) return;
        setAccuracyPct(pct);

        // Cargar notificaciones
        const notifs = await getNotificationsForUser(user.id);
        if (!mounted) return;
        setNotifications(notifs);
      } catch (error) {
        console.error("❌ Error en loadUserData:", error);
      }
    };

    loadUserData();

    // refrescar al volver a la pestaña
    const onFocus = () => {
      loadUserData();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleMarkAsRead = async (notifId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await markAsRead(notifId, user.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await markAllAsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const formatNotifDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `Hace ${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  };

  const xpFmt = new Intl.NumberFormat("es-CO").format(xpTotal);

  return (
    <>
      {/* ✅ Modal diagnóstico */}
      <DiagnosticModal isOpen={showDiagnosticModal} onClose={() => setShowDiagnosticModal(false)} />

      {/* Fondo app */}
      <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
        {/* Contenedor móvil */}
        <div className="h-full w-full max-w-md bg-white rounded-[2.6rem] shadow-2xl overflow-hidden flex flex-col">
          {/* ✅ IMPORTANTE: NO ocultar el overlap (antes overflow-hidden lo recortaba) */}
          <div className="flex-1 overflow-visible flex flex-col">
            {/* HEADER estilo mockup */}
            <header className="bg-gradient-to-b from-indigo-500 to-violet-600 px-6 pt-6 pb-14 rounded-b-[2.6rem] text-white relative">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs opacity-90">¡Hola!</p>
                  <h1 className="mt-1 text-[20px] sm:text-2xl font-extrabold leading-tight truncate">
                    {userName}
                  </h1>
                  <p className="mt-1 text-[11px] sm:text-xs text-white/85">
                    Continúa tu viaje de aprendizaje
                  </p>
                  {userEmail ? (
                    <p className="mt-1 text-[10px] sm:text-[11px] text-white/75 truncate">{userEmail}</p>
                  ) : null}

                  {/* Logout (manteniendo lógica) */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-2 inline-flex items-center gap-2 text-[10px] sm:text-[11px] text-white/90 underline underline-offset-2 hover:text-white transition"
                  >
                    Cerrar sesión
                  </button>
                </div>

                {/* Campana + Avatar */}
                <div className="shrink-0 flex items-center gap-2">
                  {/* Notification bell */}
                  <div className="relative" ref={notifRef}>
                    <button
                      onClick={() => setShowNotifPanel(!showNotifPanel)}
                      className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
                    >
                      <Bell size={20} strokeWidth={2.2} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1 shadow-sm">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Notification panel - mobile: fixed fullscreen, desktop: dropdown */}
                    {showNotifPanel && (
                      <>
                        {/* Backdrop móvil */}
                        <div
                          className="fixed inset-0 bg-black/30 z-40 sm:hidden"
                          onClick={() => setShowNotifPanel(false)}
                        />
                        <div className="fixed inset-x-0 top-0 bottom-0 z-50 sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-80 sm:max-h-96 bg-white sm:rounded-2xl sm:shadow-xl sm:border sm:border-slate-100 overflow-hidden flex flex-col">
                          {/* Header */}
                          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 bg-white safe-top">
                            <h3 className="text-sm font-bold text-slate-900">Notificaciones</h3>
                            <div className="flex items-center gap-2">
                              {unreadCount > 0 && (
                                <button
                                  onClick={handleMarkAllRead}
                                  className="text-[11px] text-indigo-600 font-medium hover:underline"
                                >
                                  Marcar todas
                                </button>
                              )}
                              <button
                                onClick={() => setShowNotifPanel(false)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg"
                              >
                                <X size={18} className="text-slate-400" />
                              </button>
                            </div>
                          </div>

                          {/* List */}
                          <div className="flex-1 overflow-y-auto">
                            {notifications.length === 0 ? (
                              <div className="px-4 py-12 text-center">
                                <Bell size={36} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-sm text-slate-400">Sin notificaciones</p>
                              </div>
                            ) : (
                              notifications.map((notif) => (
                                <div
                                  key={notif.id}
                                  className={`px-4 py-3.5 border-b border-slate-100 last:border-b-0 ${
                                    !notif.is_read ? "bg-indigo-50/40" : ""
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        {!notif.is_read && (
                                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                        )}
                                        <p className={`text-sm ${!notif.is_read ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                                          {notif.title}
                                        </p>
                                      </div>
                                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        {notif.body}
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-1.5">
                                        {formatNotifDate(notif.sent_at)}
                                      </p>
                                    </div>
                                    {!notif.is_read && (
                                      <button
                                        onClick={() => handleMarkAsRead(notif.id)}
                                        className="shrink-0 p-2 hover:bg-indigo-100 rounded-xl transition-colors"
                                        title="Marcar como leída"
                                      >
                                        <Check size={16} className="text-indigo-500" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Avatar/Iniciales */}
                  <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 p-[2px] shadow-lg">
                    <div className="w-full h-full rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-[12px] font-extrabold">
                      {userInitials}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* MAIN */}
            <main className="-mt-10 flex-1 overflow-y-auto px-6 pb-6 bg-gradient-to-b from-white via-white to-amber-50/50">
              {/* ✅ Racha + Nivel (siempre al frente) */}
              <div
                className={[
                  "relative z-20", // 👈 queda por encima de todo
                  "bg-white rounded-3xl shadow-md border border-slate-100 px-4 py-3",
                  "transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <Flame className="text-orange-500" size={18} strokeWidth={2.5} />
                    </div>
                    <div className="leading-tight">
                      <p className="text-[10px] text-slate-500 font-semibold">Racha</p>
                      <p className="text-lg font-extrabold text-indigo-700">{streakDays} días</p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <div className="rounded-full bg-indigo-600 text-white px-4 py-2 text-[11px] font-semibold shadow-sm">
                      {userLevel ? `Nivel ${userLevel}` : "Nivel —"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats cards */}
              <section className="mt-4 grid grid-cols-3 gap-3">
                <div
                  className={[
                    "bg-white rounded-2xl shadow-sm border border-slate-100 px-3 py-3 text-center",
                    "transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
                  ].join(" ")}
                >
                  <p className="text-[10px] text-slate-500 font-semibold">XP TOTAL</p>
                  <p className="mt-1 text-lg font-extrabold text-indigo-700">{xpFmt}</p>
                </div>

                <div
                  className={[
                    "bg-white rounded-2xl shadow-sm border border-slate-100 px-3 py-3 text-center",
                    "transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
                  ].join(" ")}
                >
                  <p className="text-[10px] text-slate-500 font-semibold">LECCIONES</p>
                  <p className="mt-1 text-lg font-extrabold text-indigo-700">{lessonsDone}</p>
                </div>

                <div
                  className={[
                    "bg-white rounded-2xl shadow-sm border border-slate-100 px-3 py-3 text-center",
                    "transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
                  ].join(" ")}
                >
                  <p className="text-[10px] text-slate-500 font-semibold">PRECISIÓN</p>
                  <p className="mt-1 text-lg font-extrabold text-indigo-700">{accuracyPct}%</p>
                </div>
              </section>

              {/* Continúa aprendiendo */}
              <section className="mt-5 space-y-3">
                <h2 className="text-sm font-extrabold text-slate-900">Continúa aprendiendo</h2>

                <Link to="/lessons" className="block group">
                  <div
                    className={[
                      "bg-white rounded-2xl px-4 py-4 shadow-sm border border-slate-100 flex items-center justify-between gap-3",
                      "transition-all duration-200",
                      "hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900">Ir a Lecciones</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {userLevel ? `Nivel ${userLevel}` : "Selecciona un nivel"} · Practica y gana XP
                      </p>
                    </div>

                    <div className="shrink-0">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white grid place-items-center shadow-sm transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                        <ChevronRight size={20} strokeWidth={2.8} />
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Admin Panel Link - Solo visible para admins */}
                {isAdmin && (
                  <Link to="/admin" className="block group">
                    <div
                      className={[
                        "rounded-2xl px-4 py-4 shadow-sm flex items-center justify-between gap-3",
                        "bg-gradient-to-r from-indigo-600 to-violet-600",
                        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-white">Panel de Administración</p>
                        <p className="mt-1 text-[11px] text-white/80">Gestionar usuarios, lecciones y contenido</p>
                      </div>

                      <div className="shrink-0">
                        <div className="w-10 h-10 rounded-full bg-white/15 border border-white/20 grid place-items-center backdrop-blur transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                          <Settings size={20} className="text-white" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {/* Banner de instalación PWA */}
                <div className="pt-1">
                  <InstallBanner />
                </div>
              </section>
            </main>
          </div>

          {/* NAV inferior */}
          <nav className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-around text-[11px] rounded-t-[1.8rem] shadow-[0_-10px_30px_rgba(0,0,0,0.06)]">
            <Link
              to="/"
              className="flex flex-col items-center gap-1.5 text-indigo-600 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <Home size={24} strokeWidth={2.5} className="stroke-current" />
              <span className="font-semibold">Inicio</span>
            </Link>

            <Link
              to="/lessons"
              className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <BookOpen size={24} strokeWidth={2.5} className="stroke-current" />
              <span>Lecciones</span>
            </Link>

            <Link
              to="/rankings"
              className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <Trophy size={24} strokeWidth={2.5} className="stroke-current" />
              <span>Rankings</span>
            </Link>

            <Link
              to="/profile"
              className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <User size={24} strokeWidth={2.5} className="stroke-current" />
              <span>Perfil</span>
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
