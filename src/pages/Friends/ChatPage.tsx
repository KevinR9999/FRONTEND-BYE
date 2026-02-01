import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ChatWindow from "../../components/chat/ChatWindow";
import { getOrCreateDmConversation } from "../../services/chatService";
import { getProfile } from "../../services/friendsService";
import type { PublicProfile } from "../../types/social";

export default function ChatPage() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [conversationId, setConversationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setError(null);
        setLoading(true);

        if (!friendId) throw new Error("Friend inválido");

        const p = await getProfile(friendId);
        if (!mounted) return;
        setProfile(p);

        const convo = await getOrCreateDmConversation(friendId);
        if (!mounted) return;
        setConversationId(convo.id);
      } catch (e: any) {
        console.error(e);
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
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <button onClick={() => navigate(-1)} className="text-slate-700 font-semibold">
          ← Volver
        </button>

        <div className="mt-4 rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="font-bold text-slate-900">
            Chat con {profile?.full_name || "Usuario"}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="text-slate-600">Cargando chat…</div>
          ) : conversationId ? (
            <ChatWindow conversationId={conversationId} />
          ) : (
            <div className="text-slate-600">No se pudo abrir la conversación.</div>
          )}
        </div>
      </div>
    </div>
  );
}
