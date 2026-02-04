// src/pages/Lessons/LessonsByLevelPage.tsx
// ✅ IMPORTANTE (imagen Coach BYE):
// Coloca la imagen en: /public/coach-bye-capybara.png
// (así <img src="/coach-bye-capybara.png" /> funciona sin imports)

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

/* =========================
   TYPES
========================= */

type Level = "A1" | "A2" | "B1" | "B2";
const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

type Skill =
  | "grammar"
  | "vocabulary"
  | "reading"
  | "listening"
  | "writing"
  | "speaking";

type QuestionType = "mcq" | "fill-in" | "word-order" | "match";

type LessonRow = {
  id: string;
  level: Level;
  title: string;
  order_index: number | string;
  estimated_minutes: number | string;
  is_locked: boolean | string;
};

type ProgressRow = {
  lesson_id: string;
  progress: number; // 0-100
  completed: boolean; // true only if >= 80% (we enforce)
  correct_count: number;
  total_questions: number;
  xp_earned: number;
};

type MatchPair = { left: string; right: string };

type QuestionRow = {
  id: string;
  lesson_id: string;
  type: QuestionType;
  skill: Skill;

  prompt: string;
  options: any; // jsonb

  correct_index: number | null;
  correct_answers: string[] | null;
  explanation: string | null;
  order_index: number;

  listen_text: string | null;
  audio_bucket: string | null;
  audio_path: string | null;

  image_url: string | null;

  // runtime-only:
  __correct?: boolean;
};

type RouteParams = { level?: string; lessonId?: string };

/* =========================
   SETTINGS
========================= */

const PASS_PCT = 80;
const MAX_HEARTS = 5;
const XP_PER_CORRECT = 10;
const QUESTIONS_PER_ATTEMPT = 15;
const COACH_BYE_IMG = "/coach-bye-capybara.png";

/* =========================
   HELPERS
========================= */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNumber(v: number | string) {
  if (typeof v === "number") return v;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(s: string) {
  return (s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s']/g, "")
    .replace(/\s+/g, " ");
}

// FNV-1a-ish hash for deterministic seed
function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rand: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function levenshtein(a: string, b: string) {
  const s = a ?? "";
  const t = b ?? "";
  const n = s.length;
  const m = t.length;
  if (n === 0) return m;
  if (m === 0) return n;

  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[n][m];
}

function similarity(a: string, b: string) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);
  const maxLen = Math.max(aa.length, bb.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(aa, bb);
  return 1 - dist / maxLen;
}

/* =========================
   PROMPT CLEAN (UI)
   - remove "(0%)" and "support text" artifacts
========================= */

function cleanPromptForUI(q: QuestionRow) {
  let p = (q.prompt ?? "").trim();

  // remove trailing "(0%)" / "(12%)" etc
  p = p.replace(/\(\s*\d+\s*%\s*\)\s*$/g, "").trim();

  // remove "support text" wording
  p = p.replace(/\(\s*support\s*text\s*\)/gi, "");
  p = p.replace(/support\s*text/gi, "");

  // remove leading "Listening:" if exists
  if (q.skill === "listening") {
    p = p.replace(/^listening\s*:\s*/i, "").trim();
  }

  // clean extra spaces
  p = p.replace(/\s+/g, " ").trim();
  return p;
}

function extractQuotedSentence(prompt: string) {
  const m = (prompt ?? "").match(/"([^"]+)"/);
  return m?.[1]?.trim() || null;
}

/* =========================
   LISTENING FALLBACK (No support text shown)
   - If no audio, speak via TTS using:
     1) listen_text (hidden)
     2) sentence inside quotes in prompt (fill blank with correct answer)
     3) correct option (mcq)
========================= */

function buildListeningSpeakText(q: QuestionRow) {
  if (q.listen_text && q.listen_text.trim()) return q.listen_text.trim();

  const quoted = extractQuotedSentence(q.prompt);
  const base = (quoted ?? q.prompt ?? "").trim();

  if (q.type === "fill-in") {
    const ans = q.correct_answers?.[0];
    if (ans && /_{2,}/.test(base)) {
      return base.replace(/_{2,}/g, ans).replace(/\s+/g, " ").trim();
    }
  }

  if (q.type === "mcq" && Array.isArray(q.options) && q.correct_index != null) {
    const opt = (q.options as any[])[q.correct_index];
    if (typeof opt === "string" && opt.trim()) return opt.trim();
  }

  if (q.type === "word-order" && q.correct_answers?.[0]) {
    return q.correct_answers[0].trim();
  }

  return null;
}

/* =========================
   QUESTION VALIDATION
========================= */

function validateQuestion(q: QuestionRow): string[] {
  const issues: string[] = [];

  if (!q.prompt || !q.prompt.trim()) issues.push("prompt vacío");

  if (q.type === "mcq") {
    if (!Array.isArray(q.options)) issues.push("mcq options no es array");
    else {
      const opts = q.options as any[];
      if (opts.length < 2) issues.push("mcq options < 2");
      if (q.correct_index === null || q.correct_index === undefined)
        issues.push("mcq sin correct_index");
      else if (q.correct_index < 0 || q.correct_index >= opts.length)
        issues.push("mcq correct_index fuera de rango");
    }
  }

  if (q.type === "fill-in") {
    if (!q.correct_answers || q.correct_answers.length === 0)
      issues.push("fill-in sin correct_answers");
  }

  if (q.type === "word-order") {
    if (!q.correct_answers || q.correct_answers.length === 0)
      issues.push("word-order sin correct_answers");
  }

  if (q.type === "match") {
    const pairs = q.options?.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0)
      issues.push("match sin options.pairs[]");
    else {
      const bad = (pairs as any[]).some((p) => !p?.left || !p?.right);
      if (bad) issues.push("match pairs incompletos (left/right)");
    }
  }

  return issues;
}

/* =========================
   DEDUPE (avoid same prompt repeated)
========================= */

function questionContentKey(q: QuestionRow) {
  const opt = q.options ? JSON.stringify(q.options) : "";
  const ca = q.correct_answers
    ? q.correct_answers.map(normalizeText).join("|")
    : "";
  const ci = q.correct_index ?? "";
  return `${q.type}|${q.skill}|${normalizeText(q.prompt)}|${opt}|${ci}|${ca}`;
}

/* =========================
   BUILD ATTEMPT SET (15 random)
========================= */

