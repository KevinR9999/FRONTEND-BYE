import React, { useState, useRef, useEffect } from 'react';

interface ListeningExerciseProps {
  question: string;
  options: string[] | { [key: string]: string };
  correctAnswer: string;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  isLastQuestion?: boolean;
}

const ListeningExercise: React.FC<ListeningExerciseProps> = ({
  question,
  options,
  correctAnswer,
  onAnswer,
  isLastQuestion = false,
}) => {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  //  CONVERTIR OBJETO A ARRAY SI ES NECESARIO
  const normalizedOptions = React.useMemo(() => {
    if (Array.isArray(options)) {
      return options;
    }
    
    if (typeof options === 'object' && options !== null) {
      return Object.values(options);
    }
    
    console.error('Formato de opciones no reconocido:', options);
    return [];
  }, [options]);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    } else {
      console.error('Web Speech API no soportada');
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const speakText = (text: string) => {
    if (!synthRef.current) {
      alert('Tu navegador no soporta síntesis de voz');
      return;
    }

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = synthRef.current.getVoices();
    const englishVoice = voices.find(voice => 
      voice.lang.startsWith('en') && voice.name.includes('Female')
    ) || voices.find(voice => voice.lang.startsWith('en'));
    
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = (event) => {
      console.error('Error en síntesis de voz:', event);
      setIsPlaying(false);
    };

    synthRef.current.speak(utterance);
  };

  const handlePlayAudio = () => {
    speakText(correctAnswer);
  };

  const handleCheck = () => {
    if (!selectedOption) {
      alert('Please select an answer');
      return;
    }

    const isCorrect = selectedOption.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    onAnswer(isCorrect, selectedOption);
  };

  if (normalizedOptions.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-8">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-600 font-semibold text-lg mb-2">Error: Invalid options</p>
        <p className="text-gray-600 text-sm mb-6">This question has an incorrect format</p>
        <button
          onClick={() => onAnswer(false, '')}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          Skip question
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botón de reproducción - Diseño profesional tipo Cambridge/TOEFL */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 sm:p-8 text-center">
        <button
          onClick={handlePlayAudio}
          disabled={isPlaying}
          className={`inline-flex items-center gap-3 px-8 py-4 rounded-lg font-semibold text-base transition-all ${
            isPlaying
              ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
          }`}
        >
          {isPlaying ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Playing...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>Play audio</span>
            </>
          )}
        </button>
        <p className="text-sm text-slate-600 mt-4 font-medium">
          {isPlaying ? 'Listen carefully' : 'Click to listen'}
        </p>
      </div>

      {/* Opciones - Diseño limpio sin gradientes exagerados */}
      <div className="space-y-3">
        {normalizedOptions.map((option, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedOption(option)}
            className={`
              w-full p-4 sm:p-5 rounded-lg border-2 transition-all text-left font-medium
              ${selectedOption === option
                ? 'border-purple-600 bg-purple-50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                ${selectedOption === option
                  ? 'border-purple-600 bg-purple-600'
                  : 'border-slate-300'
                }
              `}>
                {selectedOption === option && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
              <span className="text-slate-800 text-base">{option}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Botón verificar - Sin gradientes */}
      <button
        onClick={handleCheck}
        disabled={!selectedOption}
        className={`
          w-full px-6 py-4 rounded-lg font-semibold text-lg transition-all
          ${selectedOption
            ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white hover:shadow-lg shadow-md'
            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }
        `}
      >
        {isLastQuestion ? 'Finalizar prueba' : 'Siguiente pregunta'}
      </button>
    </div>
  );
};

export default ListeningExercise;