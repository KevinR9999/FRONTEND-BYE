import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getMyFriendships,
  getMyUserId,
  searchUsers,
  sendFriendRequest
} from "../../services/friendsService";
import { otherUserIdFromFriendship, pairKey } from "../../services/socialHelpers";
import type { FriendshipRow, PublicProfile } from "../../types/social";

type Tab = "buscar" | "solicitudes" | "amigos" | "chats";

function IconUser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
function IconDots(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
function IconChat(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M20 14a4 4 0 0 1-4 4H9l-5 3V6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  const res = (a + b).toUpperCase();
  return res || "U";
}

function getOnlineInfo(p: any): { online: boolean; label: string } {
  // 1) Si existe is_online boolean
  if (typeof p?.is_online === "boolean") {
    return { online: p.is_online, label: p.is_online ? "En línea" : "Desconectado" };
  }

  // 2) Si existe last_seen timestamptz (consideramos online si fue hace <= 2 min)
  if (p?.last_seen) {
    const last = new Date(p.last_seen).getTime();
    const now = Date.now();
    const diff = now - last;
    const online = diff <= 2 * 60 * 1000;
    return { online, label: online ? "En línea" : "Desconectado" };
  }

  // 3) Fallback
  return { online: false, label: "Desconectado" };
}

function SuggestedRow({
  user,
  statusLabel,
  isOnline,
  right,
  onClick,
}: {
  user: PublicProfile;
  statusLabel: string;
  isOnline: boolean;
  right: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className="w-full cursor-pointer text-left rounded-3xl border border-violet-200 bg-white/70 shadow-sm px-4 py-3 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-bold shadow-sm">
              {initials((user as any)?.full_name)}
            </div>
            <span
              className={[
                "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
                isOnline ? "bg-emerald-500" : "bg-slate-300",
              ].join(" ")}
            />
          </div>

          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{(user as any)?.full_name || "Usuario"}</div>
            <div className="text-sm text-slate-500">{statusLabel}</div>
          </div>
        </div>

        {right}
      </div>
    </div>
  );
}

function RequestCard({
  name,
  isOnline,
  onAccept,
  onReject,
}: {
  name: string;
  isOnline: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-3xl border border-violet-200 bg-white/70 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-bold shadow-sm">
            {initials(name)}
          </div>
          <span
            className={[
              "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
              isOnline ? "bg-emerald-500" : "bg-slate-300",
            ].join(" ")}
          />
        </div>

        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{name || "Usuario"}</div>
          <div className="text-sm text-slate-500">Quiere ser tu amigo</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={onAccept}
          className="rounded-2xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-md active:scale-[0.99]"
        >
          Aceptar
        </button>

        <button
          onClick={onReject}
          className="rounded-2xl border border-violet-200 bg-white py-2.5 text-sm font-semibold text-violet-700 shadow-sm active:scale-[0.99]"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

function FriendRow({
  primaryName,
  secondaryName,
  onlineLabel,
  isOnline,
  onOpenProfile,
  onChat,
  onActions,
}: {
  primaryName: string;
  secondaryName?: string;
  onlineLabel: string;
  isOnline: boolean;
  onOpenProfile: () => void;
  onChat: () => void;
  onActions: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenProfile}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenProfile();
      }}
      className="w-full cursor-pointer text-left rounded-3xl border border-violet-200 bg-white/70 shadow-sm px-4 py-3 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-bold shadow-sm">
              {initials(primaryName)}
            </div>
            <span
              className={[
                "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
                isOnline ? "bg-emerald-500" : "bg-slate-300",
              ].join(" ")}
            />
          </div>

          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{primaryName}</div>
            <div className="text-sm text-slate-500 truncate">
              {onlineLabel}
              {secondaryName ? <span className="text-slate-400"> · {secondaryName}</span> : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChat();
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow active:scale-95"
            title="Chatear"
          >
            <IconChat className="h-5 w-5" />
            Chat
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onActions();
            }}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-violet-200 bg-white text-violet-700 shadow-sm active:scale-95"
            title="Opciones"
          >
            <IconDots className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

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

  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [suggested, setSuggested] = useState<PublicProfile[]>([]);

  // ✅ apodos (solo tú)
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [actionsFriendId, setActionsFriendId] = useState<string | null>(null);
  const [aliasModal, setAliasModal] = useState<{ friendId: string; name: string } | null>(null);
  const [aliasValue, setAliasValue] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<{ friendId: string; name: string } | null>(null);

  // ✅ NUEVO: contador de mensajes sin leer para badge en "Chats"
  const [unreadChats, setUnreadChats] = useState<number>(0);

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

  // ✅ NUEVO: calcula mensajes sin leer para el badge de "Chats"
  async function loadUnreadChatsCount(myId: string) {
    try {
      const { data: mem, error: memErr } = await supabase
        .from("conversation_members")
        .select("conversation_id, last_read_at")
        .eq("user_id", myId);

      if (memErr) throw memErr;

      const convoIds = (mem ?? []).map((m: any) => m.conversation_id) as string[];
      if (convoIds.length === 0) {
        setUnreadChats(0);
        return;
      }

      const lastReadMap = new Map<string, string | null>();
      for (const m of mem ?? []) {
        lastReadMap.set((m as any).conversation_id, (m as any).last_read_at ?? null);
      }

      const { data: msgs, error: msgErr } = await supabase
        .from("messages")
        .select("conversation_id, created_at, sender_id")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: false })
        .limit(1200);

      if (msgErr) throw msgErr;

      let total = 0;

      for (const m of msgs ?? []) {
        const senderId = (m as any).sender_id as string;
        if (senderId === myId) continue;

        const convoId = (m as any).conversation_id as string;
        const createdAt = (m as any).created_at as string;

        const lastRead = lastReadMap.get(convoId);
        const isUnread = !lastRead || new Date(createdAt).getTime() > new Date(lastRead).getTime();

        if (isUnread) total++;
      }

      setUnreadChats(total);
    } catch (e) {
      console.warn("No se pudo cargar contador de chats:", e);
      setUnreadChats(0);
    }
  }

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

        // ✅ NUEVO: cargar badge de chats (mensajes sin leer)
        await loadUnreadChatsCount(uid);
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

  // Sugeridos (solo en Buscar y query vacío)
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!me) return;
      if (tab !== "buscar") return;
      if (query.trim()) return;

      try {
        setSuggestedLoading(true);

        const { data, error: sugErr } = await supabase
          .from("profiles")
          .select("*")
          .neq("user_id", me)
          .limit(6);

        if (sugErr) throw sugErr;

        if (!mounted) return;
        setSuggested((data ?? []) as PublicProfile[]);
      } catch (e: any) {
        console.error(e);
        if (!mounted) return;
        setError(e?.message ?? "Error cargando sugeridos");
      } finally {
        if (mounted) setSuggestedLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [me, tab, query]);

  // Perfiles para solicitudes + amigos
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
        // Usamos * para que, si tienes is_online o last_seen, lo traiga sin errores
        const { data, error } = await supabase.from("profiles").select("*").in("user_id", ids);
        if (error) throw error;

        if (!mounted) return;
        const next: Record<string, PublicProfile> = {};
        for (const p of data ?? []) next[(p as any).user_id] = p as any;
        setProfilesMap(next);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [me, incoming, outgoing, acceptedFriendsIds]);

  // Cargar apodos (solo tú) para los amigos aceptados
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!me) return;
      if (acceptedFriendsIds.length === 0) {
        setAliases({});
        return;
      }

      try {
        const { data, error } = await supabase
          .from("friend_aliases")
          .select("friend_id, alias")
          .eq("owner_id", me)
          .in("friend_id", acceptedFriendsIds);

        if (error) throw error;

        if (!mounted) return;
        const m: Record<string, string> = {};
        for (const r of data ?? []) m[(r as any).friend_id] = (r as any).alias ?? "";
        setAliases(m);
      } catch (e) {
        // Si aún no creaste la tabla, no rompemos la UI
        console.warn("No se pudieron cargar apodos (friend_aliases).", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [me, acceptedFriendsIds]);

  // Debounce búsqueda
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
    return acceptedFriendsIds.map((id) => profilesMap[id]).filter(Boolean) as PublicProfile[];
  }, [acceptedFriendsIds, profilesMap]);

  const incomingCount = incoming.length;

  async function upsertAlias(friendId: string, aliasText: string) {
    if (!me) return;
    const text = aliasText.trim();

    try {
      setError(null);

      if (!text) {
        const { error } = await supabase
          .from("friend_aliases")
          .delete()
          .eq("owner_id", me)
          .eq("friend_id", friendId);

        if (error) throw error;

        setAliases((prev) => {
          const next = { ...prev };
          delete next[friendId];
          return next;
        });

        return;
      }

      const { error } = await supabase.from("friend_aliases").upsert(
        { owner_id: me, friend_id: friendId, alias: text },
        { onConflict: "owner_id,friend_id" }
      );

      if (error) throw error;

      setAliases((prev) => ({ ...prev, [friendId]: text }));
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "No se pudo guardar el apodo");
    }
  }

  async function removeFriend(friendId: string) {
  if (!me) return;

  try {
    setError(null);

    // ✅ Encuentra la fila exacta en tu estado (tiene el id real)
    const f = statusForUser(friendId);
    if (!f) throw new Error("No se encontró la amistad para eliminar.");

    const { error } = await supabase.from("friendships").delete().eq("id", f.id);
    if (error) throw error;

    // ✅ opcional: borra apodo si existe (no afecta si no hay tabla)
    await supabase.from("friend_aliases").delete().eq("owner_id", me).eq("friend_id", friendId);

    await refreshFriendships();
  } catch (e: any) {
    console.error("❌ removeFriend error:", e);
    setError(e?.message ?? "No se pudo eliminar el amigo");
  }
}


  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 flex justify-center">
      {/* Contorno móvil */}
      <div className="w-full max-w-[420px] rounded-[40px] border-4 border-violet-200 bg-white shadow-2xl overflow-hidden">
        <div className="px-6 py-7 bg-white">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-violet-600 tracking-tight">Amigos</h1>
              <p className="text-slate-500 mt-2 max-w-xl">
                Busca usuarios por nombre completo, envía solicitudes y chatea.
              </p>
            </div>

            <button
              onClick={() => navigate("/profile")}
              className="mt-1 inline-flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm active:scale-[0.99]"
              title="Volver al perfil"
            >
              <IconUser className="h-5 w-5" />
              Perfil
            </button>
          </div>

          {/* Tabs */}
