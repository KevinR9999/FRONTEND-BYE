// src/pages/Profile/SettingsPage.tsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BottomNav from "../../components/BottomNav";
import { supabase } from "../../lib/supabaseClient";
import { ensurePushSubscription } from "./settings/pushClient";
import { useSettingsStore } from "./settings/settingsStore";

type UserInfo = {
  id: string;
  email: string | null;
};

// ---- LocalStorage helpers (sin afectar UI) ----
const LS = {
  dailyReminder: "bye_settings_dailyReminder",
  streakAlert: "bye_settings_streakAlert",
  newLessons: "bye_settings_newLessons",
  unlockedAchievements: "bye_settings_unlockedAchievements",
  friendsActivity: "bye_settings_friendsActivity",
  offlineMode: "bye_settings_offlineMode",
  appSounds: "bye_settings_appSounds",
};

function safeGetBool(key: string, fallback: boolean) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeSetBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

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

  // ✅ STORE settings (Supabase)
  const settings = useSettingsStore((s) => s.settings);
  const initSettings = useSettingsStore((s) => s.init);
  const updateSettings = useSettingsStore((s) => s.update);

  // Toggles locales (UI) + persistencia localStorage
  const [dailyReminder, setDailyReminder] = useState<boolean>(() =>
    safeGetBool(LS.dailyReminder, true)
  );
  const [streakAlert, setStreakAlert] = useState<boolean>(() =>
    safeGetBool(LS.streakAlert, true)
  );
  const [newLessons, setNewLessons] = useState<boolean>(() =>
    safeGetBool(LS.newLessons, false)
  );
  const [unlockedAchievements, setUnlockedAchievements] = useState<boolean>(() =>
    safeGetBool(LS.unlockedAchievements, true)
  );
  const [friendsActivity, setFriendsActivity] = useState<boolean>(() =>
    safeGetBool(LS.friendsActivity, false)
  );
  const [appSounds, setAppSounds] = useState<boolean>(() =>
    safeGetBool(LS.appSounds, true)
  );
  const [offlineMode, setOfflineMode] = useState<boolean>(() =>
    safeGetBool(LS.offlineMode, false)
  );

  // ✅ Objetivo diario: viene de Supabase si existe, si no 15 (misma UI)
  const dailyGoalMinutes = settings?.daily_goal_minutes ?? 15;

  const navigate = useNavigate();
  const reconciledForUser = useRef<string | null>(null);

  const masterNotifications = (o?: Partial<{
    daily: boolean;
    streak: boolean;
    lessons: boolean;
    achievements: boolean;
    friends: boolean;
  }>) => {
    const daily = o?.daily ?? dailyReminder;
    const streak = o?.streak ?? streakAlert;
    const lessons = o?.lessons ?? newLessons;
    const achievements = o?.achievements ?? unlockedAchievements;
    const friends = o?.friends ?? friendsActivity;
    return daily || streak || lessons || achievements || friends;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
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
          console.error("Error cargando perfil en configuración:", profileError);
        } else if (profileRow) {
          setIsPrivate(!!profileRow.is_private);
        }

        await initSettings(u.id);
      } catch (err) {
        console.error("Error cargando configuración:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, initSettings]);


  useEffect(() => {
  // ✅ test rápido: solo cuando estés logueado y tengas subs guardada
  const run = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;

      const res = await supabase.functions.invoke("push-test", {
        body: { title: "BYE", body: "Push OK ✅", url: "/profile" },
      });

      console.log("✅ push-test (auth) =>", res);
    } catch (e) {
      console.error("❌ push-test (auth) error =>", e);
    }
  };

  run();
}, []);


  useEffect(() => {
    if (!settings?.user_id) return;

    // ✅ Refresca UI con valores reales desde Supabase
    setAppSounds(settings.sound_enabled);
    setDailyReminder(settings.daily_reminder_enabled);
    setStreakAlert(settings.notify_streak_alert);
    setNewLessons(settings.notify_new_lessons);
    setUnlockedAchievements(settings.notify_achievements);
    setFriendsActivity(settings.notify_friends_activity);

    if (reconciledForUser.current === settings.user_id) return;
    reconciledForUser.current = settings.user_id;

    // Reconciliación 1 vez (manteniendo tu patrón actual)
    const localDaily = safeGetBool(LS.dailyReminder, settings.daily_reminder_enabled);
    const localStreak = safeGetBool(LS.streakAlert, settings.notify_streak_alert);
    const localLessons = safeGetBool(LS.newLessons, settings.notify_new_lessons);
    const localAch = safeGetBool(LS.unlockedAchievements, settings.notify_achievements);
    const localFriends = safeGetBool(LS.friendsActivity, settings.notify_friends_activity);
    const localSounds = safeGetBool(LS.appSounds, settings.sound_enabled);

    const patch: any = {};
    let needsPatch = false;

    if (localDaily !== settings.daily_reminder_enabled) {
      patch.daily_reminder_enabled = localDaily;
      needsPatch = true;
    }
    if (localStreak !== settings.notify_streak_alert) {
      patch.notify_streak_alert = localStreak;
      needsPatch = true;
    }
    if (localLessons !== settings.notify_new_lessons) {
      patch.notify_new_lessons = localLessons;
      needsPatch = true;
    }
    if (localAch !== settings.notify_achievements) {
      patch.notify_achievements = localAch;
      needsPatch = true;
    }
    if (localFriends !== settings.notify_friends_activity) {
      patch.notify_friends_activity = localFriends;
      needsPatch = true;
    }
    if (localSounds !== settings.sound_enabled) {
      patch.sound_enabled = localSounds;
      needsPatch = true;
    }

    // Mantener master coherente
    const master = localDaily || localStreak || localLessons || localAch || localFriends;
    if (master !== settings.notifications_enabled) {
      patch.notifications_enabled = master;
      needsPatch = true;
    }

    if (needsPatch) {
      void updateSettings(patch);
    }
  }, [
    settings?.user_id,
    settings?.sound_enabled,
    settings?.daily_reminder_enabled,
    settings?.notify_streak_alert,
    settings?.notify_new_lessons,
    settings?.notify_achievements,
    settings?.notify_friends_activity,
    settings?.notifications_enabled,
    updateSettings,
  ]);

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
      const { error } = await supabase.auth.updateUser({ email: newEmail });

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
      <div className="h-full w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-slate-900">
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

        <main className="flex-1 bg-slate-50 overflow-y-auto text-sm">
          <section className="mt-2">
            <div className="px-6 py-2 bg-slate-100 text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
              Notificaciones
            </div>

            <div className="bg-white">
              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100">
                <span>Recordatorio diario</span>
                <Switch
                  enabled={dailyReminder}
                  onChange={async () => {
                    const next = !dailyReminder;

                    if (next && user) {
                      const ok = await ensurePushSubscription(user.id);
                      if (!ok) return;
                    }

                    setDailyReminder(next);
                    safeSetBool(LS.dailyReminder, next);

                    void updateSettings({
                      daily_reminder_enabled: next,
                      notifications_enabled: masterNotifications({ daily: next }),
                    });
                  }}
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
                  onChange={async () => {
                    const next = !streakAlert;

                    if (next && user) {
                      const ok = await ensurePushSubscription(user.id);
                      if (!ok) return;
                    }

                    setStreakAlert(next);
                    safeSetBool(LS.streakAlert, next);

                    void updateSettings({
                      notify_streak_alert: next,
                      notifications_enabled: masterNotifications({ streak: next }),
                    });
                  }}
                />
              </div>

              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100">
                <span>Nuevas lecciones</span>
                <Switch
                  enabled={newLessons}
                  onChange={async () => {
                    const next = !newLessons;

                    if (next && user) {
                      const ok = await ensurePushSubscription(user.id);
                      if (!ok) return;
                    }

                    setNewLessons(next);
                    safeSetBool(LS.newLessons, next);

                    void updateSettings({
                      notify_new_lessons: next,
                      notifications_enabled: masterNotifications({ lessons: next }),
                    });
                  }}
                />
              </div>

              <div className="px-6 py-3 flex items-center justify-between border-b border-slate-100">
                <span>Logros desbloqueados</span>
                <Switch
                  enabled={unlockedAchievements}
                  onChange={async () => {
                    const next = !unlockedAchievements;

                    if (next && user) {
                      const ok = await ensurePushSubscription(user.id);
                      if (!ok) return;
                    }

                    setUnlockedAchievements(next);
                    safeSetBool(LS.unlockedAchievements, next);

                    void updateSettings({
                      notify_achievements: next,
                      notifications_enabled: masterNotifications({ achievements: next }),
                    });
                  }}
                />
              </div>

              <div className="px-6 py-3 flex items-center justify-between">
                <span>Actividad de amigos</span>
                <Switch
                  enabled={friendsActivity}
                  onChange={async () => {
                    const next = !friendsActivity;

                    if (next && user) {
                      const ok = await ensurePushSubscription(user.id);
                      if (!ok) return;
                    }

                    setFriendsActivity(next);
                    safeSetBool(LS.friendsActivity, next);

                    void updateSettings({
                      notify_friends_activity: next,
                      notifications_enabled: masterNotifications({ friends: next }),
                    });
                  }}
                />
              </div>
            </div>
          </section>

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
                  onChange={() => {
                    const next = !appSounds;
                    setAppSounds(next);
                    safeSetBool(LS.appSounds, next);
                    void updateSettings({ sound_enabled: next });
                  }}
                />
              </div>

              <div className="px-6 py-3 flex items-center justify-between">
                <span>Modo offline</span>
                <Switch
                  enabled={offlineMode}
                  onChange={() => {
                    const next = !offlineMode;
                    setOfflineMode(next);
                    safeSetBool(LS.offlineMode, next);
                  }}
                />
              </div>
            </div>
          </section>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
