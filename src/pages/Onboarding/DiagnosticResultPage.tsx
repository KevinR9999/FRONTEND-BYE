import { useLocation, useNavigate } from "react-router-dom";

function getLevel(score: number): string {
  if (score <= 5) return "A1 (Principiante)";
  if (score <= 10) return "A2 (Elemental)";
  if (score <= 15) return "B1 (Intermedio)";
  return "B2 (Intermedio-Alto)";
}

export default function DiagnosticResultPage() {
  const location = useLocation() as any;
  const navigate = useNavigate();
  const correctAnswers: number = location.state?.correctAnswers ?? 0;
  const level = getLevel(correctAnswers);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-md text-center space-y-4 shadow-2xl">
        <h1 className="text-2xl font-bold">Resultado de tu prueba</h1>
        <p>
          Respuestas correctas:{" "}
          <span className="font-semibold">{correctAnswers}/20</span>
        </p>
        <p>
          Tu nivel estimado es:{" "}
          <span className="font-semibold text-brand-500">{level}</span>
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 w-full py-2 rounded bg-brand-500 hover:bg-brand-600 font-semibold"
        >
          Ir al dashboard
        </button>
      </div>
    </div>
  );
}
