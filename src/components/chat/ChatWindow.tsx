import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { loadMessages, sendMessage } from "../../services/chatService";
import { getMyUserId } from "../../services/friendsService";
import type { MessageRow } from "../../types/social";

type Props = {
  conversationId: string;
};

export default function ChatWindow({ conversationId }: Props) {
  const [myId, setMyId] = useState<string>("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => text.trim().length > 0, [text]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const uid = await getMyUserId();
        if (!mounted) return;
        setMyId(uid);

        const initial = await loadMessages(conversationId, 150);
        if (!mounted) return;
        setMessages(initial);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function handleSend() {
    if (!canSend) return;
    const current = text;
    setText("");
    try {
      await sendMessage(conversationId, current);
    } catch (e) {
      // si falla, devolvemos el texto
      setText(current);
      console.error(e);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
        <div className="text-slate-600">Cargando chat…</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
      <div className="h-[55vh] overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                  mine
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 text-slate-900"
                }`}
              >
                {m.body}
                <div className={`mt-1 text-[11px] ${mine ? "text-white/80" : "text-slate-500"}`}>
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-100 p-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje…"
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="rounded-xl bg-violet-600 px-4 py-2 text-white font-semibold disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