<div className="mt-6 grid grid-cols-4 gap-2">
  {(["buscar", "solicitudes", "amigos", "chats"] as Tab[]).map((t) => {
    const isActive = tab === t;
    const label =
      t === "buscar"
        ? "Buscar"
        : t === "solicitudes"
        ? "Solicitudes"
        : t === "amigos"
        ? "Mis amigos"
        : "Chats";

    return (
      <button
        key={t}
        onClick={() => {
          if (t === "chats") {
            navigate("/friends/chats");
            return;
          }
          setTab(t);
        }}
        className={
          isActive
            ? "relative w-full rounded-2xl bg-violet-600 py-2 text-[12px] font-semibold text-white shadow-md"
            : "relative w-full rounded-2xl py-2 text-[12px] font-semibold text-slate-500"
        }
      >
        <span className="block leading-tight">{label}</span>

        {t === "solicitudes" && incomingCount > 0 && (
          <span className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full bg-violet-700 text-xs font-bold text-white">
            {incomingCount}
          </span>
        )}
      </button>
    );
  })}
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
              {/* BUSCAR */}
              {tab === "buscar" && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-white/80 px-4 py-3 shadow-sm">
                    <IconSearch className="h-5 w-5 text-violet-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Busca por nombre completo…"
                      className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="mt-5 space-y-3">
                    {query.trim() ? (
                      <>
                        {searching && <div className="text-slate-600">Buscando…</div>}
                        {!searching && results.length === 0 && (
                          <div className="text-slate-600">No se encontraron usuarios.</div>
                        )}

                        {results.map((u) => {
                          const f = statusForUser(u.user_id);
                          const onlineInfo = getOnlineInfo(u as any);

                          let right: React.ReactNode = null;
                          if (!f) {
                            right = (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdd(u.user_id);
                                }}
                                className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-white shadow active:scale-95"
                                title="Enviar solicitud"
                              >
                                <IconPlus className="h-5 w-5" />
                              </button>
                            );
                          } else if (f.status === "pending") {
                            right = (
                              <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                                Pendiente
                              </span>
                            );
                          } else if (f.status === "accepted") {
                            right = (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/friends/${u.user_id}`);
                                }}
                                className="rounded-2xl bg-slate-900 px-4 py-2 text-white font-semibold shadow active:scale-95"
                              >
                                Ver
                              </button>
                            );
                          } else {
                            right = <span className="text-sm font-semibold text-slate-500">{f.status}</span>;
                          }

                          return (
                            <SuggestedRow
                              key={u.user_id}
                              user={u}
                              statusLabel={onlineInfo.label}
                              isOnline={onlineInfo.online}
                              right={right}
                              onClick={() => navigate(`/friends/${u.user_id}`)}
                            />
                          );
                        })}
                      </>
                    ) : (
                      <>
                        {suggestedLoading && <div className="text-slate-600">Cargando sugeridos…</div>}

                        {!suggestedLoading && suggested.length === 0 && (
                          <div className="text-slate-600">
                            No hay sugerencias por ahora. Usa el buscador para encontrar usuarios.
                          </div>
                        )}

                        {suggested.map((u) => {
                          const f = statusForUser(u.user_id);
                          const onlineInfo = getOnlineInfo(u as any);

                          let right: React.ReactNode = null;
                          if (!f) {
                            right = (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdd(u.user_id);
                                }}
                                className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-white shadow active:scale-95"
                                title="Enviar solicitud"
                              >
                                <IconPlus className="h-5 w-5" />
                              </button>
                            );
                          } else if (f.status === "pending") {
                            right = (
                              <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                                Pendiente
                              </span>
                            );
                          } else if (f.status === "accepted") {
                            right = (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/friends/${u.user_id}`);
                                }}
                                className="rounded-2xl bg-slate-900 px-4 py-2 text-white font-semibold shadow active:scale-95"
                              >
                                Ver
                              </button>
                            );
                          }

                          return (
                            <SuggestedRow
                              key={u.user_id}
                              user={u}
                              statusLabel={onlineInfo.label}
                              isOnline={onlineInfo.online}
                              right={right}
                              onClick={() => navigate(`/friends/${u.user_id}`)}
                            />
                          );
                        })}

                        {!suggestedLoading && suggested.length > 0 && (
                          <div className="pt-2 text-xs text-slate-500">
                            ¿No ves a alguien? Búscalo por nombre en el buscador.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* SOLICITUDES (mockup) */}
              {tab === "solicitudes" && (
                <div className="mt-6 space-y-4">
                  {incoming.length === 0 ? (
                    <div className="rounded-3xl border border-violet-200 bg-white/70 shadow-sm p-4 text-slate-600">
                      No tienes solicitudes por ahora.
                    </div>
                  ) : (
                    incoming.map((f) => {
                      const otherId = otherUserIdFromFriendship(me, f);
                      const p = profilesMap[otherId] as any;
                      const name = p?.full_name || "Usuario";
                      const onlineInfo = getOnlineInfo(p);

                      return (
                        <RequestCard
                          key={f.id}
                          name={name}
                          isOnline={onlineInfo.online}
                          onAccept={() => handleAccept(f.id)}
                          onReject={() => handleDecline(f.id)}
                        />
                      );
                    })
                  )}
                </div>
              )}

              {/* MIS AMIGOS (mockup + apodo + eliminar + online) */}
              {tab === "amigos" && (
                <div className="mt-6">
                  {friendsProfiles.length === 0 ? (
                    <div className="rounded-3xl border border-violet-200 bg-white/70 shadow-sm p-4 text-slate-600">
                      Aún no tienes amigos agregados.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {friendsProfiles.map((u) => {
                        const p = u as any;
                        const onlineInfo = getOnlineInfo(p);

                        const alias = aliases[u.user_id];
                        const primaryName = (alias?.trim() ? alias.trim() : p?.full_name) || "Usuario";
                        const secondaryName = alias?.trim() ? (p?.full_name || "") : undefined;

                        return (
                          <FriendRow
                            key={u.user_id}
                            primaryName={primaryName}
                            secondaryName={secondaryName}
                            onlineLabel={onlineInfo.label}
                            isOnline={onlineInfo.online}
                            onOpenProfile={() => navigate(`/friends/${u.user_id}`)}
                            onChat={() => navigate(`/friends/chat/${u.user_id}`)}
                            onActions={() => {
                              setActionsFriendId(u.user_id);
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ACTION SHEET: opciones amigo */}
      {actionsFriendId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4"
          onClick={() => setActionsFriendId(null)}
        >
          <div
            className="w-full max-w-[420px] rounded-3xl bg-white p-4 shadow-xl mb-4"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const p = (profilesMap[actionsFriendId] as any) || {};
              const alias = aliases[actionsFriendId];
              const displayName = (alias?.trim() ? alias.trim() : p?.full_name) || "Usuario";
              const onlineInfo = getOnlineInfo(p);

              return (
                <>
                  <div className="text-sm font-semibold text-slate-900 truncate">{displayName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{onlineInfo.label}</div>

                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => {
                        const name = displayName;
                        setAliasModal({ friendId: actionsFriendId, name });
                        setAliasValue(aliases[actionsFriendId] ?? "");
                        setActionsFriendId(null);
                      }}
                      className="w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-left font-semibold text-violet-700 shadow-sm active:scale-[0.99]"
                    >
                      Cambiar apodo
                    </button>

                    <button
                      onClick={() => {
                        const name = displayName;
                        setConfirmRemove({ friendId: actionsFriendId, name });
                        setActionsFriendId(null);
                      }}
                      className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left font-semibold text-red-700 shadow-sm active:scale-[0.99]"
                    >
                      Eliminar amigo
                    </button>

                    <button
                      onClick={() => setActionsFriendId(null)}
                      className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 active:scale-[0.99]"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: apodo */}
      {aliasModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setAliasModal(null)}
        >
          <div
            className="w-full max-w-[420px] rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-extrabold text-slate-900">Apodo</div>
            <div className="mt-1 text-sm text-slate-500">Solo tú lo verás.</div>

            <div className="mt-4">
              <input
                value={aliasValue}
                onChange={(e) => setAliasValue(e.target.value)}
                placeholder="Escribe un apodo…"
                className="w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
              />

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAliasModal(null)}
                  className="rounded-2xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 active:scale-[0.99]"
                >
                  Cancelar
                </button>

                <button
                  onClick={async () => {
                    await upsertAlias(aliasModal.friendId, aliasValue);
                    setAliasModal(null);
                  }}
                  className="rounded-2xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-md active:scale-[0.99]"
                >
                  Guardar
                </button>
              </div>

              <div className="mt-2 text-xs text-slate-500">
                Deja vacío y guarda para quitar el apodo.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: confirmar eliminar */}
      {confirmRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setConfirmRemove(null)}
        >
          <div
            className="w-full max-w-[420px] rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-extrabold text-slate-900">Eliminar amigo</div>
            <div className="mt-1 text-sm text-slate-500">
              ¿Seguro que quieres eliminar a <span className="font-semibold text-slate-900">{confirmRemove.name}</span>?
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="rounded-2xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 active:scale-[0.99]"
              >
                Cancelar
              </button>

              <button
                onClick={async () => {
                  const id = confirmRemove.friendId;
                  setConfirmRemove(null);
                  await removeFriend(id);
                }}
                className="rounded-2xl bg-red-600 py-2.5 text-sm font-semibold text-white shadow-md active:scale-[0.99]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
