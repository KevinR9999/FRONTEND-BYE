import { supabase } from "../lib/supabaseClient";

export type Level = 'A1' | 'A2' | 'B1' | 'B2';

interface DiagnosticQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  exercise_type?: string;
  skill?: string;
  level?: Level;
  audio_text?: string;
  image_url?: string;
}

interface UserAnswer {
  questionId: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  exerciseType: string;
}

// 🎲 Función shuffle con Fisher-Yates
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const diagnosticService = {
  async getQuestions(): Promise<DiagnosticQuestion[]> {
    const { data, error } = await supabase
      .from('diagnostic_questions')
      .select('*');

    if (error) {
      console.error("❌ Error fetching questions:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn("⚠️ No hay preguntas en la base de datos");
      return [];
    }

    const parsedQuestions = data.map((row: any) => {
      const options = Array.isArray(row.options) ? row.options : [];

      return {
        id: row.id,
        question: row.question,
        options: options,
        correct_answer: row.correct_answer,
        exercise_type: row.exercise_type || 'multiple_choice',
        skill: row.skill || 'reading',
        level: row.level as Level,
        audio_text: row.audio_text || null,
        image_url: row.image_url || null
      };
    });

    // Distribución por nivel: 13 A1, 13 A2, 12 B1, 12 B2 = 50 preguntas total
    const questionsPerLevel: Record<Level, number> = {
      'A1': 13,
      'A2': 13,
      'B1': 12,
      'B2': 12
    };

    const levels: Level[] = ['A1', 'A2', 'B1', 'B2'];
    const selectedQuestions: DiagnosticQuestion[] = [];
    const usedQuestionIds = new Set<string>();
    const usedAnswers = new Set<string>(); // Evitar respuestas repetidas

    for (const level of levels) {
      const questionsOfLevel = parsedQuestions.filter(q => q.level === level);

      if (questionsOfLevel.length === 0) {
        console.warn(`⚠️ No hay preguntas de nivel: ${level}`);
        continue;
      }

      // Agrupar por tipo de ejercicio
      const exerciseTypes = ['multiple_choice', 'fill_blank', 'speaking', 'listening', 'word_order'];
      const questionsByType: Record<string, DiagnosticQuestion[]> = {};

      exerciseTypes.forEach(type => {
        questionsByType[type] = questionsOfLevel.filter(q => q.exercise_type === type);
      });

      const needed = questionsPerLevel[level];
      const questionsPerType = Math.floor(needed / exerciseTypes.length); // Base para cada tipo
      const remainder = needed % exerciseTypes.length; // Preguntas extra

      let selected = 0;

      // Distribuir preguntas balanceadamente por tipo
      for (let i = 0; i < exerciseTypes.length; i++) {
        const type = exerciseTypes[i];
        const availableQuestions = shuffleArray(questionsByType[type]);

        // Calcular cuántas preguntas de este tipo necesitamos
        const targetForType = questionsPerType + (i < remainder ? 1 : 0);
        let selectedOfType = 0;

        for (const question of availableQuestions) {
          if (selectedOfType >= targetForType || selected >= needed) break;

          const answerKey = `${question.correct_answer.toLowerCase().trim()}`;

          // Evitar tanto IDs como respuestas repetidas
          if (!usedQuestionIds.has(question.id) && !usedAnswers.has(answerKey)) {
            selectedQuestions.push(question);
            usedQuestionIds.add(question.id);
            usedAnswers.add(answerKey);
            selected++;
            selectedOfType++;
          }
        }
      }

      // Si aún faltan preguntas (porque algún tipo no tenía suficientes),
      // completar con preguntas aleatorias del nivel
      if (selected < needed) {
        const shuffled = shuffleArray(questionsOfLevel);
        for (const question of shuffled) {
          if (selected >= needed) break;

          const answerKey = `${question.correct_answer.toLowerCase().trim()}`;

          // Evitar tanto IDs como respuestas repetidas
          if (!usedQuestionIds.has(question.id) && !usedAnswers.has(answerKey)) {
            selectedQuestions.push(question);
            usedQuestionIds.add(question.id);
            usedAnswers.add(answerKey);
            selected++;
          }
        }
      }

      if (selected < needed) {
        console.warn(`⚠️ Solo se encontraron ${selected} de ${needed} preguntas para nivel ${level}`);
      }
    }

    // Mezclar todas las preguntas seleccionadas en orden aleatorio
    const finalShuffled = shuffleArray(selectedQuestions);

    // Calcular distribución por nivel y por tipo
    const exerciseTypes = ['multiple_choice', 'fill_blank', 'speaking', 'listening', 'word_order'];
    const distributionByLevel = levels.map(level => {
      const questionsOfLevel = finalShuffled.filter(q => q.level === level);
      const byType: Record<string, number> = {};

      exerciseTypes.forEach(type => {
        byType[type] = questionsOfLevel.filter(q => q.exercise_type === type).length;
      });

      return {
        nivel: level,
        total: questionsOfLevel.length,
        requerido: questionsPerLevel[level],
        porTipo: byType
      };
    });

    console.log('📊 Preguntas seleccionadas para prueba diagnóstica:', {
      total: finalShuffled.length,
      distribucion: distributionByLevel,
      timestamp: new Date().toISOString()
    });

    return finalShuffled;
  },

  calculateLevel(correctAnswers: number, totalQuestions: number): Level {
    const percentage = (correctAnswers / totalQuestions) * 100;

    if (percentage >= 80) return 'B2';
    if (percentage >= 60) return 'B1';
    if (percentage >= 40) return 'A2';
    return 'A1';
  },

  // ✅ FUNCIÓN ACTUALIZADA: Ahora acepta userAnswers
  async saveResult(
    userId: string, 
    correctAnswers: number, 
    totalQuestions: number,
    userAnswers?: UserAnswer[] // ← NUEVO PARÁMETRO
  ): Promise<Level> {
    const level = this.calculateLevel(correctAnswers, totalQuestions);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("❌ Error obteniendo usuario:", userError);
        throw userError;
      }

      const userName = userData.user?.user_metadata?.full_name || 
                       userData.user?.user_metadata?.name || 
                       userData.user?.email?.split('@')[0] || 
                       'Usuario';
      
      const userEmail = userData.user?.email || '';

      console.log('📝 Guardando resultado:', { userName, userEmail, level, correctAnswers });

      // 1. ✅ Guardar resultado y obtener el ID
      const { data: resultData, error: resultError } = await supabase
        .from('diagnostic_results')
        .insert({
          user_id: userId,
          correct_answers: correctAnswers,
          level: level,
          user_name: userName,
          user_email: userEmail
        })
        .select('id')
        .single();

      if (resultError) {
        console.error("❌ Error guardando resultado:", resultError);
        throw resultError;
      }

      const resultId = resultData.id;
      console.log('✅ Resultado guardado con ID:', resultId);

      // 2. ✅ Guardar respuestas detalladas
      if (userAnswers && userAnswers.length > 0) {
        const answersToInsert = userAnswers.map(answer => ({
          result_id: resultId,
          user_id: userId,
          question_id: answer.questionId,
          question_text: answer.questionText,
          user_answer: answer.userAnswer || '',
          correct_answer: answer.correctAnswer,
          is_correct: answer.isCorrect,
          exercise_type: answer.exerciseType
        }));

        const { error: answersError } = await supabase
          .from('diagnostic_user_answers')
          .insert(answersToInsert);

        if (answersError) {
          console.error("❌ Error guardando respuestas:", answersError);
          // No lanzar error, solo loggearlo
        } else {
          console.log(`✅ Guardadas ${answersToInsert.length} respuestas detalladas`);
        }
      }

      // 3. ✅ Actualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          level: level,
          diagnostic_completed: true
        })
        .eq('user_id', userId);

      if (profileError) {
        console.error("❌ Error actualizando perfil:", profileError);
        throw profileError;
      }

      console.log('✅ Resultado completo guardado exitosamente');

      return level;
    } catch (error) {
      console.error("❌ Error en saveResult:", error);
      throw error;
    }
  },

  async hasCompletedTest(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('diagnostic_completed')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error("❌ Error checking diagnostic:", error);
        return false;
      }

      return data?.diagnostic_completed ?? false;
    } catch (error) {
      console.error("❌ Error in hasCompletedTest:", error);
      return false;
    }
  }
};