function buildAttemptSet(
  all: QuestionRow[],
  lessonId: string,
  userId: string | null,
  attempt: number,
  desiredCount = QUESTIONS_PER_ATTEMPT
) {
  const seedKey = `${lessonId}|${userId ?? "anon"}|attempt:${attempt}`;
  const rand = mulberry32(hashString(seedKey));

  const valid = all
    .map((q) => ({ q, issues: validateQuestion(q) }))
    .filter((x) => x.issues.length === 0)
    .map((x) => x.q);

  const invalid = all.length - valid.length;
  if (invalid > 0) {
    console.warn(
      `[lesson_questions] ${invalid} preguntas inválidas fueron ignoradas para lesson_id=${lessonId}`
    );
  }
  if (valid.length === 0)
    return { set: [] as QuestionRow[], invalidCount: invalid, totalValid: 0 };

  // dedupe by content
  const seen = new Set<string>();
  const unique: QuestionRow[] = [];
  for (const q of valid) {
    const k = questionContentKey(q);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(q);
  }

  // quotas (variedad)
  const quotas: Array<[Skill, number]> = [
    ["speaking", 2],
    ["listening", 3],
    ["reading", 3],
    ["writing", 2],
    ["grammar", 3],
    ["vocabulary", 2],
  ];

  const shuffled = seededShuffle(unique, rand);

  const picked: QuestionRow[] = [];
  const used = new Set<string>();

  const pickFromSkill = (skill: Skill, n: number) => {
    const pool = shuffled.filter((q) => q.skill === skill && !used.has(q.id));
    const take = pool.slice(0, n);
    take.forEach((q) => {
      used.add(q.id);
      picked.push(q);
    });
  };

  quotas.forEach(([skill, n]) => pickFromSkill(skill, n));

  const remaining = shuffled.filter((q) => !used.has(q.id));
  for (let i = 0; i < remaining.length && picked.length < desiredCount; i++) {
    used.add(remaining[i].id);
    picked.push(remaining[i]);
  }

  const finalList =
    picked.length >= Math.min(desiredCount, unique.length) ? picked : shuffled;

  const finalShuffled = seededShuffle(finalList, rand).map((q, i) => ({
    ...q,
    order_index: i + 1,
    __correct: undefined,
  }));

  return { set: finalShuffled, invalidCount: invalid, totalValid: unique.length };
}

/* =========================
   LOCAL STORAGE ATTEMPTS
========================= */

function attemptKey(lessonId: string) {
  return `bye_attempt_${lessonId}`;
}

