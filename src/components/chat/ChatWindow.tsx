import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { loadMessages, sendMessage } from "../../services/chatService";
import { getMyUserId } from "../../services/friendsService";
import type { MessageRow } from "../../types/social";

type Props = {
  conversationId: string;
  peerName?: string;
};

const AUDIO_BUCKET = "chat-audios"; // ✅ crea este bucket en Supabase Storage
const AUDIO_PREFIX = "__audio__:";  // ✅ marcador para renderizar audio
const AUDIO_PREFIX_ALT = "_audio_:"; // ✅ soporta audios viejos si existen

function IconMic(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconStop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}
function IconSmile(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z" stroke="currentColor" strokeWidth="2" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 10h.01M15 10h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function IconSend(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M22 2 11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ✅ ícono de audio para mostrar en la burbuja (sin URL)
function IconAudio(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="2" />
      <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const EMOJIS = [
  "😀","😁","😂","🤣","😊","😍","😘","😎","🥳","🤩","😅","😇",
  "🙂","🙃","😉","😌","😴","🤔","😮","😱","😡","🥺","😭","😤",
  "👍","👎","👏","🙏","💪","🔥","✨","💯","🎉","❤️","💜","💙",
  "😺","😸","🙈","🙉","🙊","🎧","🎮","📚","☕","🍕","⚽","🎯",
];

function initials(name?: string | null) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "U";
}

function formatTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function makeUuid() {
  // crypto.randomUUID() no existe en algunos navegadores viejos
  // fallback simple
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = crypto as any;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function ChatWindow({ conversationId, peerName }: Props) {
  const [myId, setMyId] = useState<string>("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const [showEmoji, setShowEmoji] = useState(false);

  // Audio
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string>("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const canSend = useMemo(() => text.trim().length > 0, [text]);
  const peerInitials = useMemo(() => initials(peerName || "Usuario"), [peerName]);

  // Load initial
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

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function handleSendText() {
    if (!canSend) return;
    setShowEmoji(false);

    const current = text.trim();
    setText("");

    try {
      await sendMessage(conversationId, current);
    } catch (e) {
      setText(current);
      console.error(e);
    }
  }

  function cleanupStream() {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
  }

  function stopTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    setShowEmoji(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Tu navegador no soporta grabación de audio.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      alert("Tu navegador no soporta MediaRecorder (audio).");
      return;
    }

    // limpia preview anterior
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl("");
    setAudioBlob(null);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      setAudioBlob(blob);
      setAudioPreviewUrl(url);

      cleanupStream();
      stopTimer();
      setIsRecording(false);
      setRecSeconds(0);
    };

    recorder.start();
    setIsRecording(true);
    setRecSeconds(0);

    timerRef.current = window.setInterval(() => {
      setRecSeconds((s) => s + 1);
    }, 1000);
  }

  async function stopRecording() {
    try {
      recorderRef.current?.stop();
    } catch (e) {
      console.error(e);
      cleanupStream();
      stopTimer();
      setIsRecording(false);
    }
  }

  async function uploadAudioAndSend() {
    if (!audioBlob || !myId) return;

    try {
      // Ruta: {myId}/{conversationId}/{uuid}.webm
      const path = `${myId}/${conversationId}/${Date.now()}-${makeUuid()}.webm`;

      const { error: upErr } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(path, audioBlob, {
          contentType: audioBlob.type || "audio/webm",
          upsert: false,
        });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;

      // Enviamos como "mensaje" con marcador de audio
      await sendMessage(conversationId, `${AUDIO_PREFIX}${publicUrl}`);

      // Limpia preview
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl("");
      setAudioBlob(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "No se pudo enviar el audio.");
    }
  }

  function cancelAudio() {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl("");
    setAudioBlob(null);
  }

  // ✅ Render helpers (solo audio)
  function isAudio(body: string | null) {
    if (!body) return false;
    return body.startsWith(AUDIO_PREFIX) || body.startsWith(AUDIO_PREFIX_ALT);
  }

  function audioUrl(body: string) {
    if (body.startsWith(AUDIO_PREFIX)) return body.slice(AUDIO_PREFIX.length).trim();
    if (body.startsWith(AUDIO_PREFIX_ALT)) return body.slice(AUDIO_PREFIX_ALT.length).trim();
    return body.trim();
  }

  const recLabel = `${pad2(Math.floor(recSeconds / 60))}:${pad2(recSeconds % 60)}`;

  return (
    // ✅ CLAVE para que NO se corte dentro del contorno
    <div className="h-full min-h-0 flex flex-col">
      {/* MENSAJES */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 bg-slate-50">
        {loading ? (
          <div className="text-slate-600">Cargando chat…</div>
        ) : messages.length === 0 ? (
          <div className="text-slate-600">Aún no hay mensajes.</div>
        ) : (
          <div className="space-y-2">
            {messages.map((m, i) => {
              const mine = m.sender_id === myId;
              const prev = messages[i - 1];
              const next = messages[i + 1];

              const startsGroup = !prev || prev.sender_id !== m.sender_id;
              const endsGroup = !next || next.sender_id !== m.sender_id;

              const showAvatar = !mine && startsGroup;
              const showTag = mine && startsGroup;
              const showTime = endsGroup;

              const bubble =
                mine
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white border-transparent"
                  : "bg-white text-slate-800 border-violet-200";

              const radiusMine = [
                "rounded-2xl",
                startsGroup ? "rounded-tr-2xl" : "rounded-tr-md",
                endsGroup ? "rounded-br-md" : "rounded-br-2xl",
              ].join(" ");

              const radiusOther = [
                "rounded-2xl",
                startsGroup ? "rounded-tl-2xl" : "rounded-tl-md",
                endsGroup ? "rounded-bl-md" : "rounded-bl-2xl",
              ].join(" ");

              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={mine ? "max-w-[78%]" : "max-w-[82%]"}>
                    {showTag && (
                      <div className="flex justify-end mb-1">
                        <span className="rounded-full bg-violet-600 px-2 py-1 text-[10px] font-bold text-white shadow-sm">
                          Tú
                        </span>
                      </div>
                    )}

                    <div className={mine ? "flex justify-end" : "flex items-end gap-2"}>
                      {!mine && (
                        <div className="w-10 shrink-0">
                          {showAvatar ? (
                            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-violet-700 font-bold">
                              {peerInitials}
                            </div>
                          ) : (
                            <div className="h-10 w-10" />
                          )}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className={`border px-4 py-2.5 text-sm leading-relaxed shadow-sm ${bubble} ${mine ? radiusMine : radiusOther}`}>
                          {/* ✅ Texto o Audio (sin URL visible) */}
                          {isAudio(m.body) ? (
                            <div className="space-y-2">
                              <div
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${
                                  mine ? "bg-white/15 text-white" : "bg-violet-50 text-violet-700 border border-violet-200"
                                }`}
                              >
                                <IconAudio className="h-4 w-4" />
                                Audio
                              </div>

                              <audio controls className="w-[260px] max-w-full">
                                <source src={audioUrl(m.body!)} />
                              </audio>
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap break-words">{m.body}</div>
                          )}

                          {showTime && (
                            <div className={`mt-1 text-[10px] ${mine ? "text-white/80 text-right" : "text-slate-500"}`}>
                              {formatTime(m.created_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* PANEL EMOJIS */}
      {showEmoji && (
        <div className="border-t border-slate-200 bg-white px-3 py-3">
          <div className="text-xs font-semibold text-slate-600 mb-2">Emojis</div>
          <div className="grid grid-cols-8 gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 text-lg active:scale-95"
                onClick={() => setText((p) => p + e)}
                title={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AUDIO PREVIEW */}
      {audioBlob && audioPreviewUrl && !isRecording && (
        <div className="border-t border-slate-200 bg-white px-3 py-3">
          <div className="flex items-center gap-3">
            <audio controls className="flex-1">
              <source src={audioPreviewUrl} />
            </audio>

            <button
              type="button"
              onClick={uploadAudioAndSend}
              className="rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md active:scale-95"
            >
              Enviar
            </button>

            <button
              type="button"
              onClick={cancelAudio}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm active:scale-95"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* INPUT */}
      <div className="bg-white border-t border-slate-200 px-3 py-3">
        {/* Grabando */}
        {isRecording && (
          <div className="mb-2 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-3 py-2">
            <div className="text-sm font-semibold text-red-700">
              Grabando… <span className="font-mono">{recLabel}</span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="grid h-9 w-9 place-items-center rounded-2xl bg-red-600 text-white shadow active:scale-95"
              title="Detener"
            >
              <IconStop className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* MIC */}
          <button
            type="button"
            onClick={() => (isRecording ? stopRecording() : startRecording())}
            className={`grid h-10 w-10 place-items-center rounded-2xl shadow-sm active:scale-95 ${
              isRecording ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
            title={isRecording ? "Detener" : "Grabar audio"}
          >
            {isRecording ? <IconStop className="h-5 w-5" /> : <IconMic className="h-5 w-5" />}
          </button>

          {/* INPUT */}
          <div className="flex-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribe un mensaje…"
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendText();
              }}
              disabled={isRecording || !!audioBlob} // evita conflictos mientras grabas/preview
            />

            {/* EMOJI */}
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="grid h-8 w-8 place-items-center rounded-xl bg-slate-50 text-slate-700 active:scale-95"
              title="Emojis"
            >
              <IconSmile className="h-5 w-5" />
            </button>
          </div>

          {/* SEND */}
          <button
            type="button"
            onClick={handleSendText}
            disabled={!canSend || isRecording || !!audioBlob}
            className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-white shadow-md active:scale-95 disabled:opacity-50"
            title="Enviar"
          >
            <IconSend className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 text-center text-[10px] font-semibold tracking-widest text-violet-600">
          CHAT ACTIVO
        </div>
      </div>
    </div>
  );
}
