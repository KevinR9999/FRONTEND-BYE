import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserCard from "../../components/friends/UserCard";
import {
    acceptFriendRequest,
    declineFriendRequest,
    getMyFriendships,
    getMyUserId,
    getProfilesByIds,
    searchUsers,
    sendFriendRequest,
} from "../../services/friendsService";
import { otherUserIdFromFriendship, pairKey } from "../../services/socialHelpers";
import type { FriendshipRow, PublicProfile } from "../../types/social";

type Tab = "buscar" | "solicitudes" | "amigos";

export default function FriendsPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("buscar");

  const [me, setMe] = useState<string>("");
  const [friendships, setFriendships] = useState<FriendshipRow[]>([]);
  const [loadingF, setLoadingF] = useState(true);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [profilesMap, setProfilesMap] = useState<Record<string, PublicProfile>>({});

  const mapByPair = useMemo(() => {
    const m = new Map<string, FriendshipRow>();
    for (const f of friendships) m.set(`${f.user1}:${f.user2}`, f);
    return m;
  }, [friendships]);

  const incoming = useMemo(() => {
    if (!me) return [];
    return friendships.filter(
      (f) => f.status === "pending" && f.requested_by !== me && (f.user1 === me || f.user2 === me)
    );
  }, [friendships, me]);

  const outgoing = useMemo(() => {
    if (!me) return [];
    return friendships.filter(
      (f) => f.status === "pending" && f.requested_by === me && (f.user1 === me || f.user2 === me)
    );
  }, [friendships, me]);

  const acceptedFriendsIds = useMemo(() => {
    if (!me) return [];
    return friendships
      .filter((f) => f.status === "accepted" && (f.user1 === me || f.user2 === me))
      .map((f) => otherUserIdFromFriendship(me, f));
  }, [friendships, me]);

  // Carga inicial
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setError(null);
        setLoadingF(true);

        const uid = await getMyUserId();
        if (!mounted) return;
        setMe(uid);

        const f = await getMyFriendships();
        if (!mounted) return;
        setFriendships(f);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Error cargando datos");
      } finally {
        if (mounted) setLoadingF(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Cargar perfiles para solicitudes + amigos (para mostrar nombres en vez de UUID)
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!me) return;

      const ids = Array.from(
        new Set([
          ...incoming.map((f) => otherUserIdFromFriendship(me, f)),
          ...outgoing.map((f) => otherUserIdFromFriendship(me, f)),
          ...acceptedFriendsIds,
        ])
      );

      try {
        const profs = await getProfilesByIds(ids);
        if (!mounted) return;

        const next: Record<string, PublicProfile> = {};
        for (const p of profs) next[p.user_id] = p;
        setProfilesMap(next);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [me, incoming, outgoing, acceptedFriendsIds]);

  // Debounce búsqueda por full_name
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = query.trim();
      if (!q) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const data = await searchUsers(q, 25);
        setResults(data);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Error buscando usuarios");
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [query]);

  async function refreshFriendships() {
    const f = await getMyFriendships();
    setFriendships(f);
  }

  async function handleAdd(userId: string) {
    try {
      setError(null);
      await sendFriendRequest(userId);
      await refreshFriendships();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "No se pudo enviar la solicitud");
    }
  }

  async function handleAccept(friendshipId: string) {
    try {
      setError(null);
      await acceptFriendRequest(friendshipId);
      await refreshFriendships();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "No se pudo aceptar");
    }
  }

  async function handleDecline(friendshipId: string) {
    try {
      setError(null);
      await declineFriendRequest(friendshipId);
      await refreshFriendships();
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "No se pudo rechazar");
    }
  }

  function statusForUser(userId: string) {
    if (!me) return null;
    const k = pairKey(me, userId);
    const f = mapByPair.get(k);
    return f ?? null;
  }

  const friendsProfiles = useMemo(() => {
    return acceptedFriendsIds
      .map((id) => profilesMap[id])
      .filter(Boolean) as PublicProfile[];
  }, [acceptedFriendsIds, profilesMap]);

  const renderRow = (userId: string) => {
    const p = profilesMap[userId];
    return p ? (
      <UserCard
        user={p}
        right={
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/friends/${userId}`);
            }}
            className="rounded-xl bg-slate-900 px-3 py-2 text-white font-semibold"
          >
            Ver
          </button>
        }
        onClick={() => navigate(`/friends/${userId}`)}
      />
    ) : (
      <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="text-slate-800">
          <div className="font-semibold">Usuario</div>
          <div className="text-sm text-slate-500">{userId}</div>
        </div>
        <button
          onClick={() => navigate(`/friends/${userId}`)}
          className="rounded-xl bg-slate-900 px-3 py-2 text-white font-semibold"
        >
          Ver
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900">Amigos</h1>
        <p className="text-slate-600 mt-1">
          Busca usuarios por nombre completo, envía solicitudes y chatea.
        </p>

        <div className="mt-4 flex gap-2">
          {(["buscar", "solicitudes", "amigos"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl px-4 py-2 font-semibold border ${
                tab === t
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              {t === "buscar" ? "Buscar" : t === "solicitudes" ? "Solicitudes" : "Mis amigos"}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {loadingF ? (
          <div className="mt-6 text-slate-600">Cargando…</div>
        ) : (
          <>
            {tab === "buscar" && (
              <div className="mt-6">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Busca por nombre completo…"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
                />

                <div className="mt-4 space-y-3">
                  {searching && <div className="text-slate-600">Buscando…</div>}

                  {!searching && results.length === 0 && query.trim() && (
                    <div className="text-slate-600">No se encontraron usuarios.</div>
                  )}

                  {results.map((u) => {
                    const f = statusForUser(u.user_id);

                    let right: React.ReactNode = null;
                    if (!f) {
                      right = (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdd(u.user_id);
                          }}
                          className="rounded-xl bg-violet-600 px-3 py-2 text-white font-semibold"
                        >
                          Agregar
                        </button>
                      );
                    } else if (f.status === "pending") {
                      right = <span className="text-sm font-semibold text-slate-500">Pendiente</span>;
                    } else if (f.status === "accepted") {
                      right = (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/friends/${u.user_id}`);
                          }}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-white font-semibold"
                        >
                          Ver
                        </button>
                      );
                    } else {
                      right = <span className="text-sm font-semibold text-slate-500">{f.status}</span>;
                    }

                    return (
                      <UserCard
                        key={u.user_id}
                        user={u}
                        right={right}
                        onClick={() => navigate(`/friends/${u.user_id}`)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "solicitudes" && (
              <div className="mt-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Entrantes</h2>
                  <p className="text-slate-600 text-sm">Solicitudes que te enviaron</p>

                  <div className="mt-3 space-y-3">
                    {incoming.length === 0 ? (
                      <div className="text-slate-600">No tienes solicitudes entrantes.</div>
                    ) : (
                      incoming.map((f) => {
                        const otherId = otherUserIdFromFriendship(me, f);
                        return (
                          <div key={f.id} className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                            <div className="mb-3">{renderRow(otherId)}</div>

                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleDecline(f.id)}
                                className="rounded-xl bg-slate-100 px-3 py-2 text-slate-800 font-semibold"
                              >
                                Rechazar
                              </button>
                              <button
                                onClick={() => handleAccept(f.id)}
                                className="rounded-xl bg-violet-600 px-3 py-2 text-white font-semibold"
                              >
                                Aceptar
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-900">Salientes</h2>
                  <p className="text-slate-600 text-sm">Solicitudes que tú enviaste</p>

                  <div className="mt-3 space-y-3">
                    {outgoing.length === 0 ? (
                      <div className="text-slate-600">No tienes solicitudes salientes.</div>
                    ) : (
                      outgoing.map((f) => {
                        const otherId = otherUserIdFromFriendship(me, f);
                        return (
                          <div key={f.id} className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                            <div className="mb-2">{renderRow(otherId)}</div>
                            <div className="text-sm text-slate-500">Estado: Pendiente</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "amigos" && (
              <div className="mt-6">
                {friendsProfiles.length === 0 ? (
                  <div className="text-slate-600">Aún no tienes amigos agregados.</div>
                ) : (
                  <div className="space-y-3">
                    {friendsProfiles.map((u) => (
                      <UserCard
                        key={u.user_id}
                        user={u}
                        right={
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/friends/chat/${u.user_id}`);
                            }}
                            className="rounded-xl bg-violet-600 px-3 py-2 text-white font-semibold"
                          >
                            Chatear
                          </button>
                        }
                        onClick={() => navigate(`/friends/${u.user_id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
