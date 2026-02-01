import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getMyUserId, getProfilesByIds } from "../../services/friendsService";
import type { PublicProfile } from "../../types/social";

/**
 * 🔧 Ajusta solo si tus tablas tienen otros nombres
 */
const CONVERSATIONS_TABLE = "conversations";
const MEMBERS_TABLE = "conversation_members";
const MESSAGES_TABLE = "messages";

// ✅ SOLO PARA PREVIEW DE AUDIO (no mostrar URL)
const AUDIO_PREFIX = "__audio__:";
const AUDIO_PREFIX_ALT = "_audio_:";

type DbConversation = {
  id: string;
  dm_key?: string | null;
  created_at?: string | null;
};

type DbMember = {
  conversation_id: string;
  user_id: string;
  last_read_at?: string | null; // ✅ necesario para unread
};

type DbMessage = {
  conversation_id: string;
  body: string | null;
  created_at: string;
  sender_id: string;
};

type AliasRow = { friend_id: string; alias: string | null };

type ChatItem = {
  conversationId: string;
  friendId: string;
  fullName: string; // alias || full_name
  online: boolean;
  lastMessage: string;
  timeLabel: string;
  unread: number;
};

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  const res = (a + b).toUpperCase();
  return res || "U";
}

function formatTimeLabel(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor(diffMs / dayMs);

  if (diffDays <= 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ✅ SOLO: preview bonito para audios (evita mostrar URL)
function formatLastMessagePreview(body: string | null | undefined) {
  const b = (body ?? "").toString().trim();
  if (!b) return "Sin mensajes aún";

  if (b.startsWith(AUDIO_PREFIX) || b.startsWith(AUDIO_PREFIX_ALT)) {
    return "🎤 Audio";
  }

  return b;
}

// Fallback por si quieres deducir el otro usuario desde dm_key (formato "a:b")
function otherFromDmKey(dm_key: string | null | undefined, me: string) {
  if (!dm_key) return null;
  const parts = dm_key.split(":");
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (a === me) return b;
  if (b === me) return a;
  return null;
}

function IconPencil(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Avatar({ name, online }: { name: string; online: boolean }) {
  return (
    <div className="relative">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-semibold shadow-sm">
        {initials(name)}
      </div>
      <span
        className={[
          "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
          online ? "bg-emerald-500" : "bg-slate-300",
        ].join(" ")}
      />
    </div>
  );
}

function ChatRow({ item, onOpen }: { item: ChatItem; onOpen: (row: ChatItem) => void }) {
  return (
    <button
      onClick={() => onOpen(item)}
      className="w-full px-4 py-3 text-left transition hover:bg-slate-50/60"
    >
      <div className="flex items-center gap-3">
        <Avatar name={item.fullName} online={item.online} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-sm font-semibold text-slate-900">{item.fullName}</div>
            <div className="shrink-0 text-xs text-slate-500">{item.timeLabel}</div>
          </div>

          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="truncate text-xs text-slate-500">{item.lastMessage}</div>

            {item.unread > 0 && (
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                {item.unread > 99 ? "99+" : item.unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ChatsPage() {
  const navigate = useNavigate();

  const [me, setMe] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);

        const myId = await getMyUserId();
        if (!mounted) return;
        setMe(myId);

        // 1) Mis membresías (con last_read_at)
        const { data: myMemberships, error: memErr } = await supabase
          .from(MEMBERS_TABLE)
          .select("conversation_id, user_id, last_read_at")
          .eq("user_id", myId);

        if (memErr) throw memErr;

        const convoIds = (myMemberships ?? []).map((m: any) => m.conversation_id) as string[];
        const lastReadMap = new Map<string, string | null>();
        for (const m of (myMemberships ?? []) as DbMember[]) {
          lastReadMap.set(m.conversation_id, m.last_read_at ?? null);
        }

        if (convoIds.length === 0) {
          if (!mounted) return;
          setItems([]);
          setUnreadTotal(0);
          return;
        }

        // 2) Conversaciones
        const { data: convosRaw, error: convErr } = await supabase
          .from(CONVERSATIONS_TABLE)
          .select("id, dm_key, created_at")
          .in("id", convoIds);

        if (convErr) throw convErr;

        const convos = (convosRaw ?? []) as DbConversation[];
        if (convos.length === 0) {
          if (!mounted) return;
          setItems([]);
          setUnreadTotal(0);
          return;
        }

        const convoIdList = convos.map((c) => c.id);

        // 3) Miembros (para sacar el otro user)
        const { data: membersRaw, error: membersErr } = await supabase
          .from(MEMBERS_TABLE)
          .select("conversation_id, user_id")
          .in("conversation_id", convoIdList);

        if (membersErr) throw membersErr;

        const members = (membersRaw ?? []) as { conversation_id: string; user_id: string }[];

        // 4) Mensajes (para preview + unread)
        const { data: msgsRaw, error: msgErr } = await supabase
          .from(MESSAGES_TABLE)
          .select("conversation_id, body, created_at, sender_id")
          .in("conversation_id", convoIdList)
          .order("created_at", { ascending: false })
          .limit(800);

        if (msgErr) throw msgErr;

        const msgs = (msgsRaw ?? []) as DbMessage[];

        const lastByConvo = new Map<string, DbMessage>();
        const unreadByConvo = new Map<string, number>();

        for (const m of msgs) {
          if (!lastByConvo.has(m.conversation_id)) lastByConvo.set(m.conversation_id, m);

          // ✅ unread: mensajes del otro y posteriores a last_read_at
          if (m.sender_id === myId) continue;
          const lastRead = lastReadMap.get(m.conversation_id);
          const isUnread =
            !lastRead || new Date(m.created_at).getTime() > new Date(lastRead).getTime();

          if (!isUnread) continue;
          unreadByConvo.set(m.conversation_id, (unreadByConvo.get(m.conversation_id) ?? 0) + 1);
        }

        // 5) Map conversación -> friendId
        const convoToFriend = new Map<string, string>();
        const friendIds = new Set<string>();

        for (const c of convos) {
          const mems = members.filter((mm) => mm.conversation_id === c.id);
          const other = mems.find((mm) => mm.user_id !== myId)?.user_id;
          const otherKey = otherFromDmKey(c.dm_key, myId);
          const fid = other ?? otherKey;

          if (fid) {
            convoToFriend.set(c.id, fid);
            friendIds.add(fid);
          }
        }

        const friendIdList = Array.from(friendIds);
        if (friendIdList.length === 0) {
          if (!mounted) return;
          setItems([]);
          setUnreadTotal(0);
          return;
        }

        // 6) Perfiles
        const profiles = await getProfilesByIds(friendIdList);
        const pMap: Record<string, PublicProfile> = {};
        for (const p of profiles) pMap[p.user_id] = p;

        // 7) Aliases (apodos) -> mapa local (NO dispara recargas)
        let aliasMapLocal: Record<string, string> = {};
        try {
          const { data: aRaw, error: aErr } = await supabase
            .from("friend_aliases")
            .select("friend_id, alias")
            .eq("owner_id", myId)
            .in("friend_id", friendIdList);

          if (aErr) throw aErr;

          const m: Record<string, string> = {};
          for (const r of (aRaw ?? []) as AliasRow[]) {
            const val = (r.alias ?? "").trim();
            if (val) m[r.friend_id] = val;
          }
          aliasMapLocal = m;
        } catch (e) {
          aliasMapLocal = {};
        }

        // 8) Construir lista
        const built: (ChatItem & { _activityTs: number })[] = convos
          .map((c) => {
            const fid = convoToFriend.get(c.id);
            if (!fid) return null;

            const p = pMap[fid] as any;
            const fullNameBase = p?.full_name || "Usuario";
            const alias = (aliasMapLocal[fid] ?? "").trim();
            const displayName = alias || fullNameBase;

            const online = Boolean(p?.is_online);
            const last = lastByConvo.get(c.id);

            const activityIso = last?.created_at ?? c.created_at ?? null;
            const activityTs = activityIso ? new Date(activityIso).getTime() : 0;

            return {
              conversationId: c.id,
              friendId: fid,
              fullName: displayName,
              online,
              // ✅ AQUÍ: en vez de mostrar URL del audio, muestra "🎤 Audio"
              lastMessage: formatLastMessagePreview(last?.body),
              timeLabel: formatTimeLabel(activityIso),
              unread: unreadByConvo.get(c.id) ?? 0,
              _activityTs: activityTs,
            };
          })
          .filter(Boolean) as any;

        built.sort((a, b) => b._activityTs - a._activityTs);

        const total = built.reduce((acc, it) => acc + (it.unread || 0), 0);

        if (!mounted) return;
        setItems(built.map(({ _activityTs, ...rest }) => rest));
        setUnreadTotal(total);
      } catch (e: any) {
        console.error(e);
        if (!mounted) return;
        setError(e?.message ?? "Error cargando chats");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function markConversationRead(conversationId: string) {
    if (!me) return;
    try {
      await supabase
        .from(MEMBERS_TABLE)
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", me);
    } catch (e) {
      // no bloquea navegación
    }
  }

  const activeCount = useMemo(() => items.length, [items]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 flex justify-center">
      <div className="w-full max-w-md">
        {/* Header gradiente mockup */}
        <div className="relative rounded-3xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 pb-6 pt-6 text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-3xl font-extrabold tracking-tight">Chats</div>
              <div className="mt-1 text-xs leading-relaxed text-white/85">
                {activeCount} conversaciones · {unreadTotal} sin leer
              </div>
            </div>

            <button
              className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 text-white shadow active:scale-95"
              title="Nuevo chat"
              onClick={() => navigate("/friends")}
            >
              <IconPencil className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-6 text-slate-600">Cargando chats…</div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4 text-slate-700 shadow-sm">
            No tienes conversaciones aún. Abre un chat desde “Mis amigos”.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm">
            {items.map((it) => (
              <div key={it.conversationId} className="border-b border-slate-200 last:border-b-0">
                <ChatRow
                  item={it}
                  onOpen={async (row) => {
                    await markConversationRead(row.conversationId);

                    // optimista: quitar burbuja local
                    setItems((prev) =>
                      prev.map((x) =>
                        x.conversationId === row.conversationId ? { ...x, unread: 0 } : x
                      )
                    );
                    setUnreadTotal((prev) => Math.max(0, prev - row.unread));

                    navigate(`/friends/chat/${row.friendId}`);
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate("/friends")}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white/70 py-3 text-sm font-semibold text-slate-700 shadow-sm"
        >
          Volver a Amigos
        </button>
      </div>
    </div>
  );
}

