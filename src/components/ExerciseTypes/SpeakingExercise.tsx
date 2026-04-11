import { useState, useRef } from 'react';
import { Mic, SkipForward, RotateCcw, CheckCircle2, XCircle } from 'lucide-react';

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
  const [liveTranscript, setLiveTranscript] = useState('');
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const recognitionRef = useRef<any>(null);
  const accumulatedRef = useRef('');
  const interimRef = useRef(''); // último interim por si no hay final
  const isRecordingRef = useRef(false); // ref para evitar stale closure en onend
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
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
    const normalize = (text: string) => text.toLowerCase().replace(/[.,!?;:'"()-]/g, '').trim();
    const transcribedWords = normalize(transcribedText).split(/\s+/).filter(w => w.length > 0);
    const correctWords = normalize(correctText).split(/\s+/).filter(w => w.length > 0);

    if (transcribedWords.length === 0) return false;

    let correctCount = 0;
    for (const correctWord of correctWords) {
      let bestMatch = 0;
      for (const transcribedWord of transcribedWords) {
        const similarity = calculateSimilarity(transcribedWord, correctWord);
        bestMatch = Math.max(bestMatch, similarity);
      }
      if (bestMatch >= 0.6) correctCount++;
    }

    const percentage = correctCount / correctWords.length;
    console.log(`Evaluacion: ${correctCount}/${correctWords.length} palabras (${(percentage * 100).toFixed(0)}%)`);
    return percentage >= 0.5;
  }

  function processResult(transcript: string) {
    const correct = correctAnswer.trim();
    const transcriptLower = transcript.toLowerCase();
    const correctLower = correct.toLowerCase();

    console.log('Transcrito:', transcript);
    console.log('Esperado:', correct);

    if (showTranslatePrompt) {
      const spanishWords = [
        'es', 'está', 'estoy', 'son', 'soy', 'he', 'ha', 'han', 'hay',
        'tiene', 'tienes', 'tengo', 'estaba', 'vivido', 'vivir', 'vive', 'vivo',
        'por', 'para', 'con', 'sin', 'sobre', 'bajo', 'aquí', 'ahí', 'allí',
        'dos', 'tres', 'años', 'días', 'él', 'ella', 'ellos', 'nosotros',
        'mi', 'tu', 'su', 'nuestro', 'hacer', 'mismo', 'trabajo', 'casa',
        'cansada', 'cansado', 'feliz', 'triste', 'hola', 'gracias'
      ];
      const transcriptWords = transcriptLower.split(/\s+/);
      const containsSpanish = transcriptWords.some((word: string) =>
        spanishWords.includes(word.replace(/[.,!?;:'"()-]/g, ''))
      );
      if (containsSpanish) {
        setIsCorrect(false);
        setUserTranscript(transcript);
        setErrorMessage('You must speak in ENGLISH, not in Spanish');
        setHasRecorded(true);
        setIsRecording(false);
        setTimeout(() => setShowContinueButton(true), 500);
        return;
      }

      const correctWords = correctLower.split(/\s+/).filter((w: string) => w.length > 2);
      const hasAnyCorrectWord = correctWords.some((word: string) =>
        transcriptLower.includes(word) || calculateSimilarity(transcriptLower, word) > 0.7
      );
      if (!hasAnyCorrectWord) {
        setIsCorrect(false);
        setUserTranscript(transcript);
        setErrorMessage('English words not detected. Try again');
        setHasRecorded(true);
        setIsRecording(false);
        setTimeout(() => setShowContinueButton(true), 500);
        return;
      }
    }

    const isPassed = evaluatePronunciation(transcript, correct);
    setIsCorrect(isPassed);
    setUserTranscript(transcript);
    setErrorMessage('');
    setHasRecorded(true);
    setIsRecording(false);
    setTimeout(() => setShowContinueButton(true), 500);
  }

  function startRecording() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Your browser does not support voice recognition. Use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.continuous = true; // No se detiene solo

    accumulatedRef.current = '';
    interimRef.current = '';
    setLiveTranscript('');
    setRecordingSeconds(0);

    recognition.onstart = () => {
      isRecordingRef.current = true;
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    };

    recognition.onresult = (event: any) => {
      let finalPart = '';
      let interimPart = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalPart += event.results[i][0].transcript + ' ';
        } else {
          interimPart += event.results[i][0].transcript;
        }
      }

      if (finalPart) {
        accumulatedRef.current += finalPart;
      }
      if (interimPart) {
        interimRef.current = interimPart;
      }
    };

    recognition.onerror = (event: any) => {
      // no-speech es normal, ignorar
      if (event.error !== 'no-speech') {
        console.error('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      // Si sigue grabando (se cortó solo por silencio), reiniciar
      if (isRecordingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // ya está corriendo
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      setIsRecording(false);
    }
  }

  function stopRecording(fromError = false) {
    isRecordingRef.current = false; // primero apagar el flag para que onend no reinicie

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    setIsRecording(false);

    if (fromError) return;

    // Usar texto final acumulado, o el interim como fallback
    const finalText = (accumulatedRef.current + ' ' + interimRef.current).trim();

    if (!finalText) {
      setErrorMessage('No voice detected. Try again and speak louder.');
      setHasRecorded(true);
      setTimeout(() => setShowContinueButton(true), 300);
      return;
    }

    processResult(finalText);
  }

  function handleContinue() {
    onAnswer(isCorrect, userTranscript);
  }

  function handleSkip() {
    if (isRecording) stopRecording(true);
    onAnswer(false, 'Pregunta omitida');
  }

  function handleRetry() {
    if (isRecording) stopRecording(true);
    setHasRecorded(false);
    setShowContinueButton(false);
    setErrorMessage('');
    setUserTranscript('');
    setLiveTranscript('');
    setRecordingSeconds(0);
    accumulatedRef.current = '';
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

      {/* Zona de grabación */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-8 text-center space-y-5">

        {/* Estado: inicial */}
        {!isRecording && !hasRecorded && (
          <>
            <p className="text-sm text-slate-500 font-medium">
              Press the button, speak, then press again to stop
            </p>
            <div className="flex justify-center">
              <button
                onClick={startRecording}
                className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
              >
                <Mic size={26} />
                Press to record
              </button>
            </div>
          </>
        )}

        {/* Estado: grabando */}
        {isRecording && (
          <>
            <p className="text-sm text-red-600 font-semibold animate-pulse">
              Recording... press again when you finish speaking
            </p>
            <div className="flex justify-center">
              <button
                onClick={() => stopRecording()}
                className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold text-xl bg-red-600 text-white hover:bg-red-700 scale-105 shadow-xl transition-all"
              >
                <div className="relative flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-full animate-ping absolute"></div>
                  <div className="w-4 h-4 bg-white rounded-full"></div>
                </div>
                Stop ({recordingSeconds}s)
              </button>
            </div>
          </>
        )}

        {/* Estado: procesando */}
        {hasRecorded && !showContinueButton && (
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-indigo-700 font-semibold">Evaluating your pronunciation...</p>
          </div>
        )}

        {/* Estado: error */}
        {showContinueButton && errorMessage && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-red-700">
              <XCircle size={22} />
              <p className="font-bold text-base">{errorMessage}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 px-5 py-3 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <Mic size={15} />
                Record again
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 px-5 py-3 rounded-xl font-semibold text-sm bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-all"
              >
                <SkipForward size={15} />
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Estado: éxito */}
        {showContinueButton && !errorMessage && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-green-700">
              <CheckCircle2 size={22} />
              <p className="font-bold text-base">{isCorrect ? 'Great job!' : 'Recorded!'}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 px-5 py-3 rounded-xl font-semibold text-sm bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw size={15} />
                Try again
              </button>
              <button
                onClick={handleContinue}
                className="flex-1 px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-br from-[#5B5FC7] to-[#4A4FA8] text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                {isLastQuestion ? 'Finish Test' : 'Continue'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Skip siempre visible (solo cuando no está en resultado) */}
      {!hasRecorded && (
        <button
          onClick={handleSkip}
          className="w-full px-8 py-4 bg-white text-gray-600 border-2 border-gray-200 rounded-[10px] font-semibold text-base transition-all hover:bg-gray-50 hover:border-gray-300 min-h-[52px]"
        >
          Skip
        </button>
      )}
    </div>
  );
}