function getAttempt(lessonId: string) {
  const n = Number(localStorage.getItem(attemptKey(lessonId)) ?? "1");
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function setAttempt(lessonId: string, n: number) {
  localStorage.setItem(attemptKey(lessonId), String(Math.max(1, Math.floor(n))));
}

/* =========================
   TTS
========================= */

function ttsStop() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function ttsSpeak(text: string) {
  if (!text?.trim()) return;

  if (!("speechSynthesis" in window)) {
    alert("Tu navegador no soporta Text-to-Speech.");
    return;
  }

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

/* =========================
   SPEAKING CHECK (tolerant)
========================= */

function speechWords(s: string) {
  return normalizeText((s ?? "").replace(/'/g, ""))
    .split(" ")
    .filter(Boolean);
}

function lcsLen(a: string[], b: string[]) {
  const n = a.length,
    m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[n][m];
}

function speakingThreshold(expected: string) {
  const n = speechWords(expected).length;
  if (n <= 3) return 1.0;
  if (n <= 6) return 0.85;
  return 0.8;
}

function speakingPass(spoken: string, expected: string) {
  const s = speechWords(spoken);
  const e = speechWords(expected);
  if (!e.length) return false;
  const lcs = lcsLen(s, e);
  const acc = lcs / e.length;
  return acc >= speakingThreshold(expected);
}

/* =========================
   SPEECH RECOGNITION (más estable)
========================= */

function createSpeechRecognizer(params: {
  onText: (t: string) => void;
  onState: (recording: boolean) => void;
  onError: (msg: string) => void;
}) {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  rec.onstart = () => params.onState(true);
  rec.onend = () => params.onState(false);

  rec.onerror = (e: any) => {
    params.onState(false);
    const code = e?.error || "unknown";

    if (code === "not-allowed" || code === "service-not-allowed") {
      params.onError(
        "Permiso de micrófono denegado. Actívalo en el navegador y recarga."
      );
      return;
    }
    if (code === "no-speech") {
      params.onError("No se detectó voz. Habla más cerca del micrófono.");
      return;
    }
    params.onError(`Error de reconocimiento de voz: ${code}`);
  };

  rec.onresult = (e: any) => {
    const t = e?.results?.[0]?.[0]?.transcript ?? "";
    params.onText(String(t).trim());
  };

  return rec;
}

/* =========================
   COACH BYE (imagen + bubble)
========================= */

function getCoachTip(lessonTitle: string, skill: Skill, qIndex: number) {
  const t = (lessonTitle || "").toLowerCase();

  // Tip base por módulo (title)
  let base = "Tip: Respira, lee con calma y responde sin prisa. 😉";

  if (t.includes("verb to be")) {
    base =
      "Tip: Usa AM con I, IS con he/she/it, y ARE con you/we/they. Ej: I am, She is, They are.";
  } else if (t.includes("wh questions")) {
    base =
      "Tip: WH + am/is/are (What is...?) o WH + do/does (Where do you...?). Piensa: persona, lugar, tiempo, razón.";
  } else if (t.includes("possessive adjectives")) {
    base =
      "Tip: I→my, you→your, he→his, she→her, it→its (sin apóstrofe), we→our, they→their.";
  } else if (t.includes("do and does")) {
    base =
      "Tip: DO con I/you/we/they y DOES con he/she/it. Después de do/does usa el verbo en forma base: does go (no goes).";
  }

  if (t.includes("adverbs") || t.includes("frequency")) {
    base =
      "Tip: Los adverbs of frequency van antes del verbo principal (I usually eat...), pero después de 'to be' (I am usually...).";
  } else if (t.includes("present simple")) {
    base =
      "Tip: En Present Simple, con he/she/it el verbo suele llevar -s (she works).";
  } else if (t.includes("past simple")) {
    base =
      "Tip: Past Simple: verbos regulares +ed; irregulares cambia la forma (go → went).";
  } else if (t.includes("vocabulary")) {
    base = "Tip: Aprende en pares: palabra + ejemplo corto.";
  }

  if (t.includes("ed/ing adjectives")) {
    base =
      "Tip: -ED describes feelings (I’m bored). -ING describes the thing (It’s boring).";
  } else if (
    t.includes("some, any") ||
    t.includes("a lot of") ||
    t.includes("much") ||
    t.includes("many")
  ) {
    base =
      "Tip: MANY = countable (many books). MUCH = uncountable (much water). ANY for questions/negatives; SOME for affirmative/offers.";
  } else if (
    t.includes("connectors") ||
    t.includes("because") ||
    t.includes("however")
  ) {
    base =
      "Tip: because = reason, so = result, but/however = contrast, and/as well as = addition.";
  } else if (t.includes("prepositions of movement")) {
    base =
      "Tip: into/out of = enter/exit; across = side to side; through = inside from end to end; along = following a line.";
  } else if (t.includes("booking a hotel room")) {
    base =
      "Tip: Usa frases educadas: 'I'd like to...' y 'Could you...?' + detalles (dates, nights, room type).";
  } else if (t.includes("making a complaint")) {
    base =
      "Tip: Mantén el tono profesional: 'I'm afraid...' + problema + lo que quieres (refund/replacement).";
  } else if (t.includes("job interview")) {
    base =
      "Tip: Responde con ejemplos (método STAR) y usa frases claras: strengths, experience, availability.";
  } else if (t.includes("wishes")) {
    base =
      "Tip: Wishes: presente → 'I wish I were/had...'; pasado → 'I wish I had + past participle'; hábito de otros → 'I wish you would...'.";
  } else if (t.includes("phrasal verbs")) {
    base =
      "Tip: En phrasal verbs, memoriza verbo + partícula juntos (turn down, look up) y su significado.";
  } else if (t.includes("future with going to")) {
    base =
      "Tip: 'be + going to + base verb' expresa planes o intenciones. Ej: I am going to study tonight.";
  } else if (t.includes("going to and wh questions")) {
    base =
      "Tip: WH + am/is/are + sujeto + going to + verbo. Ej: Where are you going to go?";
  } else if (t.includes("modals")) {
    base =
      "Tip: should (consejo), shouldn't (consejo negativo), can/can't (habilidad/permiso), must (obligación), mustn't (prohibición).";
  } else if (t.includes("was / were") || t.includes("was/were")) {
    base =
      "Tip: Past of 'to be': I/he/she/it → was. You/we/they → were. Negativo: wasn't / weren't.";
  }

  const skillTipBySkill: Record<Skill, string> = {
    grammar: "Tip: busca pistas de tiempo (always/never/yesterday) y la estructura.",
    vocabulary: "Tip: si no sabes una palabra, usa contexto o sinónimos.",
    reading: "Tip: primero idea general, luego detalles y palabras clave.",
    listening: "Tip: escucha 2 veces: 1) idea general 2) palabras clave.",
    writing: "Tip: escribe corto y claro; revisa sujeto + verbo.",
    speaking: "Tip: habla lento y claro. La fluidez se entrena con repetición.",
  };

  const skillTip = skillTipBySkill[skill] ?? "Tip: sigue así.";

  // Apariciones estilo Duolingo
  if (qIndex === 0) return base;
  if (qIndex === 5) return skillTip;
  if (qIndex === 10)
    return "Tip: Si dudas, elimina opciones imposibles y decide entre las 2 mejores.";
  return null;
}

function CoachByeBubble({ tip }: { tip: string }) {
  return (
    <div className="mt-4 flex items-end gap-3">
      <div className="shrink-0">
        <div className="grid h-[92px] w-[92px] place-items-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
          <img
            src={COACH_BYE_IMG}
            alt="Coach BYE"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      </div>

      <div className="relative max-w-[560px]">
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-extrabold text-violet-700">Coach BYE</div>
            <div className="text-[11px] font-semibold text-slate-400">
              consejo rápido
            </div>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-800">{tip}</div>
        </div>

        <div className="absolute -left-2 bottom-6 h-4 w-4 rotate-45 rounded-[3px] border-b border-l border-slate-200 bg-white" />
      </div>
    </div>
  );
}

/* =========================
   CONFETTI (CSS only)
========================= */

type ConfettiPiece = {
  id: string;
  leftPct: number;
  delayMs: number;
  durMs: number;
  rot: number;
  size: number;
  drift: number;
  shape: "rect" | "circle";
};

function buildConfetti(seedKey: string, count = 36): ConfettiPiece[] {
  const rand = mulberry32(hashString(seedKey));
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    const leftPct = Math.floor(rand() * 100);
    const delayMs = Math.floor(rand() * 120);
    const durMs = 650 + Math.floor(rand() * 450);
    const rot = Math.floor(rand() * 360);
    const size = 6 + Math.floor(rand() * 8);
    const drift = -40 + Math.floor(rand() * 80);
    const shape: "rect" | "circle" = rand() > 0.75 ? "circle" : "rect";
    pieces.push({
      id: `${seedKey}-${i}`,
      leftPct,
      delayMs,
      durMs,
      rot,
      size,
      drift,
      shape,
    });
  }
  return pieces;
}

function ConfettiBurst({
  show,
  seedKey,
  onDone,
}: {
  show: boolean;
  seedKey: string;
  onDone: () => void;
}) {
  const pieces = useMemo(() => buildConfetti(seedKey, 40), [seedKey]);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => onDone(), 1100);
    return () => window.clearTimeout(t);
  }, [show, onDone]);

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes bye-confetti-fall {
          0% { transform: translate3d(var(--dx), -12px, 0) rotate(var(--rot)); opacity: 1; }
          100% { transform: translate3d(calc(var(--dx) * 1.8), 140px, 0) rotate(calc(var(--rot) + 220deg)); opacity: 0; }
        }
      `}</style>

      <div className="pointer-events-none absolute left-0 top-0 h-[160px] w-full overflow-hidden">
        {pieces.map((p) => (
          <div
            key={p.id}
            className={[
              "absolute top-0",
              p.shape === "circle" ? "rounded-full" : "rounded-[3px]",
            ].join(" ")}
            style={
              {
                left: `${p.leftPct}%`,
                width: `${p.size}px`,
                height: `${p.size + (p.shape === "rect" ? 6 : 0)}px`,
                background:
                  "linear-gradient(135deg, rgba(139,92,246,1), rgba(217,70,239,1))",
                animation: `bye-confetti-fall ${p.durMs}ms ease-out ${p.delayMs}ms forwards`,
                ["--dx" as any]: `${p.drift}px`,
                ["--rot" as any]: `${p.rot}deg`,
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
              } as any
            }
          />
        ))}
      </div>
    </>
  );
}

/* =========================
   COMPONENT
========================= */

export default function LessonsByLevelPage() {
  const { level: levelParam, lessonId: lessonIdParam } =
    useParams<RouteParams>();
  const navigate = useNavigate();

  const [userId, setUserId] = useState<string | null>(null);
  const [userDiagnosticLevel, setUserDiagnosticLevel] = useState<Level | null>(
    null
  );

  const [activeLevel, setActiveLevel] = useState<Level>(
    (LEVELS.includes(levelParam as Level)
      ? (levelParam as Level)
      : "A1") as Level
  );

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // player
  const [openLessonId, setOpenLessonId] = useState<string | null>(
    lessonIdParam ?? null
  );
  const [attempt, setAttemptState] = useState(1);

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [qErr, setQErr] = useState<string | null>(null);

  const [idx, setIdx] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [gameOver, setGameOver] = useState(false);

  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);

  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");

  // speaking
  const recRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // word-order
  type WordTile = { id: string; text: string };
  const [orderPool, setOrderPool] = useState<WordTile[]>([]);
  const [orderSelected, setOrderSelected] = useState<WordTile[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  // match
  const [matchLeftSel, setMatchLeftSel] = useState<string | null>(null);
  const [matchMap, setMatchMap] = useState<Record<string, string>>({});

  // audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioErr, setAudioErr] = useState<string | null>(null);

  // celebration + feedback
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiSeed, setConfettiSeed] = useState("seed");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const current = questions[idx] ?? null;
  const total = questions.length;

  const stopAllAudio = () => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch {}
    ttsStop();
  };

  const stopSpeak = () => {
    try {
      recRef.current?.stop?.();
    } catch {}
  };

  const requestMicPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {}
  };

  const startSpeak = async () => {
    setSpeechError(null);

    await requestMicPermission();

    const rec = createSpeechRecognizer({
      onText: (t) => setTyped(t),
      onState: (st) => setIsRecording(st),
      onError: (msg) => setSpeechError(msg),
    });

    if (!rec) {
      setSpeechError(
        "Tu navegador no soporta SpeechRecognition. Prueba en Chrome o Edge."
      );
      return;
    }

    try {
      recRef.current?.abort?.();
    } catch {}

    recRef.current = rec;

    try {
      rec.start();
    } catch {
      setSpeechError(
        "No se pudo iniciar el micrófono. Revisa permisos del navegador."
      );
    }
  };

  /* =========================
     Progress refresh helper
  ========================= */

  const refreshProgress = async (uid: string) => {
    const { data: progData, error: progErr } = await supabase
      .from("lesson_progress")
      .select(
        "lesson_id, progress, completed, correct_count, total_questions, xp_earned"
      )
      .eq("user_id", uid);

    if (progErr) throw progErr;

    const progMap: Record<string, ProgressRow> = {};
    (progData ?? []).forEach((p: any) => {
      progMap[p.lesson_id] = {
        lesson_id: p.lesson_id,
        progress: Number(p.progress ?? 0),
        completed: Boolean(p.completed),
        correct_count: Number(p.correct_count ?? 0),
        total_questions: Number(p.total_questions ?? 0),
        xp_earned: Number(p.xp_earned ?? 0),
      };
    });

    setProgress(progMap);
  };

  const tryUpdateProfileTotals = async (
    uid: string,
    xpToAdd: number,
    addLessonCompleted: boolean
  ) => {
    if (!xpToAdd && !addLessonCompleted) return;

    try {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select(
          "xp_total, lessons_completed, weekly_xp, monthly_xp, last_weekly_reset, last_monthly_reset"
        )
        .eq("user_id", uid)
        .maybeSingle();

      if (profErr) throw profErr;

      const currentXp = Number((prof as any)?.xp_total ?? 0);
      const currentLessons = Number((prof as any)?.lessons_completed ?? 0);
      let weeklyXp = Number((prof as any)?.weekly_xp ?? 0);
      let monthlyXp = Number((prof as any)?.monthly_xp ?? 0);

      const lastWeeklyReset = (prof as any)?.last_weekly_reset
        ? new Date((prof as any).last_weekly_reset)
        : new Date();
      const lastMonthlyReset = (prof as any)?.last_monthly_reset
        ? new Date((prof as any).last_monthly_reset)
        : new Date();

      const now = new Date();
      let needsWeeklyReset = false;
      let needsMonthlyReset = false;

      const getMostRecentMonday = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const mostRecentMonday = getMostRecentMonday(now);

      if (mostRecentMonday > lastWeeklyReset) {
        needsWeeklyReset = true;
        weeklyXp = 0;
      }

      const firstOfThisMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0
      );
      if (firstOfThisMonth > lastMonthlyReset) {
        needsMonthlyReset = true;
        monthlyXp = 0;
      }

      const next: any = {
        xp_total: currentXp + (xpToAdd || 0),
        weekly_xp: weeklyXp + (xpToAdd || 0),
        monthly_xp: monthlyXp + (xpToAdd || 0),
        lessons_completed: currentLessons + (addLessonCompleted ? 1 : 0),
      };

      if (needsWeeklyReset) {
        next.last_weekly_reset = mostRecentMonday.toISOString();
      }
      if (needsMonthlyReset) {
        next.last_monthly_reset = firstOfThisMonth.toISOString();
      }

      const { error: updErr } = await supabase
        .from("profiles")
        .update(next)
        .eq("user_id", uid);

      if (updErr) throw updErr;
    } catch (e) {
      console.warn("[profiles] No se pudo actualizar xp_total/lessons_completed:", e);
    }
  };

  /* =========================
     LOAD LESSONS + PROGRESS
  ========================= */

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          navigate("/login");
          return;
        }
        if (!alive) return;
        setUserId(user.id);

        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("level")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profileErr && profileData?.level) {
          const diagLevel = profileData.level as Level;
          if (LEVELS.includes(diagLevel)) {
            setUserDiagnosticLevel(diagLevel);
          }
        }

        const { data: lessonsData, error: lessonsErr } = await supabase
          .from("lessons")
          .select("id, level, title, order_index, estimated_minutes, is_locked")
          .order("level", { ascending: true })
          .order("order_index", { ascending: true });

        if (lessonsErr) throw lessonsErr;

        if (!alive) return;
        setLessons((lessonsData ?? []) as LessonRow[]);

        await refreshProgress(user.id);
      } catch (e: any) {
        setErr(e?.message ?? "Error cargando lecciones");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    if (levelParam && LEVELS.includes(levelParam as Level)) {
      setActiveLevel(levelParam as Level);
    }
  }, [levelParam]);

  /* =========================
     DUOLINGO LOCKING
  ========================= */

  const lessonsByLevel = useMemo(() => {
    const map: Record<Level, LessonRow[]> = { A1: [], A2: [], B1: [], B2: [] };
    for (const l of lessons) {
      if (!map[l.level]) continue;
      map[l.level].push(l);
    }
    (Object.keys(map) as Level[]).forEach((lv) => {
      map[lv] = map[lv]
        .slice()
        .sort((a, b) => toNumber(a.order_index) - toNumber(b.order_index));
    });
    return map;
  }, [lessons]);

  const isLessonCompleted = (lessonId: string) => {
    const p = progress[lessonId];
    return Boolean(p?.completed) && Number(p?.progress ?? 0) >= PASS_PCT;
  };

  const isLevelCompleted = (lv: Level) => {
    const list = lessonsByLevel[lv] ?? [];
    if (!list.length) return false;
    return list.every((l) => isLessonCompleted(l.id));
  };

  const isLevelUnlocked = (lv: Level) => {
    if (lv === "A1") return true;

    if (userDiagnosticLevel) {
      const diagLevelIndex = LEVELS.indexOf(userDiagnosticLevel);
      const currentLevelIndex = LEVELS.indexOf(lv);
      if (currentLevelIndex <= diagLevelIndex) {
        return true;
      }
    }

    const prev = LEVELS[LEVELS.indexOf(lv) - 1] as Level | undefined;
    if (!prev) return true;
    return isLevelCompleted(prev);
  };

  const isLessonUnlocked = (lesson: LessonRow) => {
    if (!isLevelUnlocked(lesson.level)) return false;

    const locked =
      typeof lesson.is_locked === "string"
        ? lesson.is_locked === "true"
        : Boolean(lesson.is_locked);
    if (locked) return false;

    const list = lessonsByLevel[lesson.level] ?? [];
    const sorted = list
      .slice()
      .sort((a, b) => toNumber(a.order_index) - toNumber(b.order_index));
    const i = sorted.findIndex((x) => x.id === lesson.id);
    if (i <= 0) return true;

    const prevLesson = sorted[i - 1];
    return isLessonCompleted(prevLesson.id);
  };

  /* =========================
     LOAD QUESTIONS
  ========================= */

  const loadQuestions = async (lessonId: string, attemptNum: number) => {
    setQLoading(true);
    setQErr(null);
    setAudioErr(null);
    setSpeechError(null);

    try {
      stopAllAudio();
      stopSpeak();

      const { data, error } = await supabase
        .from("lesson_questions")
        .select(
          "id, lesson_id, type, skill, prompt, options, correct_index, correct_answers, explanation, order_index, listen_text, audio_bucket, audio_path, image_url"
        )
        .eq("lesson_id", lessonId)
        .order("order_index", { ascending: true });

      if (error) throw error;

      const all = (data ?? []) as QuestionRow[];
      const built = buildAttemptSet(
        all,
        lessonId,
        userId,
        attemptNum,
        QUESTIONS_PER_ATTEMPT
      );

      if (built.set.length < QUESTIONS_PER_ATTEMPT) {
        setQErr(
          `Esta lección necesita mínimo ${QUESTIONS_PER_ATTEMPT} preguntas válidas/únicas. Actualmente: ${built.totalValid}.`
        );
        setQuestions([]);
        return;
      }

      setQuestions(built.set);

      setIdx(0);
      setHearts(MAX_HEARTS);
      setGameOver(false);
      setChecked(false);
      setCorrect(null);
      setPicked(null);
      setTyped("");

      setOrderPool([]);
      setOrderSelected([]);
      setDragFrom(null);

      setMatchLeftSel(null);
      setMatchMap({});

      setToast(null);
      setShowConfetti(false);
    } catch (e: any) {
      setQErr(e?.message ?? "Error cargando preguntas");
    } finally {
      setQLoading(false);
    }
  };

  /* =========================
     OPEN / CLOSE LESSON
  ========================= */

  const openLesson = async (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    if (!isLessonUnlocked(lesson)) {
      alert("🔒 Esta lección está bloqueada. Completa la anterior con 80% para avanzar.");
      return;
    }

    const att = isLessonCompleted(lessonId) ? 1 : getAttempt(lessonId);
    setAttemptState(att);

    setOpenLessonId(lessonId);
    setActiveLevel(lesson.level);
    navigate(`/lessons/${lesson.level}/${lessonId}`);
  };

  const closeLesson = () => {
    stopAllAudio();
    stopSpeak();

    setOpenLessonId(null);
    navigate(`/lessons/${activeLevel}`);
    setQuestions([]);
    setIdx(0);
    setChecked(false);
    setCorrect(null);
    setPicked(null);
    setTyped("");
    setToast(null);
    setShowConfetti(false);
  };

  useEffect(() => {
    if (!lessonIdParam) return;
    const lesson = lessons.find((l) => l.id === lessonIdParam);
    if (!lesson) return;

    if (!isLessonUnlocked(lesson)) {
      navigate(`/lessons/${lesson.level}`);
      setOpenLessonId(null);
      return;
    }

    const att = isLessonCompleted(lessonIdParam) ? 1 : getAttempt(lessonIdParam);
    setAttemptState(att);
    setOpenLessonId(lessonIdParam);
  }, [lessonIdParam, lessons, navigate]);

  useEffect(() => {
    if (!openLessonId) return;
    loadQuestions(openLessonId, attempt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLessonId, attempt, userId]);

  /* =========================
     QUESTION INIT
  ========================= */

  useEffect(() => {
    stopAllAudio();
    stopSpeak();
    setToast(null);
    setShowConfetti(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    if (!current || current.type !== "word-order") return;

    const tokens = Array.isArray(current.options)
      ? (current.options as string[])
      : [];
    const fallback = (current.correct_answers?.[0] ?? "").toString().trim();
    const finalTokens = tokens.length
      ? tokens
      : fallback.split(/\s+/).filter(Boolean);

    const rand = mulberry32(hashString(`${current.lesson_id}|${current.id}|tiles`));
    const shuffled = seededShuffle(finalTokens, rand);

    const tiles = shuffled.map((t, i) => ({
      id: `${current.id}-${i}-${t}`,
      text: t,
    }));

    setOrderSelected([]);
    setOrderPool(tiles);
    setDragFrom(null);
  }, [current?.id, current?.type]);

  useEffect(() => {
    if (!current || current.type !== "match") return;
    setMatchLeftSel(null);
    setMatchMap({});
  }, [current?.id, current?.type]);

  const matchPairs: MatchPair[] = useMemo(() => {
    if (!current || current.type !== "match") return [];
    const pairs = current.options?.pairs;
    if (!Array.isArray(pairs)) return [];
    return pairs as MatchPair[];
  }, [current]);

  const matchLefts = useMemo(() => matchPairs.map((p) => p.left), [matchPairs]);

  const matchRights = useMemo(() => {
    const rand = mulberry32(
      hashString(`${openLessonId}|attempt:${attempt}|matchRights`)
    );
    return seededShuffle(matchPairs.map((p) => p.right), rand);
  }, [matchPairs, openLessonId, attempt]);

  const allMatched = useMemo(() => {
    if (!current || current.type !== "match") return false;
    if (!matchPairs.length) return false;
    return matchPairs.every((p) => matchMap[p.left] === p.right);
  }, [current, matchPairs, matchMap]);

  const matchedCount = useMemo(() => {
    return Object.keys(matchMap).length;
  }, [matchMap]);

  /* =========================
     AUDIO URL (optional)
========================= */

  const audioUrl = useMemo(() => {
    if (!current) return null;
    if (current.skill !== "listening") return null;
    if (!current.audio_bucket || !current.audio_path) return null;

    const { data } = supabase.storage
      .from(current.audio_bucket)
      .getPublicUrl(current.audio_path);
    return data?.publicUrl ?? null;
  }, [current]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }, [audioUrl]);

  const listeningSpeakText = useMemo(() => {
    if (!current || current.skill !== "listening") return null;
    return buildListeningSpeakText(current);
  }, [current]);

  /* =========================
     COACH TIP (NO hooks in conditionals!)
========================= */

  const openedLesson = useMemo(() => {
    return openLessonId ? lessons.find((l) => l.id === openLessonId) ?? null : null;
  }, [openLessonId, lessons]);

  const coachTip = useMemo(() => {
    if (!openedLesson || !current) return null;
    return getCoachTip(openedLesson.title, current.skill, idx);
  }, [openedLesson?.title, current?.skill, idx, openedLesson, current]);

  /* =========================
     CHECK ANSWERS
========================= */

  const disabledAll = useMemo(() => qLoading || !current, [qLoading, current]);

  const canCheck = useMemo(() => {
    if (!current) return false;
    if (checked) return false;
    if (gameOver) return false;

    if (current.type === "mcq") return picked !== null;
    if (current.type === "fill-in") return normalizeText(typed).length > 0;
    if (current.type === "word-order")
      return orderPool.length === 0 && orderSelected.length > 0;
    if (current.type === "match") return allMatched;
    return false;
  }, [
    current,
    checked,
    gameOver,
    picked,
    typed,
    orderPool.length,
    orderSelected.length,
    allMatched,
  ]);

  const fireCelebration = (seed: string) => {
    setConfettiSeed(seed);
    setShowConfetti(true);
  };

  const checkAnswer = () => {
    if (!current || !canCheck) return;

    let ok = false;

    if (current.type === "mcq") {
      ok = picked === current.correct_index;
    }

    if (current.type === "fill-in") {
      const answers = current.correct_answers ?? [];
      const ans = normalizeText(typed);

      if (current.skill === "speaking") {
        ok =
          answers.map(normalizeText).includes(ans) ||
          answers.some((exp) => speakingPass(typed, exp)) ||
          answers.some((exp) => similarity(typed, exp) >= 0.86);
      } else {
        ok = answers.map(normalizeText).includes(ans);
      }
    }

    if (current.type === "word-order") {
      const built = normalizeText(orderSelected.map((t) => t.text).join(" "));
      const target = (current.correct_answers ?? []).map(normalizeText);
      ok = target.includes(built);
    }

    if (current.type === "match") {
      ok = matchPairs.every((p) => matchMap[p.left] === p.right);
    }

    setChecked(true);
    setCorrect(ok);

    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], __correct: ok };
      return next;
    });

    if (ok) {
      setToast({ ok: true, msg: "¡Correcto! ✅" });
      fireCelebration(`${current.id}-${Date.now()}`);
    } else {
      setToast({ ok: false, msg: "Incorrecto ❌ (intenta la siguiente)" });
      setHearts((h) => {
        const nh = Math.max(0, h - 1);
        if (nh === 0) setGameOver(true);
        return nh;
      });
    }
  };

  const nextQuestion = () => {
    stopAllAudio();
    stopSpeak();

    setChecked(false);
    setCorrect(null);
    setPicked(null);
    setTyped("");
    setMatchLeftSel(null);

    setIdx((i) => clamp(i + 1, 0, Math.max(0, total - 1)));
  };

  const prevQuestion = () => {
    stopAllAudio();
    stopSpeak();

    setChecked(false);
    setCorrect(null);
    setPicked(null);
    setTyped("");
    setMatchLeftSel(null);

    setIdx((i) => clamp(i - 1, 0, Math.max(0, total - 1)));
  };

  // word-order handlers
  const handlePickWord = (tile: { id: string; text: string }) => {
    setOrderPool((pool) => pool.filter((t) => t.id !== tile.id));
    setOrderSelected((sel) =>
      sel.some((t) => t.id === tile.id) ? sel : [...sel, tile]
    );
  };

  const handleUndoWord = (tileId: string) => {
    setOrderSelected((sel) => {
      const tile = sel.find((t) => t.id === tileId);
      if (!tile) return sel;
      setOrderPool((pool) =>
        pool.some((t) => t.id === tile.id) ? pool : [...pool, tile]
      );
      return sel.filter((t) => t.id !== tileId);
    });
  };

  const reorderSelected = (from: number, to: number) => {
    setOrderSelected((sel) => {
      const next = [...sel];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  };

  // match handler
  const handleMatchRightClick = (right: string) => {
    if (!matchLeftSel || checked || disabledAll) return;

    const pair = matchPairs.find((p) => p.left === matchLeftSel);
    const ok = pair?.right === right;

    if (ok) {
      setMatchMap((m) => ({ ...m, [matchLeftSel]: right }));
      setMatchLeftSel(null);
    } else {
      setMatchLeftSel(null);
    }
  };

  /* =========================
     FINISH LESSON
========================= */

  const canFinish = useMemo(
    () => idx === total - 1 && checked,
    [idx, total, checked]
  );

  const finishLesson = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user || !openLessonId) return;

      const correctCount = questions.filter((q) => q.__correct === true).length;
      const totalQ = questions.length;
      const pctLocal = totalQ ? Math.round((correctCount / totalQ) * 100) : 0;
      const completedNow = pctLocal >= PASS_PCT;

      const prev = progress[openLessonId];
      const prevCompleted =
        Boolean(prev?.completed) && Number(prev?.progress ?? 0) >= PASS_PCT;
      const prevXp = Number(prev?.xp_earned ?? 0);

      const xpToAdd =
        completedNow && !prevCompleted ? correctCount * XP_PER_CORRECT : 0;
      const newXp = prevXp + xpToAdd;

      const lessonLevel =
        lessons.find((l) => l.id === openLessonId)?.level ?? activeLevel;

      const { error: upsertErr } = await supabase.from("lesson_progress").upsert(
        {
          user_id: user.id,
          lesson_id: openLessonId,
          level: lessonLevel,
          progress: pctLocal,
          completed: completedNow,
          correct_count: correctCount,
          total_questions: totalQ,
          xp_earned: newXp,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id,lesson_id" }
      );

      if (upsertErr) throw upsertErr;

      await refreshProgress(user.id);
      await tryUpdateProfileTotals(user.id, xpToAdd, completedNow && !prevCompleted);

      if (!completedNow) {
        const nextAttempt = getAttempt(openLessonId) + 1;
        setAttempt(openLessonId, nextAttempt);
        alert(
          `⚠️ No aprobaste (necesitas ${PASS_PCT}%). Puntaje: ${pctLocal}%.\nIntenta de nuevo para ver variación.`
        );
      } else {
        setAttempt(openLessonId, 1);
        alert(`✅ Lección completada. Puntaje: ${pctLocal}%.\nXP: +${xpToAdd}`);
      }

      stopAllAudio();
      stopSpeak();

      setOpenLessonId(null);
      navigate(`/lessons/${activeLevel}`);
      setQuestions([]);
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo guardar el progreso.";
      alert(`❌ No se pudo guardar el progreso.\n\nDetalle: ${msg}`);
      console.error("finishLesson error:", e);
    }
  };

  /* =========================
     UI
========================= */

  const filteredLessons = useMemo(() => {
    const list = lessonsByLevel[activeLevel] ?? [];
    return list
      .slice()
      .sort((a, b) => toNumber(a.order_index) - toNumber(b.order_index));
  }, [lessonsByLevel, activeLevel]);

  const progressBarPct = useMemo(() => {
    if (!total) return 0;
    return Math.round(((idx + 1) / total) * 100);
  }, [idx, total]);

  const displayPrompt = current ? cleanPromptForUI(current) : "";
  const speakingTarget =
    current?.skill === "speaking" ? current.correct_answers?.[0] ?? "" : "";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 text-slate-700">
        <div className="mx-auto max-w-4xl">Cargando lecciones…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 text-slate-700">
        <div className="mx-auto max-w-4xl rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          {err}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Header (solo en PLAYER) */}
        {openLessonId && openedLesson ? (
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold">Lecciones</h1>
              <p className="text-sm text-slate-600">
                Para avanzar debes aprobar cada lección con <b>{PASS_PCT}%</b>. (Intento:{" "}
                <b>{attempt}</b>)
              </p>
            </div>

            {/* Level tabs */}
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((lv) => {
                const unlocked = isLevelUnlocked(lv);
                const completed = isLevelCompleted(lv);

                return (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => {
                      if (!unlocked) {
                        alert(
                          `🔒 Nivel bloqueado. Completa el nivel anterior para desbloquear ${lv}.`
                        );
                        return;
                      }
                      setActiveLevel(lv);
                      setOpenLessonId(null);
                      navigate(`/lessons/${lv}`);
                    }}
                    className={[
                      "rounded-2xl px-4 py-2 text-sm font-semibold transition",
                      unlocked
                        ? "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                        : "cursor-not-allowed bg-slate-200 text-slate-500",
                      activeLevel === lv && unlocked ? "ring-2 ring-violet-400/40" : "",
                    ].join(" ")}
                  >
                    {lv} {completed ? "✅" : unlocked ? "" : "🔒"}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* PLAYER */}
        {openLessonId && openedLesson ? (
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <ConfettiBurst
              show={showConfetti}
              seedKey={confettiSeed}
              onDone={() => setShowConfetti(false)}
            />

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">
                  Nivel {openedLesson.level}
                </div>
                <h2 className="text-xl font-extrabold">{openedLesson.title}</h2>
                <div className="mt-1 text-sm text-slate-600">
                  Pregunta {total ? idx + 1 : 0}/{total} • ❤️ {hearts}/{MAX_HEARTS}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopAllAudio();
                    stopSpeak();

                    setIdx(0);
                    setHearts(MAX_HEARTS);
                    setGameOver(false);
                    setChecked(false);
                    setCorrect(null);
                    setPicked(null);
                    setTyped("");
                    setOrderPool([]);
                    setOrderSelected([]);
                    setDragFrom(null);
                    setMatchLeftSel(null);
                    setMatchMap({});
                    setQuestions((prev) =>
                      prev.map((q) => ({ ...q, __correct: undefined }))
                    );
                    setToast(null);
                    setShowConfetti(false);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reiniciar
                </button>

                <button
                  type="button"
                  onClick={closeLesson}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Salir
                </button>
              </div>
            </div>

            {/* progress bar */}
            <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                style={{ width: `${progressBarPct}%` }}
              />
            </div>

            {qErr && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-rose-900">
                {qErr}
              </div>
            )}

            {!current ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
                {qLoading ? "Cargando preguntas…" : "No hay preguntas para esta lección."}
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                {current.image_url && (
                  <div className="mt-3 flex justify-center">
                    <div className="grid h-[180px] w-[180px] place-items-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                      <img
                        src={current.image_url}
                        alt="Imagen de la pregunta"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain p-6"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="text-lg font-extrabold">{displayPrompt}</div>

                {/* COACH BYE */}
                {coachTip && <CoachByeBubble tip={coachTip} />}

                {/* LISTENING (sin texto de apoyo) */}
                {current.skill === "listening" && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-slate-700">
                        <div className="font-semibold">Listening</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {audioUrl ? "Audio" : "Voz del dispositivo"}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAudioErr(null);

                            if (audioUrl) {
                              if (!audioRef.current) return;
                              audioRef.current.currentTime = 0;
                              audioRef.current
                                .play()
                                .catch(() =>
                                  setAudioErr("No se pudo reproducir el audio.")
                                );
                              return;
                            }

                            if (listeningSpeakText) {
                              ttsSpeak(listeningSpeakText);
                              return;
                            }

                            setAudioErr(
                              "Esta pregunta no tiene audio ni texto para reproducir."
                            );
                          }}
                          className="rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow active:scale-[0.99]"
                        >
                          🔊 Escuchar
                        </button>

                        <button
                          type="button"
                          onClick={stopAllAudio}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          ⏹️ Detener
                        </button>
                      </div>
                    </div>

                    {audioUrl && (
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        preload="none"
                        onError={() => setAudioErr("No se pudo reproducir el audio.")}
                      />
                    )}

                    {audioErr && (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        {audioErr}
                      </div>
                    )}
                  </div>
                )}

                {/* MCQ */}
                {current.type === "mcq" && Array.isArray(current.options) && (
                  <div className="mt-4 space-y-2">
                    {(current.options as string[]).map((opt, i) => {
                      const isPicked = picked === i;
                      const showState = checked;
                      const isCorrect = i === current.correct_index;

                      const cls = showState
                        ? isCorrect
                          ? "w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left font-semibold text-emerald-900"
                          : isPicked
                          ? "w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left font-semibold text-rose-900"
                          : "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-700"
                        : isPicked
                        ? "w-full rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-left font-semibold text-violet-900"
                        : "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99]";

                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={checked || disabledAll}
                          onClick={() => setPicked(i)}
                          className={cls}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* WORD ORDER */}
                {current.type === "word-order" && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border bg-white p-3">
                      <div className="mb-2 text-xs text-slate-600">
                        Tu oración (toca para quitar / arrastra para ordenar):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {orderSelected.length === 0 ? (
                          <div className="text-sm text-slate-500">
                            Toca palabras para construir la oración…
                          </div>
                        ) : (
                          orderSelected.map((tile, i) => (
                            <button
                              key={tile.id}
                              type="button"
                              draggable={!checked && !disabledAll}
                              onDragStart={() => setDragFrom(i)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => {
                                if (dragFrom === null) return;
                                reorderSelected(dragFrom, i);
                                setDragFrom(null);
                              }}
                              onClick={() => handleUndoWord(tile.id)}
                              disabled={checked || disabledAll}
                              className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
                              title="Quitar (o arrastra para reordenar)"
                            >
                              {tile.text}
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-white p-3">
                      <div className="mb-2 text-xs text-slate-600">Palabras:</div>
                      <div className="flex flex-wrap gap-2">
                        {orderPool.map((tile) => (
                          <button
                            key={tile.id}
                            type="button"
                            disabled={checked || disabledAll}
                            onClick={() => handlePickWord(tile)}
                            className="rounded-xl border bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 active:scale-[0.99]"
                          >
                            {tile.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* MATCH */}
                {current.type === "match" && (
                  <div className="mt-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-600">
                        Cómo jugar:{" "}
                        <span className="font-semibold">toca la palabra (izq)</span> y
                        luego su pareja (der).
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        Emparejadas: {matchedCount}/{matchPairs.length}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        {matchLefts.map((l) => {
                          const mapped = matchMap[l];
                          const isSel = matchLeftSel === l;

                          const cls = mapped
                            ? "w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left font-semibold text-emerald-900"
                            : isSel
                            ? "w-full rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-left font-semibold text-violet-900"
                            : "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99]";

                          return (
                            <button
                              key={l}
                              type="button"
                              disabled={checked || disabledAll}
                              className={cls}
                              onClick={() => {
                                if (mapped) return;
                                setMatchLeftSel(l);
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span>{l}</span>
                                {mapped ? (
                                  <span className="text-xs font-extrabold text-emerald-700">
                                    ✓ {mapped}
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="space-y-2">
                        {matchRights.map((r, i) => {
                          const alreadyUsed = Object.values(matchMap).includes(r);
                          const cls = alreadyUsed
                            ? "w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-400"
                            : "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.99]";

                          return (
                            <button
                              key={`${r}-${i}`}
                              type="button"
                              disabled={checked || disabledAll || alreadyUsed}
                              className={cls}
                              onClick={() => handleMatchRightClick(r)}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* FILL-IN (also speaking) */}
                {current.type === "fill-in" && (
                  <div className="mt-4 space-y-3">
                    {current.skill === "speaking" && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-sm font-semibold text-slate-800">
                          Speaking: Repeat the sentence
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          {speakingTarget || "Say the sentence."}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => ttsSpeak(speakingTarget)}
                            disabled={!speakingTarget}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            🔊 Escuchar
                          </button>

                          {!isRecording ? (
                            <button
                              type="button"
                              onClick={startSpeak}
                              disabled={checked || disabledAll}
                              className="rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-60 active:scale-[0.99]"
                            >
                              🎙️ Grabar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={stopSpeak}
                              className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow active:scale-[0.99]"
                            >
                              ⏹️ Parar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setTyped("")}
                            disabled={checked || disabledAll}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            🧹 Limpiar
                          </button>

                          <button
                            type="button"
                            onClick={ttsStop}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            🔇 Stop voz
                          </button>
                        </div>

                        {isRecording && (
                          <div className="mt-2 text-xs font-semibold text-violet-700">
                            Escuchando...
                          </div>
                        )}

                        {speechError && (
                          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            {speechError}
                            <div className="mt-1 text-xs text-amber-700">
                              Nota: Opera a veces no soporta SpeechRecognition. Chrome/Edge funciona mejor.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <input
                      value={typed}
                      disabled={checked || disabledAll}
                      onChange={(e) => setTyped(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm !text-slate-900 caret-slate-900 placeholder:!text-slate-400 outline-none focus:ring-2 focus:ring-violet-500/30"
                      placeholder={
                        current.skill === "speaking"
                          ? "Tu transcripción aparecerá aquí… (o escribe manualmente)"
                          : "Escribe tu respuesta…"
                      }
                    />
                  </div>
                )}

                {/* EXPLANATION */}
                {checked && current.explanation && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <span className="font-semibold">Explicación: </span>
                    {current.explanation}
                  </div>
                )}

                {/* FEEDBACK TOAST */}
                {toast && (
                  <div
                    className={[
                      "mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold",
                      toast.ok
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-rose-200 bg-rose-50 text-rose-900",
                    ].join(" ")}
                  >
                    {toast.msg}
                  </div>
                )}

                {/* ACTIONS */}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={prevQuestion}
                      disabled={idx === 0 || qLoading}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                    >
                      ← Anterior
                    </button>

                    {!checked ? (
                      <button
                        type="button"
                        onClick={checkAnswer}
                        disabled={!canCheck || disabledAll}
                        className="rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow disabled:opacity-50 active:scale-[0.99]"
                      >
                        Comprobar
                      </button>
                    ) : canFinish ? (
                      <button
                        type="button"
                        onClick={finishLesson}
                        className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow active:scale-[0.99]"
                      >
                        Finalizar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={nextQuestion}
                        className="rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow active:scale-[0.99]"
                      >
                        Siguiente →
                      </button>
                    )}
                  </div>

                  <div className="text-sm">
                    {checked && correct !== null && (
                      <span
                        className={[
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
                          correct
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-rose-100 text-rose-900",
                        ].join(" ")}
                      >
                        {correct ? "✅ Correcto" : "❌ Incorrecto"}
                      </span>
                    )}
                  </div>
                </div>

                {gameOver && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                    <div className="text-lg font-extrabold">Game Over</div>
                    <div className="mt-1 text-sm">
                      Te quedaste sin corazones. Sal y vuelve a entrar para otro intento.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* LEVEL VIEW (MOCKUP UI) */
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {/* Purple header like mockup */}
            <div className="bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-600 px-5 py-6 text-white">
              <div className="text-2xl font-extrabold">Lecciones</div>
              <div className="mt-1 text-sm text-white/90">
                Completa cada lección al <b>{PASS_PCT}%</b> para avanzar.
                <br />
                ¡Intenta dar lo mejor!
              </div>

              {/* Level buttons (mockup style) */}
              <div className="mt-4 flex gap-3">
                {LEVELS.map((lv) => {
                  const unlocked = isLevelUnlocked(lv);
                  const completed = isLevelCompleted(lv);
                  const active = activeLevel === lv;

                  const icon = completed ? "✓" : active ? "→" : "•";

                  return (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => {
                        if (!unlocked) {
                          alert(
                            `🔒 Nivel bloqueado. Completa el nivel anterior para desbloquear ${lv}.`
                          );
                          return;
                        }
                        setActiveLevel(lv);
                        setOpenLessonId(null);
                        navigate(`/lessons/${lv}`);
                      }}
                      disabled={!unlocked}
                      className={[
                        "h-16 w-16 rounded-2xl border text-center transition",
                        unlocked ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                        active
                          ? "border-white/60 bg-white text-violet-700 shadow"
                          : "border-white/15 bg-white/10 text-white/90 hover:bg-white/15",
                      ].join(" ")}
                      title={unlocked ? `Ir a ${lv}` : `Bloqueado`}
                    >
                      <div className="pt-2 text-xl font-extrabold leading-none">{icon}</div>
                      <div className="mt-1 text-xs font-semibold">{lv}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
              {!isLevelUnlocked(activeLevel) && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  🔒 Este nivel está bloqueado. Debes completar el nivel anterior (todas sus lecciones con ≥ {PASS_PCT}%).
                </div>
              )}

              {/* Timeline list */}
              <div className="relative mx-auto max-w-2xl">
                {/* vertical line */}
                <div className="absolute left-6 top-0 h-full w-[3px] rounded-full bg-emerald-200/80" />

                <div className="space-y-4">
                  {filteredLessons.map((l) => {
                    const unlocked = isLessonUnlocked(l);
                    const completed = isLessonCompleted(l.id);
                    const p = progress[l.id];
                    const pct = clamp(Number(p?.progress ?? 0), 0, 100);

                    const statusText = completed
                      ? "Aprobada"
                      : unlocked
                      ? pct > 0
                        ? "En progreso"
                        : "Disponible"
                      : "Bloqueada";

                    const dotCls = completed
                      ? "bg-emerald-500"
                      : unlocked
                      ? pct > 0
                        ? "bg-amber-500"
                        : "bg-emerald-400"
                      : "bg-slate-300";

                    const statusCls = completed
                      ? "text-emerald-700"
                      : unlocked
                      ? pct > 0
                        ? "text-amber-700"
                        : "text-emerald-700"
                      : "text-slate-500";

                    const cardBorder =
                      unlocked || completed ? "border-emerald-300" : "border-slate-200";
                    const cardBg = unlocked || completed ? "bg-white" : "bg-slate-50";

                    const bubbleBg = completed
                      ? "bg-emerald-500 text-white"
                      : unlocked
                      ? "bg-emerald-400 text-white"
                      : "bg-slate-300 text-white";

                    const bubbleIcon = completed ? "✓" : unlocked ? "→" : "🔒";
                    const showBadge = (completed || pct > 0) && unlocked;

                    return (
                      <div key={l.id} className="relative pl-12">
                        {/* left bubble */}
                        <div
                          className={[
                            "absolute left-6 top-8 -translate-x-1/2 -translate-y-1/2",
                            "grid h-10 w-10 place-items-center rounded-full shadow",
                            bubbleBg,
                          ].join(" ")}
                        >
                          <span className="text-sm font-extrabold">{bubbleIcon}</span>
                        </div>

                        {/* card */}
                        <button
                          type="button"
                          onClick={() => openLesson(l.id)}
                          disabled={!unlocked}
                          className={[
                            "w-full rounded-3xl border p-4 text-left shadow-sm transition",
                            cardBorder,
                            cardBg,
                            unlocked ? "hover:shadow-md active:scale-[0.995]" : "opacity-80",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-base font-extrabold text-slate-900">
                                {l.title}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                <span className="inline-flex items-center gap-1">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="h-4 w-4 text-slate-400"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M12 7v5l3 2" />
                                    <circle cx="12" cy="12" r="9" />
                                  </svg>
                                  {toNumber(l.estimated_minutes)} min
                                </span>

                                <span className="inline-flex items-center gap-2">
                                  <span className={["h-2 w-2 rounded-full", dotCls].join(" ")} />
                                  <span className={["font-semibold", statusCls].join(" ")}>
                                    {statusText}
                                    {unlocked && pct > 0 ? ` (${pct}%)` : ""}
                                  </span>
                                </span>
                              </div>
                            </div>

                            {showBadge ? (
                              <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">
                                {pct}%
                              </span>
                            ) : null}
                          </div>

                          {/* progress bar */}
                          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={[
                                "h-full rounded-full transition-all",
                                unlocked ? "bg-emerald-500" : "bg-slate-300",
                              ].join(" ")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {!unlocked && (
                            <div className="mt-2 text-[11px] text-slate-500">
                              Completa la lección anterior con ≥ {PASS_PCT}%.
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 text-sm text-slate-600">
                <Link
                  to="/dashboard"
                  className="font-semibold text-violet-600 hover:underline"
                >
                  ← Volver al Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
