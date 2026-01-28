import { useState } from 'react';

interface SpeakingExerciseProps {
  question: string;
  audioText: string;
  correctAnswer: string;
  isLastQuestion?: boolean;
  showTranslatePrompt?: boolean;
  onAnswer: (isCorrect: boolean, userAnswer?: string) => void;
}

export default function SpeakingExercise({
  question,
  correctAnswer,
  isLastQuestion = false,
  showTranslatePrompt = false,
  onAnswer
}: SpeakingExerciseProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  function calculateSimilarity(word1: string, word2: string): number {
    const distance = levenshteinDistance(word1.toLowerCase(), word2.toLowerCase());
    const maxLength = Math.max(word1.length, word2.length);
    return 1 - (distance / maxLength);
  }

  function evaluatePronunciation(transcribedText: string, correctText: string): boolean {
    // Normalizar texto: quitar puntuación y convertir a minúsculas
    const normalize = (text: string) => text.toLowerCase().replace(/[.,!?;:'"()-]/g, '').trim();

    const transcribedWords = normalize(transcribedText).split(/\s+/).filter(w => w.length > 0);
    const correctWords = normalize(correctText).split(/\s+/).filter(w => w.length > 0);

    if (transcribedWords.length === 0) return false;

    let correctCount = 0;

    // Buscar cada palabra correcta en las transcritas (no importa el orden exacto)
    for (const correctWord of correctWords) {
      // Buscar la mejor coincidencia en las palabras transcritas
      let bestMatch = 0;
      for (const transcribedWord of transcribedWords) {
        const similarity = calculateSimilarity(transcribedWord, correctWord);
        bestMatch = Math.max(bestMatch, similarity);
      }

      // Umbral más flexible: 0.6 en lugar de 0.8
      if (bestMatch >= 0.6) {
        correctCount++;
      }
    }

    const percentage = correctCount / correctWords.length;
    console.log(`📊 Evaluación: ${correctCount}/${correctWords.length} palabras (${(percentage * 100).toFixed(0)}%)`);

    // Umbral más flexible: 50% en lugar de 70%
    return percentage >= 0.5;
  }

  async function startRecording() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Your browser does not support voice recognition. Use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    // Configuración estricta para inglés solamente
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let bestTranscript = event.results[0][0].transcript;
      let bestConfidence = event.results[0][0].confidence;

      // Buscar la mejor alternativa entre las disponibles
      for (let i = 1; i < Math.min(event.results[0].length, 5); i++) {
        const alternative = event.results[0][i];
        if (alternative.confidence > bestConfidence) {
          bestTranscript = alternative.transcript;
          bestConfidence = alternative.confidence;
        }
      }

      const transcript = bestTranscript.trim();
      const correct = correctAnswer.trim();

      console.log('🎤 Transcrito:', transcript);
      console.log('✅ Esperado:', correct);
      console.log('📊 Confianza:', bestConfidence);
      console.log('🌐 Es traducción?', showTranslatePrompt);

      const transcriptLower = transcript.toLowerCase();
      const correctLower = correct.toLowerCase();

      // Si es un ejercicio de TRADUCCIÓN, ser MÁS ESTRICTO
      if (showTranslatePrompt) {
        // Lista ampliada de palabras comunes en español
        const spanishWords = [
          // Verbos comunes
          'es', 'está', 'estoy', 'son', 'soy', 'he', 'ha', 'han', 'hay',
          'tiene', 'tienes', 'tengo', 'está', 'estaba', 'estoy',
          'vivido', 'vivir', 'vive', 'vivo',
          // Preposiciones y palabras comunes
          'por', 'para', 'con', 'sin', 'sobre', 'bajo',
          'aquí', 'ahí', 'allí', 'allá',
          'dos', 'tres', 'años', 'días', 'meses',
          'él', 'ella', 'ellos', 'ellas', 'nosotros',
          'mi', 'tu', 'su', 'nuestro',
          // Otras palabras detectables
          'hacer', 'mismo', 'trabajo', 'casa', 'familia',
          'cansada', 'cansado', 'feliz', 'triste',
          'hola', 'gracias', 'buenos', 'buenas'
        ];

        // Verificar si contiene palabras en español
        const transcriptWords = transcriptLower.split(/\s+/);
        const containsSpanish = transcriptWords.some((word: string) =>
          spanishWords.includes(word.replace(/[.,!?;:'"()-]/g, ''))
        );

        if (containsSpanish) {
          console.log('❌ Detectado español en ejercicio de traducción');
          setIsCorrect(false);
          setUserTranscript(transcript);
          setErrorMessage('You must speak in ENGLISH, not in Spanish');
          setHasRecorded(true);
          setIsRecording(false);
          setTimeout(() => {
            setShowContinueButton(true);
          }, 500);
          return;
        }

        // Verificar que al menos contenga ALGUNA palabra del texto esperado
        const correctWords = correctLower.split(/\s+/).filter((w: string) => w.length > 2);
        const hasAnyCorrectWord = correctWords.some((word: string) =>
          transcriptLower.includes(word) ||
          calculateSimilarity(transcriptLower, word) > 0.7
        );

        if (!hasAnyCorrectWord) {
          console.log('❌ No se detectó ninguna palabra del inglés esperado');
          setIsCorrect(false);
          setUserTranscript(transcript);
          setErrorMessage('English words not detected. Try again');
          setHasRecorded(true);
          setIsRecording(false);
          setTimeout(() => {
            setShowContinueButton(true);
          }, 500);
          return;
        }
      }

      // Evaluar pronunciación
      const isPassed = evaluatePronunciation(transcript, correct);

      setIsCorrect(isPassed);
      setUserTranscript(transcript);
      setErrorMessage('');
      setHasRecorded(true);
      setIsRecording(false);

      // Mostrar botón después de 500ms
      setTimeout(() => {
        setShowContinueButton(true);
      }, 500);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      
      if (event.error === 'no-speech') {
        alert('No voice detected. Try again and speak louder.');
      } else if (event.error === 'audio-capture') {
        alert('No microphone detected. Check that it is connected and has permissions.');
      } else if (event.error === 'not-allowed') {
        alert('Microphone permissions denied. Enable them in browser settings.');
      } else {
        alert('Recording error. Try again.');
      }
      
      setHasRecorded(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      alert('Error starting voice recognition.');
      setIsRecording(false);
    }
  }

  function handleContinue() {
    onAnswer(isCorrect, userTranscript);
  }

  function handleSkip() {
    // Marcar como incorrecta y continuar
    onAnswer(false, 'Pregunta omitida');
  }

  return (
    <div className="space-y-6">

      {/* Frase a repetir o traducir */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-6">
        <p className="text-sm text-indigo-700 font-semibold mb-3 text-center">
          {showTranslatePrompt ? 'Translate this sentence to English:' : 'Repeat this sentence out loud:'}
        </p>
        <p className="text-2xl sm:text-3xl font-bold text-[#5B5FC7] text-center leading-relaxed">
          "{showTranslatePrompt ? question : correctAnswer}"
        </p>
      </div>

      <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 text-center">
        <p className="text-sm text-slate-600 font-medium mb-4">
          💡 Press the button and speak clearly
        </p>
        <div className="flex justify-center">
          <button
            onClick={startRecording}
            disabled={isRecording || hasRecorded}
            className={`inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-xl transition-all shadow-xl ${
              isRecording
                ? 'bg-red-600 text-white animate-pulse cursor-not-allowed'
                : hasRecorded
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white hover:shadow-2xl hover:scale-105'
            }`}
          >
            {isRecording ? (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-full animate-ping absolute"></div>
                  <div className="w-4 h-4 bg-white rounded-full"></div>
                </div>
                <span>Listening...</span>
              </>
            ) : hasRecorded ? (
              <>
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Recording completed</span>
              </>
            ) : (
              <>
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                <span>Press to record</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isRecording && (
        <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-300 rounded-xl p-4 animate-pulse">
          <div className="flex items-center justify-center gap-3">
            <div className="flex gap-1">
              <div className="w-1 bg-red-500 rounded-full animate-bounce" style={{ height: '20px', animationDelay: '0s' }}></div>
              <div className="w-1 bg-red-500 rounded-full animate-bounce" style={{ height: '28px', animationDelay: '0.1s' }}></div>
              <div className="w-1 bg-red-500 rounded-full animate-bounce" style={{ height: '24px', animationDelay: '0.2s' }}></div>
              <div className="w-1 bg-red-500 rounded-full animate-bounce" style={{ height: '32px', animationDelay: '0.3s' }}></div>
              <div className="w-1 bg-red-500 rounded-full animate-bounce" style={{ height: '20px', animationDelay: '0.4s' }}></div>
            </div>
            <p className="text-sm text-red-700 font-semibold">Recording your voice...</p>
          </div>
        </div>
      )}

      {!hasRecorded && !isRecording && (
        <button
          onClick={handleSkip}
          className="w-full px-8 py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-[10px] font-bold text-base transition-all hover:bg-gray-50 hover:border-gray-400 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 min-h-[52px]"
        >
          Skip
        </button>
      )}

      {hasRecorded && !showContinueButton && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-indigo-700 font-semibold">
              Evaluating your pronunciation...
            </p>
          </div>
        </div>
      )}

      {/* MENSAJE DE ERROR - Hablaste en español */}
      {showContinueButton && errorMessage && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
          <div className="flex flex-col items-center gap-3 py-3">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-xl text-red-800 font-bold">{errorMessage}</p>
            </div>
            <p className="text-sm text-red-700">You must speak in English to continue.</p>

            {/* Botones: Grabar de nuevo o Omitir */}
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => {
                  setHasRecorded(false);
                  setShowContinueButton(false);
                  setErrorMessage('');
                  setUserTranscript('');
                }}
                className="flex-1 px-6 py-3 rounded-xl font-semibold text-base transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
              >
                🎤 Record again
              </button>

              <button
                onClick={handleSkip}
                className="flex-1 px-6 py-3 rounded-xl font-semibold text-base transition-all bg-white border-2 border-red-400 text-red-700 hover:bg-red-50"
              >
                ⏭️ Skip question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTÓN CONTINUAR CON MENSAJE DE ÉXITO */}
      {showContinueButton && !errorMessage && (
        <div className="space-y-3">
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3">
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-base text-green-700 font-bold">Great job!</p>
            </div>
          </div>

          <button
            onClick={handleContinue}
            className="w-full px-8 py-4 rounded-[10px] font-bold text-base transition-all min-h-[52px] bg-gradient-to-br from-[#5B5FC7] to-[#4A4FA8] text-white shadow-[0_4px_12px_rgba(91,95,199,0.25)] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(91,95,199,0.3)] active:translate-y-0"
          >
            {isLastQuestion ? 'Finish Test' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
}