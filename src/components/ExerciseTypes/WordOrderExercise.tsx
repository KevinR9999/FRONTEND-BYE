import { useState } from 'react';

interface WordOrderExerciseProps {
  question: string;
  correctAnswer: string;
  words: string[];
  isLastQuestion?: boolean; 
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
}

export default function WordOrderExercise({
  question,
  correctAnswer,
  words,
  isLastQuestion = false,
  onAnswer
}: WordOrderExerciseProps) {
  const [availableWords, setAvailableWords] = useState<string[]>(words || []);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);

  function handleWordClick(word: string, fromAvailable: boolean) {
    if (fromAvailable) {
      setAvailableWords(availableWords.filter(w => w !== word));
      setSelectedWords([...selectedWords, word]);
    } else {
      setSelectedWords(selectedWords.filter(w => w !== word));
      setAvailableWords([...availableWords, word]);
    }
  }

  function checkAnswer() {
    const userSentence = selectedWords.join(' ');
    const isCorrect = userSentence.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    onAnswer(isCorrect, userSentence);
  }

  return (
    <div className="space-y-6">

      {/* Palabras disponibles */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-fuchsia-50 border-2 border-indigo-200 rounded-2xl p-6">
        <p className="text-sm text-indigo-700 font-medium mb-4 text-center">
          Toca las palabras para formar la oración correcta
        </p>
        
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {availableWords.map((word, idx) => (
            <button
              key={`avail-${idx}-${word}`}
              onClick={() => handleWordClick(word, true)}
              className="px-4 py-2 bg-white border-2 border-indigo-400 text-indigo-700 rounded-lg font-semibold hover:bg-indigo-50 transition-all shadow-sm hover:shadow-md"
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      {/* Área de respuesta */}
      <div className="min-h-[120px] bg-white border-2 border-slate-300 rounded-2xl p-4">
        <p className="text-xs text-slate-500 mb-2 text-center">Tu respuesta:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {selectedWords.length === 0 ? (
            <p className="text-slate-400 text-sm py-4">Toca las palabras de arriba...</p>
          ) : (
            selectedWords.map((word, idx) => (
              <button
                key={`sel-${idx}-${word}`}
                onClick={() => handleWordClick(word, false)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md"
              >
                {word}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Botón verificar/finalizar */}
      <button
        onClick={checkAnswer}
        disabled={selectedWords.length === 0}
        className={`w-full px-8 py-4 rounded-2xl font-bold text-lg transition-all ${
          selectedWords.length > 0
            ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02]'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isLastQuestion ? '✓ Finalizar prueba' : 'Siguiente pregunta'}
      </button>
    </div>
  );
}