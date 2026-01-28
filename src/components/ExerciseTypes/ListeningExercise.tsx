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
  const [voicesLoaded, setVoicesLoaded] = useState(false);

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

      // Esperar a que las voces se carguen
      const loadVoices = () => {
        const voices = synthRef.current?.getVoices() || [];
        if (voices.length > 0) {
          setVoicesLoaded(true);
          console.log('✅ Voces cargadas:', voices.filter(v => v.lang.startsWith('en')).length, 'voces en inglés disponibles');
        }
      };

      // Las voces pueden cargarse de forma asíncrona
      loadVoices();

      if (synthRef.current.onvoiceschanged !== undefined) {
        synthRef.current.onvoiceschanged = loadVoices;
      }
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

    // Esperar a que las voces estén cargadas
    if (!voicesLoaded) {
      console.warn('⏳ Esperando a que las voces se carguen...');
      setTimeout(() => speakText(text), 200);
      return;
    }

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85; // Velocidad mejorada para mejor claridad
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Buscar la mejor voz disponible en orden de preferencia mejorado
    const voices = synthRef.current.getVoices();

    console.log('🎤 Seleccionando voz. Voces disponibles:', voices.length);

    // Prioridad mejorada: voces Premium/Neural/Natural en inglés US
    const preferredVoice =
      // 1. Voces Premium/Neural/Enhanced (mejor calidad)
      voices.find(voice =>
        voice.lang === 'en-US' &&
        (voice.name.includes('Premium') ||
         voice.name.includes('Neural') ||
         voice.name.includes('Enhanced') ||
         voice.name.includes('Natural'))
      ) ||
      // 2. Voces de Google en la nube (alta calidad)
      voices.find(voice =>
        voice.lang === 'en-US' &&
        voice.name.includes('Google') &&
        voice.localService === false
      ) ||
      // 3. Voces de Microsoft (buena calidad)
      voices.find(voice =>
        voice.lang === 'en-US' &&
        voice.name.includes('Microsoft') &&
        (voice.name.includes('Zira') || voice.name.includes('David'))
      ) ||
      // 4. Cualquier voz en la nube en-US
      voices.find(voice =>
        voice.lang === 'en-US' &&
        voice.localService === false
      ) ||
      // 5. Cualquier voz en-US local
      voices.find(voice =>
        voice.lang === 'en-US'
      ) ||
      // 6. Voces en inglés variantes (en-GB, en-AU, etc.)
      voices.find(voice =>
        voice.lang.startsWith('en-')
      ) ||
      // 7. Cualquier voz en inglés
      voices.find(voice =>
        voice.lang.startsWith('en')
      );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      console.log('✅ Voz seleccionada:', {
        name: preferredVoice.name,
        lang: preferredVoice.lang,
        localService: preferredVoice.localService
      });
    } else {
      console.warn('⚠️ No se encontró voz preferida, usando voz por defecto');
    }

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = (event) => {
      console.error('❌ Error en síntesis de voz:', event);
      setIsPlaying(false);
      alert('Error al reproducir el audio. Por favor, inténtalo de nuevo.');
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
          disabled={isPlaying || !voicesLoaded}
          className={`inline-flex items-center gap-3 px-8 py-4 rounded-lg font-semibold text-base transition-all ${
            isPlaying || !voicesLoaded
              ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
          }`}
        >
          {!voicesLoaded ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Loading voices...</span>
            </>
          ) : isPlaying ? (
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
          {!voicesLoaded ? 'Preparing audio...' : isPlaying ? 'Listen carefully' : 'Click to listen'}
        </p>
      </div>

      {/* Opciones mejoradas */}
      <div className="max-w-[680px] mx-auto">
        <div className="flex flex-col gap-3">
          {normalizedOptions.map((option, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedOption(option)}
              className={`
                group relative min-h-[64px] px-6 py-5 bg-white border-2 rounded-[10px]
                cursor-pointer transition-all duration-250 flex items-center gap-4 text-left
                ${selectedOption === option
                  ? 'border-[#5B5FC7] bg-[#EEEEFF] font-semibold text-gray-900 shadow-[0_0_0_4px_rgba(91,95,199,0.1)]'
                  : 'border-gray-200 hover:border-[#5B5FC7] hover:bg-gray-50 hover:translate-x-1'
                }
              `}
            >
              {/* Radio button */}
              <div className={`
                relative flex-shrink-0 w-6 h-6 rounded-full border-[2.5px] transition-all
                ${selectedOption === option
                  ? 'border-[#5B5FC7] bg-white'
                  : 'border-gray-300 group-hover:border-[#5B5FC7] group-hover:scale-110'
                }
              `}>
                {selectedOption === option && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#5B5FC7] rounded-full animate-[radioScale_0.2s_ease-out_forwards]" />
                )}
              </div>

              {/* Texto de la opción */}
              <span className={`text-base leading-[1.5] ${selectedOption === option ? 'text-gray-900' : 'text-gray-700'}`}>
                {option}
              </span>
            </button>
          ))}
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
          onClick={handleCheck}
          disabled={!selectedOption}
          className={`
            relative overflow-hidden px-8 py-4 rounded-[10px] font-bold text-base transition-all min-h-[52px]
            ${selectedOption
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
};

export default ListeningExercise;