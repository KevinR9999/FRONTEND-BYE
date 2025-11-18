// src/pages/Lessons/VerbLessonPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

type Skill = "grammar" | "listening" | "reading" | "writing" | "speaking";
type QuestionType = "mcq" | "fill-in";

interface BaseQuestion {
  id: string;
  skill: Skill;
  type: QuestionType;
  prompt: string;
}

interface MCQQuestion extends BaseQuestion {
  type: "mcq";
  options: string[];
  correctIndex: number;
  explanation?: string;
}

interface FillInQuestion extends BaseQuestion {
  type: "fill-in";
  correctAnswers: string[];
  explanation?: string;
  placeholder?: string;
}

type Question = MCQQuestion | FillInQuestion;

type LessonConfig = {
  title: string;
  subtitle: string;
  level: string;
  videoUrl: string;
  grammarExplanation: string[];
  examples: string[];
  questions: Question[];
};

interface LessonRow {
  id: string;
  title: string;
  level: string;
  order_index: number;
  estimated_minutes: number | null;
}

type AnswerRecord = {
  userAnswer: string | number | null;
  isCorrect?: boolean;
  checked: boolean;
};

const slugify = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

// 🔹 Config local de contenidos de cada lección
const LESSONS_CONFIG: Record<string, LessonConfig> = {
  "present-simple": {
    title: "Present Simple",
    subtitle: "Hábitos, rutinas y verdades generales",
    level: "A2 · B1",
    videoUrl: "https://www.youtube.com/embed/4R8AiCk2E14",
    grammarExplanation: [
      "Usamos el present simple para hablar de hábitos, rutinas y cosas que siempre son verdaderas.",
      "Con I / You / We / They usamos el verbo base: 'I work', 'They live in Bogotá'.",
      "Con He / She / It agregamos -s o -es: 'She works', 'He goes to school'.",
    ],
    examples: [
      "I get up at 7 a.m. every day.",
      "She works in a hospital.",
      "They don't like coffee.",
      "Do you play football on weekends?",
    ],
    questions: [
      {
        id: "ps-g1",
        skill: "grammar",
        type: "mcq",
        prompt: "¿Cuál oración está en present simple y es correcta?",
        options: [
          "She go to school every day.",
          "She goes to school every day.",
          "She is go to school every day.",
          "She going to school every day.",
        ],
        correctIndex: 1,
        explanation:
          "Con 'She' usamos present simple con -es: 'go → goes'.",
      },
      {
        id: "ps-g2",
        skill: "grammar",
        type: "fill-in",
        prompt: "Completa: They ___ English on Mondays. (to study)",
        correctAnswers: ["study"],
        placeholder: "tu respuesta...",
        explanation:
          "Con 'They' usamos el verbo base sin -s: 'They study English'.",
      },
      {
        id: "ps-l1",
        skill: "listening",
        type: "mcq",
        prompt:
          "Imagina que escuchas: 'I get up at 6 and go to work at 7.' ¿Cuál opción describe mejor?",
        options: [
          "He is talking about his daily routine.",
          "He is talking about yesterday.",
          "He is talking about next weekend.",
          "He never works.",
        ],
        correctIndex: 0,
        explanation:
          "Usa present simple ('get up', 'go') para hablar de rutina diaria.",
      },
      {
        id: "ps-r1",
        skill: "reading",
        type: "mcq",
        prompt:
          "Lee: 'Tom works in a bank. He lives in London.' ¿Qué es verdadero?",
        options: [
          "Tom is working in a bank now.",
          "Tom worked in a bank last year.",
          "Tom works in a bank and lives in London.",
          "Tom will work in a bank.",
        ],
        correctIndex: 2,
        explanation:
          "El texto usa present simple para describir hechos actuales: 'works', 'lives'.",
      },
      {
        id: "ps-w1",
        skill: "writing",
        type: "fill-in",
        prompt: "Completa: She ___ breakfast at 7 a.m. every day. (to have)",
        correctAnswers: ["has"],
        placeholder: "tu respuesta...",
        explanation:
          "Con 'She' usamos 'has' (forma irregular de 'have' en present simple).",
      },
      {
        id: "ps-s1",
        skill: "speaking",
        type: "fill-in",
        prompt:
          "Imagina que dices: 'Yo vivo en Bogotá'. Escríbelo (o dilo) en inglés en present simple.",
        correctAnswers: ["i live in bogota", "i live in bogotá"],
        placeholder: "Habla o escribe tu respuesta...",
        explanation:
          "La estructura correcta es 'I live in Bogotá.' con present simple.",
      },
    ],
  },
  "past-simple": {
    title: "Past Simple",
    subtitle: "Acciones terminadas en el pasado",
    level: "A2 · B1",
    videoUrl: "https://www.youtube.com/embed/jxmzY9soFXg",
    grammarExplanation: [
      "Usamos el past simple para acciones que comenzaron y terminaron en el pasado.",
      "Con verbos regulares agregamos -ed: 'worked', 'visited'.",
      "Muchos verbos son irregulares: 'go → went', 'see → saw'.",
    ],
    examples: [
      "I visited my grandparents last weekend.",
      "She watched a movie yesterday.",
      "They didn't go to the party.",
      "Did you study for the exam?",
    ],
    questions: [
      {
        id: "ps2-g1",
        skill: "grammar",
        type: "mcq",
        prompt: "¿Cuál oración está en past simple y es correcta?",
        options: [
          "Yesterday I go to the park.",
          "Yesterday I went to the park.",
          "Yesterday I am going to the park.",
          "Yesterday I going to the park.",
        ],
        correctIndex: 1,
        explanation: "'Went' es la forma en past simple de 'go'.",
      },
      {
        id: "ps2-g2",
        skill: "grammar",
        type: "fill-in",
        prompt: "Completa: She ___ a movie last night. (to watch)",
        correctAnswers: ["watched"],
        placeholder: "tu respuesta...",
        explanation:
          "Verbo regular: 'watch → watched' en past simple.",
      },
      {
        id: "ps2-l1",
        skill: "listening",
        type: "mcq",
        prompt:
          "Imagina que escuchas: 'Last Saturday, we visited our grandparents.' ¿Qué significa?",
        options: [
          "Los visitan todos los sábados.",
          "Los visitaron el sábado pasado.",
          "Los visitarán el próximo sábado.",
          "Nunca visitan a sus abuelos.",
        ],
        correctIndex: 1,
        explanation:
          "'Last Saturday' y 'visited' indican una acción concreta en el pasado.",
      },
      {
        id: "ps2-r1",
        skill: "reading",
        type: "mcq",
        prompt:
          "Texto: 'Tom got up at 6 a.m., went for a run and had a quick breakfast.' ¿Qué tiempo verbal se usa?",
        options: [
          "Present simple.",
          "Present continuous.",
          "Past simple con verbos irregulares.",
          "Future with will.",
        ],
        correctIndex: 2,
        explanation:
          "Formas 'got', 'went', 'had' son past simple de 'get', 'go', 'have'.",
      },
      {
        id: "ps2-w1",
        skill: "writing",
        type: "fill-in",
        prompt:
          "Completa: I ___ dinner with my friends last night. (to have)",
        correctAnswers: ["had"],
        placeholder: "tu respuesta...",
        explanation: "'Had' es la forma de past simple de 'have'.",
      },
      {
        id: "ps2-s1",
        skill: "speaking",
        type: "fill-in",
        prompt:
          "Escribe o di en voz alta en inglés: 'Ayer estudié inglés durante dos horas.'",
        correctAnswers: [
          "yesterday i studied english for two hours",
          "yesterday i studied english for 2 hours",
        ],
        placeholder: "Habla o escribe tu oración...",
        explanation:
          "Fíjate en 'Yesterday I studied English for two hours.' → verbo 'studied' y orden correcto.",
      },
    ],
  },
  "present-continuous": {
    title: "Present Continuous",
    subtitle: "Acciones en progreso ahora",
    level: "A2 · B1",
    videoUrl: "https://www.youtube.com/embed/8ZKq0r-g87M",
    grammarExplanation: [
      "Usamos el present continuous para acciones en progreso ahora.",
      "Estructura: subject + am/is/are + verb-ing.",
      "Ejemplos: 'I am studying', 'She is working', 'They are watching TV'.",
    ],
    examples: [
      "I am studying English right now.",
      "She is talking on the phone.",
      "They aren't listening.",
      "Are you watching the movie?",
    ],
    questions: [
      {
        id: "pc-g1",
        skill: "grammar",
        type: "mcq",
        prompt: "¿Cuál oración está en present continuous y es correcta?",
        options: [
          "She study English now.",
          "She studies English now.",
          "She is studing English now.",
          "She is studying English now.",
        ],
        correctIndex: 3,
        explanation:
          "Present continuous: 'is' + verbo en -ing → 'is studying'.",
      },
      {
        id: "pc-g2",
        skill: "grammar",
        type: "fill-in",
        prompt: "Completa: They ___ football right now. (to play)",
        correctAnswers: ["are playing"],
        placeholder: "tu respuesta...",
        explanation:
          "Con 'They' usamos 'are playing' (are + verbo-ing).",
      },
      {
        id: "pc-l1",
        skill: "listening",
        type: "mcq",
        prompt:
          "Imagina que escuchas: 'Right now, I am sitting in a café.' ¿Qué está haciendo la persona?",
        options: [
          "Está sentada en un café en este momento.",
          "Siempre está en el café.",
          "Estuvo en un café ayer.",
          "Estará en un café mañana.",
        ],
        correctIndex: 0,
        explanation:
          "'Right now' + 'am sitting' → acción en progreso en el momento de hablar.",
      },
      {
        id: "pc-r1",
        skill: "reading",
        type: "mcq",
        prompt:
          "Texto: 'Anna is staying in London this week.' ¿Qué indica el present continuous aquí?",
        options: [
          "Una verdad general.",
          "Una rutina de todos los días.",
          "Una acción temporal durante esta semana.",
          "Un plan para el futuro lejano.",
        ],
        correctIndex: 2,
        explanation:
          "Usamos present continuous para acciones temporales alrededor del presente.",
      },
      {
        id: "pc-w1",
        skill: "writing",
        type: "fill-in",
        prompt:
          "Completa: I ___ to music at the moment. (to listen)",
        correctAnswers: ["am listening"],
        placeholder: "tu respuesta...",
        explanation: "Estructura: 'I am listening' (am + verbo-ing).",
      },
      {
        id: "pc-s1",
        skill: "speaking",
        type: "fill-in",
        prompt:
          "Escribe o di: 'Estoy practicando inglés ahora mismo.' en inglés.",
        correctAnswers: [
          "i am practicing english right now",
          "i'm practicing english right now",
        ],
        placeholder: "Habla o escribe tu respuesta...",
        explanation:
          "Usa 'I am / I'm practicing English right now.' con present continuous.",
      },
    ],
  },
  "future-with-will": {
    title: "Future with will",
    subtitle: "Decisiones espontáneas y predicciones",
    level: "B1",
    videoUrl: "https://www.youtube.com/embed/JGJ4o7XhK8s",
    grammarExplanation: [
      "Usamos 'will' para decisiones rápidas, promesas y predicciones.",
      "Estructura: subject + will + verbo base.",
      "Ejemplos: 'I will call you', 'It will rain tomorrow'.",
    ],
    examples: [
      "I will help you with your homework.",
      "She will be late.",
      "They won't come to the party.",
      "Will you travel next year?",
    ],
    questions: [
      {
        id: "fw-g1",
        skill: "grammar",
        type: "mcq",
        prompt: "¿Cuál oración usa 'will' correctamente para una promesa?",
        options: [
          "I help you later.",
          "I will help you later.",
          "I am help you later.",
          "I helping you later.",
        ],
        correctIndex: 1,
        explanation:
          "'I will help you later.' → 'will' + verbo base para una promesa.",
      },
      {
        id: "fw-g2",
        skill: "grammar",
        type: "fill-in",
        prompt: "Completa: It ___ rain tomorrow. (will / won't)",
        correctAnswers: ["will", "will "],
        placeholder: "tu respuesta...",
        explanation:
          "Para una predicción afirmativa usamos 'will': 'It will rain tomorrow.'",
      },
      {
        id: "fw-l1",
        skill: "listening",
        type: "mcq",
        prompt:
          "Imagina que escuchas: 'Don't worry, I'll call you tonight.' ¿Qué intención expresa el hablante?",
        options: [
          "Una rutina diaria.",
          "Una acción que está pasando ahora.",
          "Una promesa para el futuro cercano.",
          "Un recuerdo del pasado.",
        ],
        correctIndex: 2,
        explanation:
          "'I'll call you tonight' se usa como promesa / decisión rápida.",
      },
      {
        id: "fw-r1",
        skill: "reading",
        type: "mcq",
        prompt:
          "Texto: 'In the future, people will use more renewable energy.' ¿Qué expresa 'will use'?",
        options: [
          "Un hecho del pasado.",
          "Una predicción sobre el futuro.",
          "Una acción en progreso.",
          "Una orden.",
        ],
        correctIndex: 1,
        explanation:
          "'Will use' indica una predicción sobre lo que pasará en el futuro.",
      },
      {
        id: "fw-w1",
        skill: "writing",
        type: "fill-in",
        prompt:
          "Completa: I think it ___ be very hot tomorrow. (will / won't)",
        correctAnswers: ["will"],
        placeholder: "tu respuesta...",
        explanation:
          "Para una predicción positiva: 'it will be very hot tomorrow'.",
      },
      {
        id: "fw-s1",
        skill: "speaking",
        type: "fill-in",
        prompt:
          "Escribe o di: 'Te llamaré más tarde.' usando 'will'.",
        correctAnswers: ["i will call you later", "i'll call you later"],
        placeholder: "Habla o escribe tu respuesta...",
        explanation:
          "Lo natural es 'I will call you later.' o la forma contraída 'I'll call you later.'",
      },
    ],
  },
};

