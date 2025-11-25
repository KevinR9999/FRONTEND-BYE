import { useState } from 'react';

interface FillBlankExerciseProps {
  question: string;
  correctAnswer: string;
  isLastQuestion?: boolean; // ← NUEVO
  onAnswer: (isCorrect: boolean, userAnswer?: string) => void;
}

export default function FillBlankExercise({ 
  correctAnswer,
  isLastQuestion = false, // ← NUEVO
  onAnswer 
}: FillBlankExerciseProps) {
  const [userAnswer, setUserAnswer] = useState('');

  function checkAnswer() {
    const isCorrect = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    onAnswer(isCorrect, userAnswer);
  }

  return (
    <div className="space-y-6">
      
      {/* Solo input, SIN repetir pregunta */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-8">
        <div className="max-w-lg mx-auto">
          <label 
            htmlFor="answer-input" 
            className="block text-sm font-medium text-slate-600 mb-3 text-center"
          >
            Escribe la palabra correcta:
          </label>
          <input
            id="answer-input"
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && userAnswer.trim()) {
                checkAnswer();
              }
            }}
            placeholder="Escribe aquí..."
            className="w-full px-6 py-4 text-2xl font-bold text-center text-slate-900 bg-white border-3 border-indigo-400 rounded-xl outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-200 transition-all placeholder:text-slate-400"
            autoFocus
            autoComplete="off"
          />
          <p className="text-xs text-slate-500 text-center mt-3">
            💡 Presiona Enter o haz click en "Verificar"
          </p>
        </div>
      </div>

      {/* Botón verificar/finalizar */}
      <button
        onClick={checkAnswer}
        disabled={!userAnswer.trim()}
        className={`w-full px-8 py-4 rounded-2xl font-bold text-lg transition-all ${
          userAnswer.trim()
            ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02]'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isLastQuestion ? '✓ Finalizar prueba' : 'siguiente pregunta'}
      </button>
    </div>
  );
}