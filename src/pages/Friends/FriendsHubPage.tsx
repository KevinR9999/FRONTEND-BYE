import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type TabKey = "search" | "requests" | "friends" | "chats";

type Person = {
  id: string;
  name: string;
  online?: boolean;
  subtitle?: string; // para snippets o texto secundario
  unread?: number;   // para badge en chats
  time?: string;     // "10:38 AM", "Ayer", etc.
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconChat(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M21 12c0 4.418-4.03 8-9 8-1.04 0-2.04-.157-2.965-.447L3 21l1.62-4.05C3.61 15.7 3 13.9 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

function IconUserX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M17 8l4 4M21 8l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconPencil(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

function PillTabs({
  value,
  onChange,
  requestsCount,
}: {
  value: TabKey;
  onChange: (t: TabKey) => void;
  requestsCount?: number;
}) {
  const tabs: { key: TabKey; label: string; showBadge?: boolean }[] = [
    { key: "search", label: "Buscar" },
    { key: "requests", label: "Solicitudes", showBadge: true },
    { key: "friends", label: "Mis amigos" },
    { key: "chats", label: "Chats" },
  ];

  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={[
              "relative flex-1 rounded-full px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-violet-600 text-white shadow-md"
                : "text-slate-600 hover:bg-white/60",
            ].join(" ")}
          >
            {t.label}
            {t.showBadge && (requestsCount ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-violet-700 text-[11px] text-white shadow">
                {requestsCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-3 shadow-sm">
      <IconSearch className="h-5 w-5 text-slate-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
      />
    </div>
  );
}

function AvatarSquare({ name }: { name: string }) {
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-semibold shadow-sm">
      {initials(name)}
    </div>
  );
}

function StatusLine({ online }: { online?: boolean }) {
  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
      <span
        className={[
          "h-2 w-2 rounded-full",
          online ? "bg-emerald-500" : "bg-slate-300",
        ].join(" ")}
      />
      <span>{online ? "En línea" : "Desconectado"}</span>
    </div>
  );
}

function SearchRow({ p, onAdd }: { p: Person; onAdd: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <AvatarSquare name={p.name} />
        <div>
          <div className="text-sm font-semibold text-slate-900">{p.name}</div>
          <StatusLine online={p.online} />
        </div>
      </div>

      <button
        onClick={() => onAdd(p.id)}
        className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white shadow-md active:scale-95"
        title="Enviar solicitud"
      >
        <IconPlus className="h-5 w-5" />
      </button>
    </div>
  );
}

function RequestCard({
  p,
  onAccept,
  onReject,
}: {
  p: Person;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <AvatarSquare name={p.name} />
        <div>
          <div className="text-sm font-semibold text-slate-900">{p.name}</div>
          <div className="text-xs text-slate-500">Quiere ser tu amigo</div>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => onAccept(p.id)}
          className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white shadow active:scale-[0.99]"
        >
          Aceptar
        </button>
        <button
          onClick={() => onReject(p.id)}
          className="flex-1 rounded-xl border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 active:scale-[0.99]"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

function FriendRow({
  p,
  onChat,
  onRemove,
}: {
  p: Person;
  onChat: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <AvatarSquare name={p.name} />
        <div>
          <div className="text-sm font-semibold text-slate-900">{p.name}</div>
          <StatusLine online={p.online} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onRemove(p.id)}
          className="grid h-10 w-10 place-items-center rounded-xl bg-slate-200 text-slate-700 active:scale-95"
          title="Eliminar amigo"
        >
          <IconUserX className="h-5 w-5" />
        </button>
        <button
          onClick={() => onChat(p.id)}
          className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white shadow-md active:scale-95"
          title="Chatear"
        >
          <IconChat className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function ChatRow({
  p,
  onOpen,
}: {
  p: Person;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onOpen(p.id)}
      className="w-full px-4 py-3 text-left hover:bg-slate-50/60 transition"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <AvatarSquare name={p.name} />
          <span
            className={[
              "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
              p.online ? "bg-emerald-500" : "bg-slate-300",
            ].join(" ")}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate text-sm font-semibold text-slate-900">
              {p.name}
            </div>
            <div className="shrink-0 text-xs text-slate-500">{p.time ?? ""}</div>
          </div>

          <div className="mt-1 flex items-center justify-between gap-3">
            <div className="truncate text-xs text-slate-500">{p.subtitle ?? ""}</div>

            {(p.unread ?? 0) > 0 && (
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                {p.unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function GradientHeader({
  title,
  subtitle,
  rightAction,
  topRightBadge,
}: {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  topRightBadge?: number;
}) {
  return (
    <div className="relative rounded-3xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 pb-6 pt-6 text-white shadow-lg">
      {(topRightBadge ?? 0) > 0 && (
        <div className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-white/20 text-sm font-bold shadow">
          {topRightBadge}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-3xl font-extrabold tracking-tight">{title}</div>
          {subtitle && (
            <div className="mt-1 text-xs leading-relaxed text-white/85">
              {subtitle}
            </div>
          )}
        </div>

        {rightAction ? (
          <div className="mt-1">{rightAction}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function FriendsHubPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("search");
  const [q, setQ] = useState("");

  // ✅ DEMO DATA (luego lo conectamos a tu Supabase)
  const searchPeople: Person[] = useMemo(
    () => [
      { id: "u1", name: "María Castillo", online: true },
      { id: "u2", name: "Juan Ramírez", online: false },
      { id: "u3", name: "Ana López", online: true },
      { id: "u4", name: "Pedro Martínez", online: true },
    ],
    []
  );

  const requests: Person[] = useMemo(
    () => [
      { id: "r1", name: "Laura García" },
      { id: "r2", name: "Carlos Fernández" },
      { id: "r3", name: "Sofía Rodríguez" },
    ],
    []
  );

  const friends: Person[] = useMemo(
    () => [
      { id: "f1", name: "Diego Álvarez", online: true },
      { id: "f2", name: "Valentina Torres", online: true },
      { id: "f3", name: "Miguel Sánchez", online: false },
      { id: "f4", name: "Carolina Navarro", online: true },
      { id: "f5", name: "Ricardo Morales", online: true },
    ],
    []
  );

  const chats: Person[] = useMemo(
    () => [
      { id: "c1", name: "Valentina Torres", online: true, subtitle: "Todavía no tengo planes definidos...", time: "10:38 AM", unread: 2 },
      { id: "c2", name: "Diego Álvarez", online: true, subtitle: "Perfecto, nos vemos entonces", time: "Ayer", unread: 0 },
      { id: "c3", name: "Carolina Navarro", online: true, subtitle: "Gracias por tu ayuda 🙏", time: "Ayer", unread: 0 },
      { id: "c4", name: "Miguel Sánchez", online: false, subtitle: "De acuerdo, hablamos luego", time: "Mar 28", unread: 0 },
      { id: "c5", name: "Ricardo Morales", online: true, subtitle: "¿Viste el partido de ayer?", time: "Mar 25", unread: 1 },
      { id: "c6", name: "Laura García", online: false, subtitle: "Genial. Hasta pronto", time: "Mar 20", unread: 0 },
    ],
    []
  );

  const filtered = (list: Person[]) => {
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((x) => x.name.toLowerCase().includes(qq));
  };

  const requestsCount = requests.length;

  const headerConfig = useMemo(() => {
    if (tab === "chats") {
      return {
        title: "Chats",
        subtitle: `${chats.length} conversaciones activas`,
        rightAction: (
          <button
            className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 text-white shadow active:scale-95"
            title="Nuevo chat"
            onClick={() => setTab("friends")}
          >
            <IconPencil className="h-5 w-5" />
          </button>
        ),
        topRightBadge: 0,
      };
    }
    return {
      title: "Amigos",
      subtitle: "Busca usuarios por nombre completo, envía solicitudes y chatea.",
      rightAction: null,
      topRightBadge: tab === "requests" ? requestsCount : 0,
    };
  }, [tab, chats.length, requestsCount]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 flex justify-center">
      <div className="w-full max-w-md">
        <GradientHeader
          title={headerConfig.title}
          subtitle={headerConfig.subtitle}
          rightAction={headerConfig.rightAction ?? undefined}
          topRightBadge={headerConfig.topRightBadge}
        />

        <PillTabs value={tab} onChange={(t) => { setTab(t); setQ(""); }} requestsCount={requestsCount} />

        {tab === "search" && (
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Busca por nombre completo..." />
            <div className="mt-4 space-y-3">
              {filtered(searchPeople).map((p) => (
                <SearchRow key={p.id} p={p} onAdd={(id) => console.log("send request to", id)} />
              ))}
            </div>
          </>
        )}

        {tab === "requests" && (
          <>
            <div className="mt-4 space-y-3">
              {requests.map((p) => (
                <RequestCard
                  key={p.id}
                  p={p}
                  onAccept={(id) => console.log("accept", id)}
                  onReject={(id) => console.log("reject", id)}
                />
              ))}
            </div>
          </>
        )}

        {tab === "friends" && (
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Buscar entre mis amigos..." />
            <div className="mt-4 space-y-3">
              {filtered(friends).map((p) => (
                <FriendRow
                  key={p.id}
                  p={p}
                  onRemove={(id) => console.log("remove friend", id)}
                  onChat={(id) => {
                    // ✅ aquí conectas tu "create_dm_conversation / getConversation" real
                    // por ahora navega a una ruta dummy:
                    navigate(`/chats/${id}`);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {tab === "chats" && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white/70 shadow-sm">
            {chats.map((p) => (
              <div key={p.id} className="border-b border-slate-200 last:border-b-0">
                <ChatRow
                  p={p}
                  onOpen={(id) => {
                    navigate(`/chats/${id}`);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
