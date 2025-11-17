// src/pages/Onboarding/DiagnosticTestPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const QUESTIONS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  text: `Pregunta diagnóstica ${i + 1}`,
}));

function getLevel(score: number): string {
  if (score <= 5) return "A1";
  if (score <= 10) return "A2";
  if (score <= 15) return "B1";
  return "B2";
}

export default function DiagnosticTestPage() {
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const totalQuestions = QUESTIONS.length;
  const answeredCount = Object.keys(answers).length;
  const completionPercent = Math.round(
    (answeredCount / totalQuestions) * 100
  );

  const toggleAnswer = (id: number) => {
    setAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async () => {
    setLoading(true);

    const correctAnswers = Object.values(answers).filter(Boolean).length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        alert("No se pudo obtener el usuario actual");
        return;
      }

      const level = getLevel(correctAnswers);

      // 👉 Guardar resultado en diagnostic_results con porcentaje
      const { error: insertError } = await supabase
        .from("diagnostic_results")
        .insert({
          user_id: userData.user.id,
          correct_answers: correctAnswers,
          level,
          percentage, // columna nueva en la tabla
        });

      if (insertError) {
        console.error(insertError);
        alert("Error guardando el resultado de la prueba");
        return;
      }

      // Actualizar perfil con el nivel y marcar prueba completada
      await supabase
        .from("profiles")
        .update({ level, diagnostic_completed: true })
        .eq("user_id", userData.user.id);

      navigate("/diagnostic/result", { state: { correctAnswers, percentage } });
    } catch (err) {
      console.error(err);
      alert("Error enviando la prueba");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-100 via-slate-100 to-slate-200 px-4">
      {/* Card estilo móvil, como en la maqueta de Present Simple */}
      <div className="w-full max-w-sm sm:max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col h-[90vh]">
        {/* HEADER morado con barra de progreso */}
        <header className="bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-5 rounded-t-[2.5rem]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-white/80">40% completado</p>
            {/* Podrías mostrar aquí algún icono o menú más adelante */}
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-center text-white mb-3">
            Present Simple
          </h1>
          {/* Barra de progreso real de la prueba */}
          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-[width] duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </header>

        {/* CONTENIDO SCROLLABLE */}
        <main className="flex-1 px-6 py-4 overflow-y-auto space-y-4">
          {/* Video placeholder */}
          <div className="w-full aspect-video rounded-2xl bg-slate-800 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/10 border border-white/30 flex items-center justify-center">
              <span className="text-2xl text-white">▶</span>
            </div>
          </div>

          {/* Grammar */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">📘</span>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                Grammar
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              The present simple is used for habits, routines, and general
              truths. Recuerda usar la forma base del verbo con I/You/We/They y
              agregar <span className="font-semibold">-s</span> con He/She/It.
            </p>
          </section>

          {/* Vocabulario clave */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧠</span>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                Vocabulario clave
              </h2>
            </div>
            <div className="bg-slate-50 rounded-2xl px-3 py-2 flex flex-wrap gap-2">
              {["always", "sometimes", "never", "usually", "often"].map(
                (word) => (
                  <span
                    key={word}
                    className="px-3 py-1 rounded-full bg-white shadow-sm border border-slate-100 text-xs text-slate-700"
                  >
                    {word}
                  </span>
                )
              )}
            </div>
          </section>

          {/* Preguntas diagnósticas */}
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Preguntas de la prueba
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Marca las que consideres correctas. Esta prueba es solo un
              diagnóstico rápido de tu nivel.
            </p>

            <div className="space-y-2">
              {QUESTIONS.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2 border border-slate-100"
                >
                  <span className="text-xs sm:text-sm text-slate-800">
                    {q.text}
                  </span>
                  <button
                    className={`px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium transition ${
                      answers[q.id]
                        ? "bg-violet-500 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                    onClick={() => toggleAnswer(q.id)}
                  >
                    {answers[q.id] ? "Correcta" : "Marcar"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* BOTÓN INFERIOR */}
        <footer className="px-6 pb-5 pt-2">
          <button
            disabled={loading}
            onClick={handleSubmit}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 font-semibold text-white text-sm shadow-md hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : "Enviar prueba"}
          </button>
        </footer>
      </div>
    </div>
  );
}