export default function VerbLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>(); // slug de la URL
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});

  // 🔹 Info del usuario (id + email)
  const [userInfo, setUserInfo] = useState<{ id: string; email: string | null } | null>(null);

  // 🔹 Fila real de la tabla lessons para este slug
  const [lessonDb, setLessonDb] = useState<LessonRow | null>(null);
  const [loadingLessonDb, setLoadingLessonDb] = useState(true);

  const config = useMemo(
    () => (lessonId ? LESSONS_CONFIG[lessonId] : undefined),
    [lessonId]
  );

  const totalQuestions = config?.questions.length ?? 0;
  const correctCount = Object.values(answers).filter(
    (a) => a.checked && a.isCorrect
  ).length;
  const progress = totalQuestions
    ? Math.round((correctCount / totalQuestions) * 100)
    : 0;

  // 🧑‍🎓 Cargar usuario actual (id + email)
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        setUserInfo({ id: data.user.id, email: data.user.email ?? null });
      }
    };
    loadUser();
  }, []);

  // 📚 Buscar la fila de la tabla lessons que corresponde a este slug
  useEffect(() => {
    const loadLessonDb = async () => {
      if (!lessonId) return;
      setLoadingLessonDb(true);
      try {
        const { data, error } = await supabase.from("lessons").select("*");
        if (error) {
          console.error("Error cargando lessons:", error);
          setLessonDb(null);
          return;
        }
        const rows = (data || []) as LessonRow[];
        const row = rows.find((r) => slugify(r.title) === lessonId);
        setLessonDb(row ?? null);
      } catch (err) {
        console.error("Error inesperado cargando lesson:", err);
        setLessonDb(null);
      } finally {
        setLoadingLessonDb(false);
      }
    };
    loadLessonDb();
  }, [lessonId]);

  // 💾 Guardar progreso en user_lesson_progress (NO en lessons)
  useEffect(() => {
    if (!userInfo || !lessonDb || totalQuestions === 0) return;

    const saveProgress = async () => {
      try {
        const { id: userId, email } = userInfo;

        // 👉 Nombre y nivel de la lección (para guardar en la tabla)
        const lessonTitle = lessonDb?.title ?? config?.title ?? "";
        const lessonLevel = lessonDb?.level ?? config?.level ?? "";

        // ¿Ya existe un registro de progreso para este user + lesson?
        const { data, error } = await supabase
          .from("user_lesson_progress")
          .select("id")
          .eq("user_id", userId)
          .eq("lesson_id", lessonDb.id)
          .order("created_at", { ascending: false }) // NUEVO: tomamos la fila más reciente
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error buscando progreso:", error);
          return;
        }

        const base = {
          user_id: userId,
          lesson_id: lessonDb.id,
          percentage: progress,
          is_completed: progress === 100,
          updated_at: new Date().toISOString(),
          user_email: email,          // si tienes esta columna
          lesson_title: lessonTitle,  // nombre de la lección
          lesson_level: lessonLevel,  // nivel de la lección
        };

        console.log("Guardando progreso en user_lesson_progress:", base);

        if (data && (data as any).id) {
          await supabase
            .from("user_lesson_progress")
            .update(base)
            .eq("id", (data as any).id);
        } else {
          await supabase
            .from("user_lesson_progress")
            .insert({ ...base, created_at: new Date().toISOString() });
        }
      } catch (err) {
        console.error("Error guardando progreso de la lección:", err);
      }
    };

    saveProgress();
  }, [progress, userInfo, lessonDb, totalQuestions, config]);

  // ⛔ Si el slug no existe en la config
  if (!lessonId || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="bg-white rounded-2xl shadow-md px-6 py-4">
          <p className="text-sm text-slate-700 mb-3">
            La lección que buscas no existe.
          </p>
          <button
            onClick={() => navigate("/lessons")}
            className="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-semibold"
          >
            Volver a lecciones
          </button>
        </div>
      </div>
    );
  }

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || { checked: false }),
        userAnswer: optionIndex,
      },
    }));
  };

  const handleChangeFillIn = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || { checked: false }),
        userAnswer: value,
      },
    }));
  };

  const checkMCQ = (question: MCQQuestion) => {
    const current = answers[question.id];
    if (current?.userAnswer === null || current?.userAnswer === undefined) {
      alert("Selecciona una opción antes de comprobar.");
      return;
    }

    const selectedIndex = current.userAnswer as number;
    const isCorrect = selectedIndex === question.correctIndex;

    setAnswers((prev) => ({
      ...prev,
      [question.id]: {
        userAnswer: selectedIndex,
        checked: true,
        isCorrect,
      },
    }));
  };

  const checkFillIn = (question: FillInQuestion) => {
    const current = answers[question.id];
    const raw = (current?.userAnswer ?? "") as string;
    const normalizedUser = raw.trim().toLowerCase();

    if (!normalizedUser) {
      alert("Escribe tu respuesta antes de comprobar.");
      return;
    }

    const isCorrect = question.correctAnswers.some(
      (ans) => normalizedUser === ans.trim().toLowerCase()
    );

    setAnswers((prev) => ({
      ...prev,
      [question.id]: {
        userAnswer: raw,
        checked: true,
        isCorrect,
      },
    }));
  };

  // 🎙️ Reconocimiento de voz para preguntas de speaking
  const startSpeechRecognition = (questionId: string) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz (prueba en Chrome).");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US"; // respuestas en inglés
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleChangeFillIn(questionId, transcript);
    };

    recognition.onerror = () => {
      alert("Hubo un problema con el reconocimiento de voz.");
    };

    recognition.start();
  };

  const renderQuestion = (q: Question) => {
    const state = answers[q.id];
    const isChecked = state?.checked;
    const isCorrect = state?.isCorrect;

    if (q.type === "mcq") {
      const selectedIndex =
        typeof state?.userAnswer === "number"
          ? (state.userAnswer as number)
          : -1;
      const mcq = q as MCQQuestion;

      const base =
        "w-full text-xs sm:text-sm rounded-xl border px-3 py-2 text-left transition cursor-pointer text-slate-800";

      return (
        <div
          key={mcq.id}
          className="bg-slate-50 rounded-2xl px-3 py-2.5 border border-slate-100 space-y-2"
        >
          <p className="text-xs sm:text-sm text-slate-800">{mcq.prompt}</p>
          <div className="space-y-1.5">
            {mcq.options.map((opt, idx) => {
              const isSelected = idx === selectedIndex;
              const isCorrectOption = idx === mcq.correctIndex;

              let extra = " border-slate-200 bg-white";
              if (isSelected && !isChecked) {
                extra = " border-violet-500 bg-violet-50";
              }
              if (isChecked && isCorrectOption) {
                extra = " border-emerald-500 bg-emerald-50";
              }
              if (isChecked && !isCorrect && isSelected) {
                extra = " border-red-500 bg-red-50";
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectOption(mcq.id, idx)}
                  className={`${base}${extra}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-1">
            <button
              type="button"
              onClick={() => checkMCQ(mcq)}
              className="text-[11px] sm:text-xs px-3 py-1.5 rounded-full bg-violet-500 text-white font-medium hover:bg-violet-600"
            >
              Comprobar
            </button>
            {isChecked && (
              <p
                className={`text-[11px] sm:text-xs ${
                  isCorrect ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {isCorrect ? "✅ ¡Correcto!" : "❌ Respuesta incorrecta"}
              </p>
            )}
          </div>
          {isChecked && !isCorrect && (
            <div className="mt-1 text-[11px] sm:text-xs text-slate-600">
              <p>
                <span className="font-semibold">Respuesta correcta:</span>{" "}
                {mcq.options[mcq.correctIndex]}
              </p>
              {mcq.explanation && (
                <p className="mt-0.5 text-slate-500">{mcq.explanation}</p>
              )}
            </div>
          )}
        </div>
      );
    }

    // fill-in
    const fill = q as FillInQuestion;
    const rawValue = (state?.userAnswer as string) ?? "";

    return (
      <div
        key={fill.id}
        className="bg-slate-50 rounded-2xl px-3 py-2.5 border border-slate-100 space-y-2"
      >
        <p className="text-xs sm:text-sm text-slate-800">{fill.prompt}</p>
        <input
          type="text"
          value={rawValue}
          onChange={(e) => handleChangeFillIn(fill.id, e.target.value)}
          placeholder={fill.placeholder ?? "Escribe tu respuesta..."}
          className={`w-full text-xs sm:text-sm rounded-xl border px-3 py-2 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent ${
            isChecked
              ? isCorrect
                ? "border-emerald-500 bg-emerald-50"
                : "border-red-500 bg-red-50"
              : "border-slate-200"
          }`}
        />
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => checkFillIn(fill)}
              className="text-[11px] sm:text-xs px-3 py-1.5 rounded-full bg-violet-500 text-white font-medium hover:bg-violet-600"
            >
              Comprobar
            </button>

            {fill.skill === "speaking" && (
              <button
                type="button"
                onClick={() => startSpeechRecognition(fill.id)}
                className="text-[11px] sm:text-xs px-3 py-1.5 rounded-full border border-violet-500 text-violet-600 hover:bg-violet-50"
              >
                🎙️ Hablar
              </button>
            )}
          </div>

          {isChecked && (
            <p
              className={`text-[11px] sm:text-xs ${
                isCorrect ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {isCorrect ? "✅ ¡Correcto!" : "❌ Revisa tu respuesta"}
            </p>
          )}
        </div>
        {isChecked && !isCorrect && (
          <div className="mt-1 text-[11px] sm:text-xs text-slate-600">
            <p>
              <span className="font-semibold">Respuesta correcta:</span>{" "}
              {fill.correctAnswers[0]}
            </p>
            {fill.explanation && (
              <p className="mt-0.5 text-slate-500">{fill.explanation}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const skillsOrder: Skill[] = [
    "grammar",
    "listening",
    "reading",
    "writing",
    "speaking",
  ];

  const skillLabels: Record<Skill, { icon: string; label: string }> = {
    grammar: { icon: "📘", label: "Grammar" },
    listening: { icon: "🎧", label: "Listening" },
    reading: { icon: "📖", label: "Reading" },
    writing: { icon: "✍️", label: "Writing" },
    speaking: { icon: "🗣️", label: "Speaking" },
  };

  const headerTitle = lessonDb?.title ?? config.title;
  const headerLevel = lessonDb?.level ?? config.level;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col h-[90vh] max-h-[820px]">
        {/* HEADER LECCIÓN */}
        <header className="bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-5 rounded-t-[2.5rem]">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate("/lessons")}
              className="text-white/80 text-sm"
            >
              ← Volver
            </button>
            <span className="text-[11px] text-white/90">
              {loadingLessonDb ? "..." : headerLevel}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-center text-white">
            {headerTitle}
          </h1>
          <p className="text-[11px] sm:text-xs text-center text-white/80 mt-1">
            {config.subtitle}
          </p>

          {/* Barra de progreso */}
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mt-4">
            <div
              className="h-full bg-white rounded-full transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-white/80 text-right">
            {progress}% correcto
          </p>
        </header>

        {/* CONTENIDO SCROLLABLE */}
        <main className="flex-1 px-6 py-3 overflow-y-auto space-y-4">
          {/* VIDEO EXPLICATIVO */}
          <section>
            <div className="w-full aspect-video rounded-2xl overflow-hidden bg-slate-900">
              <iframe
                className="w-full h-full"
                src={config.videoUrl}
                title={headerTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>

          {/* GRAMMAR EXPLICACIÓN RÁPIDA */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">📘</span>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                Resumen de la regla
              </h2>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-slate-700">
              {config.grammarExplanation.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
            <div className="mt-2 bg-slate-50 rounded-2xl px-3 py-2">
              <p className="text-[11px] sm:text-xs text-slate-500 mb-1">
                Ejemplos:
              </p>
              <ul className="list-disc list-inside text-xs sm:text-sm text-slate-700 space-y-1">
                {config.examples.map((ex, idx) => (
                  <li key={idx}>{ex}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* PREGUNTAS POR SKILL */}
          {skillsOrder.map((skill) => {
            const group = config.questions.filter((q) => q.skill === skill);
            if (!group.length) return null;

            const answeredInSkill = group.filter(
              (q) => answers[q.id]?.checked && answers[q.id]?.isCorrect
            ).length;

            return (
              <section key={skill} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {skillLabels[skill].icon}
                    </span>
                    <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                      {skillLabels[skill].label}
                    </h2>
                  </div>
                  <span className="text-[11px] sm:text-xs text-slate-400">
                    {answeredInSkill}/{group.length} correctas
                  </span>
                </div>
                <div className="space-y-2">
                  {group.map((q) => renderQuestion(q))}
                </div>
              </section>
            );
          })}
        </main>

        {/* FOOTER / NAVEGACIÓN */}
        <footer className="px-6 py-3 border-t border-slate-100 bg-white rounded-b-[2.5rem] flex items-center justify-between text-[11px] sm:text-xs">
          <Link
            to="/lessons"
            className="text-violet-500 font-semibold hover:underline"
          >
            ← Volver a lecciones
          </Link>
          <span className="text-slate-400">
            Correctas:{" "}
            <span className="font-semibold">
              {correctCount}/{totalQuestions}
            </span>
          </span>
        </footer>
      </div>
    </div>
  );
}
