import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatWindow from "../../components/chat/ChatWindow";
import { supabase } from "../../lib/supabaseClient";
import { getOrCreateDmConversation } from "../../services/chatService";
import { getMyUserId, getProfile } from "../../services/friendsService";
import type { PublicProfile } from "../../types/social";

function IconBack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconMore(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
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
  if (typeof p?.is_online === "boolean") {
    return { online: p.is_online, label: p.is_online ? "En línea" : "Desconectado" };
  }
  if (p?.last_seen) {
    const last = new Date(p.last_seen).getTime();
    const now = Date.now();
    const online = now - last <= 2 * 60 * 1000;
    return { online, label: online ? "En línea" : "Desconectado" };
  }
  return { online: false, label: "Desconectado" };
}

export default function ChatPage() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [displayName, setDisplayName] = useState<string>("Usuario");
  const [onlineLabel, setOnlineLabel] = useState<string>("Desconectado");

  const [conversationId, setConversationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const avatarText = useMemo(() => initials(displayName), [displayName]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);

        if (!friendId) throw new Error("Friend inválido");

        // Perfil del amigo
        const p = await getProfile(friendId);
        if (!mounted) return;
        setProfile(p);

        const onlineInfo = getOnlineInfo(p as any);
        setOnlineLabel(onlineInfo.label);

        // Apodo (solo tú)
        const me = await getMyUserId();
        const { data: aliasRow, error: aliasErr } = await supabase
          .from("friend_aliases")
          .select("alias")
          .eq("owner_id", me)
          .eq("friend_id", friendId)
          .maybeSingle();

        if (aliasErr) {
          console.warn("No se pudo leer apodo (friend_aliases):", aliasErr);
        }

        const alias = (aliasRow as any)?.alias?.toString().trim();
        const name = alias || (p as any)?.full_name || "Usuario";
        setDisplayName(name);

        // Conversación (crea o retorna)
        const convo = await getOrCreateDmConversation(friendId);
        if (!mounted) return;
        setConversationId(convo.id);
      } catch (e: any) {
        console.error(e);
        if (!mounted) return;
        setError(e?.message ?? "Error abriendo chat");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [friendId]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 flex justify-center">
      {/* Contorno móvil (sin notch) */}
      <div className="w-full max-w-[420px] h-[780px] max-h-[calc(100vh-48px)] rounded-[40px] border-4 border-violet-200 bg-white shadow-2xl overflow-hidden flex flex-col">
        {/* Header gradiente */}
        <div className="relative px-4 pt-4">
          <div className="relative rounded-3xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-4 text-white shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => navigate(-1)}
                className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 text-white shadow active:scale-95"
                title="Volver"
              >
                <IconBack className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 font-extrabold shadow">
                  {avatarText}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{displayName}</div>
                  <div className="text-[11px] text-white/85">{onlineLabel}</div>
                </div>
              </div>

              <button
                onClick={() => {}}
                className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 text-white shadow active:scale-95"
                title="Opciones"
              >
                <IconMore className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 mt-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          </div>
        )}

        {/* Chat (CLAVE: flex-1 + min-h-0 para que no se corte) */}
        <div className="flex-1 min-h-0 px-4 pt-6 pb-4">
          <div className="h-full min-h-0 rounded-3xl border border-violet-200 bg-white/70 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-4 text-slate-600">Cargando chat…</div>
            ) : conversationId ? (
              <ChatWindow conversationId={conversationId} peerName={displayName} />
            ) : (
              <div className="p-4 text-slate-600">No se pudo abrir la conversación.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
