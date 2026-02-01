import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getMyFriendships,
    getMyUserId,
    getProfile,
    getStats,
    sendFriendRequest,
} from "../../services/friendsService";
import { pairKey } from "../../services/socialHelpers";
import type { FriendshipRow, ProfileStats, PublicProfile } from "../../types/social";

export default function FriendProfilePage() {
  const { id } = useParams(); // friend user_id
  const friendId = id || "";
  const navigate = useNavigate();

  const [me, setMe] = useState<string>("");
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const friendship = useMemo(() => {
    if (!me || !friendId) return null;
    const k = pairKey(me, friendId);
    const m = new Map(friendships.map((f) => [`${f.user1}:${f.user2}`, f]));
    return m.get(k) ?? null;
  }, [me, friendId, friendships]);

  const isFriend = friendship?.status === "accepted";
  const isPending = friendship?.status === "pending";

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);

        const uid = await getMyUserId();
        if (!mounted) return;
        setMe(uid);

        const f = await getMyFriendships();
        if (!mounted) return;
        setFriendships(f);

        const p = await getProfile(friendId);
        if (!mounted) return;
        setProfile(p);

        const s = await getStats(friendId);
        if (!mounted) return;
        setStats(s);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Error cargando perfil");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [friendId]);

  async function handleAdd() {
    try {
      setSending(true);
      setError(null);
      await sendFriendRequest(friendId);
      const f = await getMyFriendships();
      setFriendships(f);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "No se pudo enviar la solicitud");
    } finally {
      setSending(false);
    }
  }

  if (!friendId) {
    return <div className="min-h-screen bg-slate-50 p-6 text-slate-700">Usuario inválido</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <button onClick={() => navigate(-1)} className="text-slate-700 font-semibold">
          ← Volver
        </button>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-slate-600">Cargando…</div>
        ) : !profile ? (
          <div className="mt-6 text-slate-600">No se encontró el usuario.</div>
        ) : (
          <>
            <div className="mt-4 rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-3">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xl">
                    {(profile.full_name?.[0] || "U").toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="text-xl font-bold text-slate-900 truncate">
                    {profile.full_name || "Usuario"}
                  </div>
                  <div className="text-slate-600 truncate">
                    Nivel {profile.level || "—"}
                  </div>
                </div>

                <div className="ml-auto flex gap-2">
                  {isFriend ? (
                    <button
                      onClick={() => navigate(`/friends/chat/${profile.user_id}`)}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-white font-semibold"
                    >
                      Chatear
                    </button>
                  ) : isPending ? (
                    <span className="rounded-xl bg-slate-100 px-4 py-2 text-slate-700 font-semibold">
                      Pendiente
                    </span>
                  ) : (
                    <button
                      onClick={handleAdd}
                      disabled={sending}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-white font-semibold disabled:opacity-50"
                    >
                      {sending ? "Enviando…" : "Agregar"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
              <h2 className="text-lg font-bold text-slate-900">Estadísticas</h2>
              <p className="text-slate-600 text-sm">
                {isFriend
                  ? "Estas estadísticas se muestran porque son amigos."
                  : "Las estadísticas completas se muestran cuando sean amigos."}
              </p>

              {stats ? (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <div className="text-slate-500 text-sm">XP total</div>
                    <div className="text-2xl font-bold text-slate-900">{stats.xp_total}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <div className="text-slate-500 text-sm">Racha</div>
                    <div className="text-2xl font-bold text-slate-900">{stats.streak}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <div className="text-slate-500 text-sm">Lecciones</div>
                    <div className="text-2xl font-bold text-slate-900">{stats.lessons_completed}</div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-slate-600">
                  No disponible (aún no son amigos o la privacidad lo limita).
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
