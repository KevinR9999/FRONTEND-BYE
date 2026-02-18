// src/pages/Ranking/RankingPage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Crown, Medal, Sparkles, Trophy } from "lucide-react";
import BottomNav from "../../components/BottomNav";
import { supabase } from "../../lib/supabaseClient";
import { useAuthStore } from "../../store/authStore";

type RankingUser = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  level: string | null;
  xp_total: number;
  streak_days: number;
  lessons_completed: number;
};

export default function RankingPage() {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<RankingUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'monthly' | 'weekly'>('weekly');

  const getRankingTitle = () => {
    return timeFilter === 'weekly'
      ? '🏆 Top 3 de la Semana 🏆'
      : '🏆 Top 3 del Mes 🏆';
  };

  const getListTitle = () => {
    return timeFilter === 'weekly'
      ? 'Clasificación Semanal'
      : 'Clasificación Mensual';
  };

  useEffect(() => {
    const loadRankings = async () => {
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr || !user) {
          navigate("/login");
          return;
        }

        setCurrentUserId(user.id);

        // Calcular rangos de fechas
        const now = new Date();
        let startDate: Date | null = null;

        if (timeFilter === 'weekly') {
          // Lunes de esta semana a sábado (semana actual de lunes a sábado)
          const today = now.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
          const daysFromMonday = today === 0 ? 6 : today - 1; // Si es domingo, retroceder 6 días
          startDate = new Date(now);
          startDate.setDate(now.getDate() - daysFromMonday);
          startDate.setHours(0, 0, 0, 0);
        } else if (timeFilter === 'monthly') {
          // Primer día del mes actual
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
        }

        // Obtener todos los perfiles públicos con los campos de XP apropiados
        const { data: profiles, error: profilesErr } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, level, xp_total, weekly_xp, monthly_xp, last_weekly_reset, last_monthly_reset, streak_days, lessons_completed, is_private")
          .limit(100);

        if (profilesErr) {
          console.error("Error cargando rankings:", profilesErr);
          return;
        }

        // Filtrar solo perfiles públicos (excepto el usuario actual)
        const publicProfiles = (profiles || []).filter(
          (p) => !p.is_private || p.user_id === user.id
        );

        // Determinar qué campo de XP usar según el filtro
        const xpField: 'weekly_xp' | 'monthly_xp' = timeFilter === 'weekly' ? 'weekly_xp' : 'monthly_xp';
        const resetField = timeFilter === 'weekly' ? 'last_weekly_reset' : 'last_monthly_reset';

        // Mapear perfiles con el XP correspondiente al filtro
        const rankingsWithXP: RankingUser[] = publicProfiles.map((profile) => {
          const displayName = profile.full_name ||
                             (profile.user_id === user.id
                               ? (user.user_metadata?.full_name ||
                                  user.user_metadata?.name ||
                                  user.email?.split("@")[0] ||
                                  "Usuario")
                               : `Usuario ${profile.user_id.substring(0, 8)}`);

          // Verificar si el XP es del período actual o de uno anterior
          let xp = Number((profile as any)[xpField] ?? 0);
          const lastReset = (profile as any)[resetField]
            ? new Date((profile as any)[resetField])
            : null;

          if (lastReset && startDate && lastReset < startDate) {
            // El XP es de un período anterior, mostrar como 0
            xp = 0;
          }

          return {
            user_id: profile.user_id,
            display_name: displayName,
            avatar_url: profile.avatar_url,
            level: profile.level,
            xp_total: xp,
            streak_days: Number(profile.streak_days ?? 0),
            lessons_completed: Number(profile.lessons_completed ?? 0),
          };
        });

        // Ordenar por XP y tomar top 100
        rankingsWithXP.sort((a, b) => b.xp_total - a.xp_total);
        setRankings(rankingsWithXP.slice(0, 100));
      } catch (err) {
        console.error("Error inesperado cargando rankings:", err);
      } finally {
        setLoading(false);
      }
    };

    loadRankings();
  }, [navigate, timeFilter]);

  const getInitials = (name: string) => {
    const names = name.trim().split(" ").filter(Boolean);
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return (names[0]?.[0] || "U").toUpperCase();
  };

  const getPodiumColor = (position: number) => {
    switch (position) {
      case 1:
        return "from-amber-400 to-yellow-500";
      case 2:
        return "from-slate-300 to-slate-400";
      case 3:
        return "from-orange-400 to-amber-600";
      default:
        return "from-slate-200 to-slate-300";
    }
  };

  const getPodiumHeight = (position: number) => {
    switch (position) {
      case 1:
        return "h-28";
      case 2:
        return "h-20";
      case 3:
        return "h-16";
      default:
        return "h-12";
    }
  };

  const topThree = rankings.slice(0, 3);
  const restOfRankings = rankings.slice(3);

  return (
    <div className="h-screen w-full bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 flex items-center justify-center px-3 sm:px-4">
      <div className="h-full w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* HEADER */}
        <header className="bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 px-5 sm:px-6 pt-5 pb-4 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLW9wYWNpdHk9Ii4xIiBzdHJva2Utd2lkdGg9IjIiLz48L2c+PC9zdmc+')] opacity-30"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="relative">
                <Trophy size={32} strokeWidth={2.5} className="text-amber-300" />
                <Sparkles size={16} className="absolute -top-1 -right-1 text-yellow-300 animate-pulse" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-amber-200">
                Rankings
              </h1>
            </div>
            <p className="text-center text-xs sm:text-sm text-white/90 font-medium">
              Compite con los mejores y alcanza la cima
            </p>
          </div>
        </header>

        {/* TABS DE FILTRO */}
        <div className="bg-white px-5 sm:px-6 py-3 border-b border-slate-200">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setLoading(true);
                setTimeFilter('monthly');
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all ${
                timeFilter === 'monthly'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => {
                setLoading(true);
                setTimeFilter('weekly');
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all ${
                timeFilter === 'weekly'
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semanal
            </button>
          </div>
          {timeFilter === 'weekly' && (
            <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-800 font-medium text-center">
                🎁 Lunes a Sábado - El #1 gana un premio del instituto
              </p>
            </div>
          )}
        </div>

        {/* CONTENIDO */}
        <main className="flex-1 bg-slate-50 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="px-5 sm:px-6 py-4 space-y-6">
              {/* PODIO TOP 3 */}
              {topThree.length > 0 && (
                <section className="bg-gradient-to-b from-indigo-50 via-violet-50 to-white rounded-3xl p-5 shadow-lg border border-indigo-100">
                  <h3 className="text-center text-sm font-bold text-slate-600 mb-4">{getRankingTitle()}</h3>
                  <div className="flex items-end justify-center gap-4 sm:gap-5 px-2">
                    {/* 2do lugar */}
                    {topThree[1] && (
                      <div className="flex flex-col items-center w-[28%]">

                        <div className="relative mb-2">
                          {topThree[1].avatar_url ? (
                            <img
                              src={topThree[1].avatar_url}
                              alt={topThree[1].display_name}
                              loading="lazy"
                              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-3 border-slate-300 object-cover shadow-lg"
                            />
                          ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-3 border-slate-300 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-base shadow-lg">
                              {getInitials(topThree[1].display_name)}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white">
                            <span className="text-white text-xs font-bold">2</span>
                          </div>
                        </div>
                        <div className="w-full bg-gradient-to-b from-slate-300 to-slate-400 rounded-t-2xl h-20 flex flex-col items-center justify-center text-white shadow-xl">
                          <Medal size={16} className="mb-0.5 drop-shadow-md" />
                          <p className="text-[10px] font-bold text-center px-1 truncate w-full drop-shadow-sm">
                            {topThree[1].display_name}
                          </p>
                          <p className="text-[10px] font-semibold mt-0.5">{topThree[1].xp_total.toLocaleString()} XP</p>
                        </div>
                      </div>
                    )}

                    {/* 1er lugar */}
                    {topThree[0] && (
                      <div className="flex flex-col items-center w-[32%]">

                        <div className="relative mb-2">
                          {topThree[0].avatar_url ? (
                            <img
                              src={topThree[0].avatar_url}
                              alt={topThree[0].display_name}
                              loading="eager"
                              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-amber-400 object-cover shadow-2xl ring-4 ring-amber-200/50"
                            />
                          ) : (
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-amber-400 bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center text-amber-700 font-bold text-xl shadow-2xl ring-4 ring-amber-200/50">
                              {getInitials(topThree[0].display_name)}
                            </div>
                          )}
                          <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center shadow-xl ring-2 ring-white animate-pulse">
                            <Crown size={22} className="text-white drop-shadow-md" />
                          </div>
                        </div>
                        <div className="w-full bg-gradient-to-b from-amber-400 via-yellow-500 to-amber-600 rounded-t-2xl h-28 flex flex-col items-center justify-center text-white shadow-2xl">
                          <Trophy size={20} className="mb-1 drop-shadow-lg" />
                          <p className="text-xs font-bold text-center px-1 truncate w-full drop-shadow-md">
                            {topThree[0].display_name}
                          </p>
                          <p className="text-xs font-bold mt-0.5 drop-shadow-sm">{topThree[0].xp_total.toLocaleString()} XP</p>
                        </div>
                      </div>
                    )}

                    {/* 3er lugar */}
                    {topThree[2] && (
                      <div className="flex flex-col items-center w-[28%]">

                        <div className="relative mb-2">
                          {topThree[2].avatar_url ? (
                            <img
                              src={topThree[2].avatar_url}
                              alt={topThree[2].display_name}
                              loading="lazy"
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-3 border-orange-400 object-cover shadow-lg"
                            />
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-3 border-orange-400 bg-gradient-to-br from-orange-200 to-orange-400 flex items-center justify-center text-orange-700 font-bold text-sm shadow-lg">
                              {getInitials(topThree[2].display_name)}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white">
                            <span className="text-white text-xs font-bold">3</span>
                          </div>
                        </div>
                        <div className="w-full bg-gradient-to-b from-orange-400 to-orange-600 rounded-t-2xl h-16 flex flex-col items-center justify-center text-white shadow-xl">
                          <Medal size={14} className="mb-0.5 drop-shadow-md" />
                          <p className="text-[10px] font-bold text-center px-1 truncate w-full drop-shadow-sm">
                            {topThree[2].display_name}
                          </p>
                          <p className="text-[10px] font-semibold mt-0.5">{topThree[2].xp_total.toLocaleString()} XP</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* RESTO DEL RANKING */}
              {restOfRankings.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-base font-bold text-slate-700 px-2 flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-full"></div>
                    {getListTitle()}
                  </h2>
                  {restOfRankings.map((user, index) => {
                    const position = index + 4;
                    const isCurrentUser = user.user_id === currentUserId;

                    return (
                      <div
                        key={user.user_id}
                        className={`
                          bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-md border-2 transition-all
                          ${isCurrentUser ? "border-indigo-400 bg-gradient-to-r from-indigo-50 to-violet-50" : "border-slate-100"}
                        `}
                      >
                        <div className={`flex items-center justify-center w-9 h-9 rounded-xl font-bold text-sm shadow-sm ${isCurrentUser ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                          {position}
                        </div>

                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.display_name}
                            loading="lazy"
                            className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-md ring-2 ring-indigo-100"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-base shadow-md ring-2 ring-indigo-100">
                            {getInitials(user.display_name)}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${isCurrentUser ? "text-indigo-700" : "text-slate-900"}`}>
                            {user.display_name} {isCurrentUser && <span className="text-indigo-500">(Tú)</span>}
                          </p>
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-0.5">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-full">Nivel {user.level || "A1"}</span>
                            <span>·</span>
                            <span>{user.lessons_completed} lecciones</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs font-bold text-amber-600">{user.xp_total.toLocaleString()} XP</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}

              {rankings.length === 0 && !loading && (
                <div className="text-center py-12">
                  <Trophy size={48} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No hay rankings disponibles</p>
                </div>
              )}
            </div>
          )}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
