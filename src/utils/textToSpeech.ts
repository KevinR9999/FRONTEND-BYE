// src/utils/textToSpeech.ts

export const textToSpeech = {
  /**
   * Reproduce texto usando la voz del navegador
   * @param text - Texto a reproducir
   * @param lang - Idioma (por defecto 'en-US')
   */
  speak: (text: string, lang: string = 'en-US'): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Verificar soporte del navegador
      if (!('speechSynthesis' in window)) {
        reject(new Error('Tu navegador no soporta Text-to-Speech'));
        return;
      }

      // Cancelar cualquier audio previo
      window.speechSynthesis.cancel();

      // Crear utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configuración de voz
      utterance.lang = lang;
      utterance.rate = 0.85; // Velocidad (más lento para aprendizaje)
      utterance.pitch = 1; // Tono normal
      utterance.volume = 1; // Volumen máximo

      // Eventos
      utterance.onend = () => resolve();
      utterance.onerror = (error) => {
        console.error('Error en TTS:', error);
        reject(error);
      };

      // Reproducir
      window.speechSynthesis.speak(utterance);
    });
  },

  /**
   * Detiene cualquier audio en reproducción
   */
  stop: () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  /**
   * Verifica si el navegador soporta TTS
   */
  isSupported: (): boolean => {
    return 'speechSynthesis' in window;
  }
};