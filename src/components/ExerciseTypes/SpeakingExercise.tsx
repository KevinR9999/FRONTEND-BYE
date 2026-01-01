import { useState } from 'react';

interface SpeakingExerciseProps {
  question: string;
  audioText: string;
  correctAnswer: string;
  isLastQuestion?: boolean; 
  onAnswer: (isCorrect: boolean, userAnswer?: string) => void;
}

export default function SpeakingExercise({
  correctAnswer,
  isLastQuestion = false, 
  onAnswer
}: SpeakingExerciseProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [showContinueButton, setShowContinueButton] = useState(false);

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
    const transcribedWords = transcribedText.toLowerCase().trim().split(/\s+/);
    const correctWords = correctText.toLowerCase().trim().split(/\s+/);
    
    let correctCount = 0;
    
    for (let i = 0; i < correctWords.length; i++) {
      const correctWord = correctWords[i];
      const transcribedWord = transcribedWords[i] || '';
      
      const similarity = calculateSimilarity(transcribedWord, correctWord);
      if (similarity >= 0.8) {
        correctCount++;
      }
    }
    
    const percentage = correctCount / correctWords.length;
    return percentage >= 0.7;
  }

  async function startRecording() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();

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

      for (let i = 0; i < Math.min(event.results[0].length, 5); i++) {
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

      const isPassed = evaluatePronunciation(transcript, correct);

      setIsCorrect(isPassed);
      setUserTranscript(transcript);
      setHasRecorded(true);
      setIsRecording(false);
      
      //  Mostrar botón después de 500ms
      setTimeout(() => {
        setShowContinueButton(true);
      }, 500);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      
      if (event.error === 'no-speech') {
        alert('No detecté ninguna voz. Intenta de nuevo y habla más fuerte.');
      } else if (event.error === 'audio-capture') {
        alert('No se detectó micrófono. Verifica que esté conectado y con permisos.');
      } else if (event.error === 'not-allowed') {
        alert('Permisos de micrófono denegados. Actívalos en la configuración del navegador.');
      } else {
        alert('Error al grabar. Intenta de nuevo.');
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
      alert('Error al iniciar el reconocimiento de voz.');
      setIsRecording(false);
    }
  }

  function handleContinue() {
    onAnswer(isCorrect, userTranscript);
  }

  return (
    <div className="space-y-6">
      
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-fuchsia-50 border-2 border-indigo-200 rounded-2xl p-6 text-center">
        <p className="text-sm text-indigo-700 font-medium mb-3">
          Presiona el botón y di la oración en voz alta
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
                <span>Escuchando...</span>
              </>
            ) : hasRecorded ? (
              <>
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Grabación completada</span>
              </>
            ) : (
              <>
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                <span>Presiona para grabar</span>
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
            <p className="text-sm text-red-700 font-semibold">Grabando tu voz...</p>
          </div>
        </div>
      )}

      {!hasRecorded && !isRecording && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-700 text-center">
            💡 <strong>Consejo:</strong> Habla claro y con buen volumen para mejor reconocimiento
          </p>
        </div>
      )}

      {hasRecorded && !showContinueButton && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-indigo-700 font-semibold">
              Evaluando tu pronunciación...
            </p>
          </div>
        </div>
      )}

      {/*  BOTÓN CONTINUAR/FINALIZAR */}
      {showContinueButton && (
        <button
          onClick={handleContinue}
          className="w-full px-8 py-4 rounded-2xl font-bold text-lg transition-all bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02]"
        >
          {isLastQuestion ? '✓ Finalizar prueba' : 'siguiente pregunta →'}
        </button>
      )}
    </div>
  );
}