import { supabase } from "../lib/supabaseClient";

export type Level = 'A1' | 'A2' | 'B1' | 'B2';

interface DiagnosticQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  exercise_type?: string;
  skill?: string;
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
        audio_text: row.audio_text || null,
        image_url: row.image_url || null
      };
    });

    const exerciseTypes = [
      'multiple_choice',
      'listening', 
      'speaking',
      'fill_blank',
      'word_order',
      'reading'
    ];

    const questionsPerType = 5;
    const balancedQuestions: DiagnosticQuestion[] = [];

    for (const type of exerciseTypes) {
      const questionsOfType = parsedQuestions.filter(q => q.exercise_type === type);
      
      if (questionsOfType.length === 0) {
        console.warn(`⚠️ No hay preguntas de tipo: ${type}`);
        continue;
      }

      const shuffled = shuffleArray(questionsOfType);
      const selected = shuffled.slice(0, questionsPerType);
      
      balancedQuestions.push(...selected);
    }

    if (balancedQuestions.length < 30) {
      const remaining = parsedQuestions
        .filter(q => !balancedQuestions.find(b => b.id === q.id));
      
      const shuffledRemaining = shuffleArray(remaining);
      const needed = shuffledRemaining.slice(0, 30 - balancedQuestions.length);
      
      balancedQuestions.push(...needed);
    }

    const finalShuffled = shuffleArray(balancedQuestions);
    
    console.log('📊 Preguntas seleccionadas:', {
      total: finalShuffled.length,
      tipos: exerciseTypes.map(type => ({
        tipo: type,
        cantidad: finalShuffled.filter(q => q.exercise_type === type).length
      })),
      timestamp: new Date().toISOString()
    });

    return finalShuffled.slice(0, 30);
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