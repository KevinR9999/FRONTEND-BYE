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

  const toggleAnswer = (id: number) => {
    setAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const correctAnswers = Object.values(answers).filter(Boolean).length;

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        alert("No se pudo obtener el usuario actual");
        return;
      }

      const level = getLevel(correctAnswers);

      // Guardar resultado en diagnostic_results
      const { error: insertError } = await supabase.from("diagnostic_results").insert({
        user_id: userData.user.id,
        correct_answers: correctAnswers,
        level,
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

      navigate("/diagnostic/result", { state: { correctAnswers } });
    } catch (err) {
      console.error(err);
      alert("Error enviando la prueba");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-6">
      <h1 className="text-2xl font-bold mb-2">Prueba diagnóstica</h1>
      <p className="text-sm text-slate-300 mb-4">
        Responde estas 20 preguntas para estimar tu nivel de inglés.
      </p>

      <div className="space-y-2 flex-1 overflow-auto pr-2">
        {QUESTIONS.map((q) => (
          <div
            key={q.id}
            className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"
          >
            <span className="text-sm">{q.text}</span>
            <button
              className={`px-3 py-1 rounded text-xs ${
                answers[q.id] ? "bg-brand-500" : "bg-slate-600"
              }`}
              onClick={() => toggleAnswer(q.id)}
            >
              {answers[q.id] ? "Correcta" : "Marcar correcta"}
            </button>
          </div>
        ))}
      </div>

      <button
        disabled={loading}
        onClick={handleSubmit}
        className="mt-4 w-full py-2 rounded bg-brand-500 hover:bg-brand-600 font-semibold"
      >
        {loading ? "Enviando..." : "Enviar prueba"}
      </button>
    </div>
  );
}
