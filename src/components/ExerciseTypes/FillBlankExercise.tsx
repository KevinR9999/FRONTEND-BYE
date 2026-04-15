import { useState } from 'react';

interface FillBlankExerciseProps {
  question: string;
  correctAnswer: string;
  isLastQuestion?: boolean; 
  onAnswer: (isCorrect: boolean, userAnswer?: string) => void;
}

export default function FillBlankExercise({
  question,
  correctAnswer,
  isLastQuestion = false,
  onAnswer
}: FillBlankExerciseProps) {
  const [userAnswer, setUserAnswer] = useState('');

  function checkAnswer() {
    const validAnswers = correctAnswer.split('|').map(a => a.toLowerCase().trim());
    const isCorrect = validAnswers.includes(userAnswer.toLowerCase().trim());
    onAnswer(isCorrect, userAnswer);
  }

  // Dividir la pregunta en partes (antes y después del blank)
  const parts = question.split('___');
  const beforeBlank = parts[0]?.trim() || '';
  const afterBlank = parts[1]?.trim() || '';

  return (
    <div className="space-y-6">

      {/* Mostrar la oración con el espacio en blanco visual */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
        <p className="text-sm text-blue-700 font-semibold mb-4 text-center">
          Complete the sentence:
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xl sm:text-2xl font-semibold text-gray-900">
          <span>{beforeBlank}</span>
          <span className="inline-block min-w-[120px] px-4 py-2 bg-white border-2 border-dashed border-indigo-400 rounded-lg text-indigo-400 text-center">
            ___
          </span>
          <span>{afterBlank}</span>
        </div>
      </div>

      {/* Input para escribir la respuesta */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-8">
        <div className="max-w-lg mx-auto">
          <label
            htmlFor="answer-input"
            className="block text-sm font-medium text-slate-600 mb-3 text-center"
          >
            Write the correct word:
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
            placeholder="Type here..."
            className="w-full px-6 py-4 text-2xl font-bold text-center text-slate-900 bg-white border-3 border-indigo-400 rounded-xl outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-200 transition-all placeholder:text-slate-400"
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className="text-xs text-slate-500 text-center mt-3">
            💡 Press Enter or click "Check"
          </p>
        </div>
      </div>

      {/* Botones de acción mejorados */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => onAnswer(false, '')}
          className="px-8 py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-[10px] font-bold text-base transition-all hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 min-h-[52px]"
        >
          Skip
        </button>

        <button
          onClick={checkAnswer}
          disabled={!userAnswer.trim()}
          className={`
            relative overflow-hidden px-8 py-4 rounded-[10px] font-bold text-base transition-all min-h-[52px]
            ${userAnswer.trim()
              ? 'bg-gradient-to-br from-[#5B5FC7] to-[#4A4FA8] text-white shadow-[0_4px_12px_rgba(91,95,199,0.25)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(91,95,199,0.3)] active:translate-y-0'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
            }
          `}
        >
          {isLastQuestion ? 'Finish Test' : 'Continue'}
        </button>
      </div>
    </div>
  );
}