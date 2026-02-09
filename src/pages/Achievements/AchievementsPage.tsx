// src/pages/Achievements/AchievementsPage.tsx
import {
  BookOpen,
  CheckCircle,
  ChevronLeft,
  Home,
  Lock,
  Trophy,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { achievementService } from "../../services/achievementService";
import type { AchievementWithStatus, AchievementCategory, UserStatsForAchievements } from "../../types/achievements";

// Colores por categoría
const categoryColors: Record<AchievementCategory, { bg: string; border: string; bar: string; barBg: string; badge: string; text: string }> = {
  lessons:    { bg: "bg-blue-50",   border: "border-blue-300",   bar: "bg-blue-500",   barBg: "bg-blue-100",   badge: "bg-blue-500",   text: "text-blue-700" },
  xp:         { bg: "bg-amber-50",  border: "border-amber-300",  bar: "bg-amber-500",  barBg: "bg-amber-100",  badge: "bg-amber-500",  text: "text-amber-700" },
  streak:     { bg: "bg-orange-50", border: "border-orange-300", bar: "bg-orange-500", barBg: "bg-orange-100", badge: "bg-orange-500", text: "text-orange-700" },
  accuracy:   { bg: "bg-emerald-50",border: "border-emerald-300",bar: "bg-emerald-500",barBg: "bg-emerald-100",badge: "bg-emerald-500",text: "text-emerald-700" },
  diagnostic: { bg: "bg-violet-50", border: "border-violet-300", bar: "bg-violet-500", barBg: "bg-violet-100", badge: "bg-violet-500", text: "text-violet-700" },
  levels:     { bg: "bg-indigo-50", border: "border-indigo-300", bar: "bg-indigo-500", barBg: "bg-indigo-100", badge: "bg-indigo-500", text: "text-indigo-700" },
  social:     { bg: "bg-pink-50",   border: "border-pink-300",   bar: "bg-pink-500",   barBg: "bg-pink-100",   badge: "bg-pink-500",   text: "text-pink-700" },
};

const categoryNames: Record<AchievementCategory, string> = {
  lessons: "Lecciones",
  xp: "Puntos XP",
  streak: "Racha",
  accuracy: "Precisión",
  diagnostic: "Diagnóstico",
  levels: "Niveles",
  social: "Social",
};

function getProgress(
  achievement: AchievementWithStatus,
  stats: UserStatsForAchievements | null
): { current: number; target: number; label: string } | null {
  if (!stats || achievement.unlocked) return null;

  switch (achievement.category) {
    case "lessons":
      return { current: Math.min(stats.lessons_completed, achievement.threshold), target: achievement.threshold, label: "lecciones" };
    case "xp":
      return { current: Math.min(stats.xp_total, achievement.threshold), target: achievement.threshold, label: "XP" };
    case "streak":
      return { current: Math.min(stats.streak_days, achievement.threshold), target: achievement.threshold, label: "días" };
    case "social":
      return { current: Math.min(stats.friends_count, achievement.threshold), target: achievement.threshold, label: "amigos" };
    case "diagnostic":
      return stats.diagnostic_completed ? null : { current: 0, target: 1, label: "" };
    default:
      return null;
  }
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | "all">("all");
  const [userStats, setUserStats] = useState<UserStatsForAchievements | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/login"); return; }

        // Cargar stats del usuario
        const { data: profile } = await supabase
          .from("profiles")
          .select("xp_total, lessons_completed, streak_days, diagnostic_completed")
          .eq("user_id", user.id)
          .single();

        const friendsCount = await achievementService.getFriendsCount(user.id);

        const stats: UserStatsForAchievements = {
          xp_total: profile?.xp_total || 0,
          lessons_completed: profile?.lessons_completed || 0,
          streak_days: profile?.streak_days || 0,
          diagnostic_completed: profile?.diagnostic_completed || false,
          friends_count: friendsCount,
        };

        setUserStats(stats);

        // Sincronizar logros: desbloquear los que ya cumple (usuarios viejos)
        await achievementService.checkAndUnlockAchievements(user.id, stats);

        // Cargar logros actualizados
        const data = await achievementService.getAchievementsWithStatus(user.id);
        setAchievements(data);

        await achievementService.markAsSeen(user.id);
      } catch (err) {
        console.error("Error cargando logros:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAchievements();
  }, [navigate]);

  const filteredAchievements = selectedCategory === "all"
    ? achievements
    : achievements.filter(a => a.category === selectedCategory);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const categories: (AchievementCategory | "all")[] = ["all", "lessons", "xp", "streak", "accuracy", "diagnostic", "levels", "social"];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4 py-6">
      <div className="h-[820px] w-full max-w-[390px] rounded-[34px] bg-white shadow-2xl overflow-hidden flex flex-col relative">

        {/* Header */}
        <header className="relative px-5 pt-10 pb-6 text-white bg-gradient-to-b from-blue-600 via-blue-700 to-indigo-800">
          <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-[1px]" />
          <div className="pointer-events-none absolute -top-10 -left-20 h-44 w-44 rounded-full bg-white/10 blur-[1px]" />

          <div className="relative">
            <button onClick={() => navigate(-1)} className="absolute left-0 top-0 p-2 -ml-2 rounded-full hover:bg-white/20 transition">
              <ChevronLeft size={24} />
            </button>

            <div className="text-center pt-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-3">
                <Trophy size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-extrabold">Logros</h1>
              <p className="text-white/80 text-sm mt-1">
                {unlockedCount} de {totalCount} desbloqueados
              </p>
              <div className="mt-4 mx-auto max-w-[200px]">
                <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Filtros */}
        <div className="px-4 py-3 bg-white border-b border-slate-100 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat === "all" ? "Todos" : categoryNames[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <main className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filteredAchievements.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Trophy size={40} className="mx-auto mb-2 opacity-50" />
              <p>No hay logros en esta categoría</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredAchievements.map(achievement => {
                const colors = categoryColors[achievement.category] || categoryColors.lessons;
                const progress = getProgress(achievement, userStats);
                const pct = progress ? Math.round((progress.current / progress.target) * 100) : 0;

                return (
                  <div
                    key={achievement.id}
                    className={`rounded-2xl p-4 border-2 transition-all ${
                      achievement.unlocked
                        ? `${colors.bg} ${colors.border} shadow-sm`
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Imagen del logro - GRANDE */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-[72px] h-[72px] rounded-2xl flex items-center justify-center overflow-hidden ${
                          achievement.unlocked
                            ? "bg-white shadow-md ring-2 ring-white"
                            : "bg-slate-100"
                        }`}>
                          <img
                            src={`/achievements/${achievement.code}.png`}
                            alt={achievement.title}
                            className={`w-16 h-16 object-contain ${
                              achievement.unlocked ? "drop-shadow-md" : "opacity-30 grayscale"
                            }`}
                            onError={(e) => {
                              const t = e.target as HTMLImageElement;
                              t.style.display = "none";
                              if (t.parentElement) {
                                const fallback = document.createElement("div");
                                fallback.className = `flex items-center justify-center w-full h-full ${achievement.unlocked ? colors.text : "text-slate-300"}`;
                                fallback.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5.4 4 6 4.7 6 5.5V17a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6V5.5c0-.8.6-1.5 1.5-1.5a2.5 2.5 0 0 1 0 5H18"/></svg>';
                                t.parentElement.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                        {/* Check verde si está desbloqueado */}
                        {achievement.unlocked && (
                          <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${colors.badge} flex items-center justify-center ring-2 ring-white`}>
                            <CheckCircle size={14} className="text-white" />
                          </div>
                        )}
                        {/* Candado si está bloqueado */}
                        {!achievement.unlocked && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center ring-2 ring-white">
                            <Lock size={12} className="text-white" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-bold text-[13px] leading-tight ${
                          achievement.unlocked ? "text-slate-900" : "text-slate-500"
                        }`}>
                          {achievement.title}
                        </h3>
                        <p className={`text-[11px] mt-0.5 leading-snug ${
                          achievement.unlocked ? "text-slate-600" : "text-slate-400"
                        }`}>
                          {achievement.description}
                        </p>

                        {/* Barra de progreso */}
                        {!achievement.unlocked && progress && (
                          <div className="mt-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-bold text-slate-500">
                                {progress.current.toLocaleString()}/{progress.target.toLocaleString()} {progress.label}
                              </span>
                              <span className={`text-[10px] font-bold ${colors.text}`}>
                                {pct}%
                              </span>
                            </div>
                            <div className={`h-2 ${colors.barBg} rounded-full overflow-hidden`}>
                              <div
                                className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* XP ganado */}
                        {achievement.xp_reward > 0 && achievement.unlocked && (
                          <div className="mt-1.5 inline-flex items-center gap-1">
                            <Zap size={12} className="text-amber-500" />
                            <span className="text-xs text-amber-600 font-bold">+{achievement.xp_reward} XP</span>
                          </div>
                        )}

                        {/* XP potencial */}
                        {achievement.xp_reward > 0 && !achievement.unlocked && (
                          <div className="mt-1.5 inline-flex items-center gap-1">
                            <Zap size={11} className="text-slate-300" />
                            <span className="text-[10px] text-slate-400">+{achievement.xp_reward} XP</span>
                          </div>
                        )}

                        {/* Fecha desbloqueo */}
                        {achievement.unlocked && achievement.unlocked_at && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(achievement.unlocked_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200">
          <nav className="px-6 py-3 flex justify-around text-[11px]">
            <Link to="/" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-violet-600 transition-colors">
              <Home size={26} strokeWidth={2.5} />
              <span>Inicio</span>
            </Link>
            <Link to="/lessons" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-violet-600 transition-colors">
              <BookOpen size={26} strokeWidth={2.5} />
              <span>Lecciones</span>
            </Link>
            <Link to="/rankings" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-violet-600 transition-colors">
              <Trophy size={26} strokeWidth={2.5} />
              <span>Rankings</span>
            </Link>
            <Link to="/profile" className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-violet-600 transition-colors">
              <User size={26} strokeWidth={2.5} />
              <span>Perfil</span>
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
