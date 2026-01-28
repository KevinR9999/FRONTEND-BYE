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
      <p className="text-center text-gray-600 text-[15px] font-medium mb-2">
        Tap words to build the sentence
      </p>

      {/* Banco de palabras - Word Bank */}
      <div className="flex flex-wrap gap-3 justify-center p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-[10px] min-h-[140px]">
        {availableWords.map((word, idx) => (
          <button
            key={`avail-${idx}-${word}`}
            onClick={() => handleWordClick(word, true)}
            className="px-5 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-md font-semibold text-[15px]
                       transition-all duration-150 hover:border-[#5B5FC7] hover:-translate-y-1 hover:shadow-md
                       active:-translate-y-0.5 active:scale-98 select-none shadow-sm"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Área de construcción de oración */}
      <div className={`min-h-[140px] p-6 border-2 border-dashed rounded-[10px] flex flex-wrap gap-3 items-start justify-center transition-all
        ${selectedWords.length === 0
          ? 'bg-white border-gray-300 items-center'
          : 'bg-[#EEEEFF] border-[#5B5FC7]'
        }`}
      >
        {selectedWords.length === 0 ? (
          <p className="text-gray-400 text-[15px] font-medium">Tap words above to build your answer</p>
        ) : (
          selectedWords.map((word, idx) => (
            <button
              key={`sel-${idx}-${word}`}
              onClick={() => handleWordClick(word, false)}
              className="px-5 py-3 bg-[#5B5FC7] border-2 border-[#5B5FC7] text-white rounded-md font-semibold text-[15px]
                         transition-all duration-150 hover:bg-[#4A4FA8] hover:-translate-y-1
                         active:-translate-y-0.5 select-none shadow-sm animate-[wordPlaced_0.3s_ease-out]"
            >
              {word}
            </button>
          ))
        )}
      </div>

      {/* Botones de acción mejorados */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => {
            setSelectedWords([]);
            setAvailableWords(words);
          }}
          className="px-8 py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-[10px] font-bold text-base transition-all hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 min-h-[52px]"
        >
          Reset
        </button>

        <button
          onClick={checkAnswer}
          disabled={selectedWords.length === 0}
          className={`
            relative overflow-hidden px-8 py-4 rounded-[10px] font-bold text-base transition-all min-h-[52px]
            ${selectedWords.length > 0
              ? 'bg-gradient-to-br from-[#5B5FC7] to-[#4A4FA8] text-white shadow-[0_4px_12px_rgba(91,95,199,0.25)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(91,95,199,0.3)] active:translate-y-0'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
            }
          `}
        >
          {isLastQuestion ? 'Finish Test' : 'Check Answer'}
        </button>
      </div>
    </div>
  );
}