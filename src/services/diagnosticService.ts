import { supabase } from "../lib/supabaseClient";
import { loadAppSettings } from "./appSettingsService";

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

    // Cargar configuración del admin
    const appSettings = await loadAppSettings();
    const levelDistribution = appSettings.diagnostic_questions_per_level;
    const skillDistribution = appSettings.diagnostic_skill_distribution; // puede ser null
    const levels = Object.keys(levelDistribution) as Level[];
    const exerciseTypes = ['multiple_choice', 'fill_blank', 'speaking', 'listening', 'word_order', 'reading'];

    const selectedQuestions: DiagnosticQuestion[] = [];
    const usedQuestionIds = new Set<string>();

    for (const level of levels) {
      const questionsOfLevel = parsedQuestions.filter(q => q.level === level);

      if (questionsOfLevel.length === 0) {
        console.warn(`⚠️ No hay preguntas de nivel: ${level}`);
        continue;
      }

      // Agrupar por tipo de ejercicio
      const questionsByType: Record<string, DiagnosticQuestion[]> = {};
      exerciseTypes.forEach(type => {
        questionsByType[type] = questionsOfLevel.filter(q => q.exercise_type === type);
      });

      const needed = levelDistribution[level] || 0;

      // Determinar cuántas preguntas por tipo
      let targetsPerType: Record<string, number>;

      if (skillDistribution && skillDistribution[level]) {
        // Distribución manual del admin (por tipo de ejercicio)
        targetsPerType = skillDistribution[level];
      } else {
        // Distribución automática pareja
        targetsPerType = {};
        const perType = Math.floor(needed / exerciseTypes.length);
        const remainder = needed % exerciseTypes.length;
        exerciseTypes.forEach((type, i) => {
          targetsPerType[type] = perType + (i < remainder ? 1 : 0);
        });
      }

      let selected = 0;

      // Seleccionar preguntas según la distribución por tipo
      for (const type of exerciseTypes) {
        const targetForType = targetsPerType[type] || 0;
        const availableQuestions = shuffleArray(questionsByType[type] || []);
        let selectedOfType = 0;

        for (const question of availableQuestions) {
          if (selectedOfType >= targetForType || selected >= needed) break;

          if (!usedQuestionIds.has(question.id)) {
            selectedQuestions.push(question);
            usedQuestionIds.add(question.id);
            selected++;
            selectedOfType++;
          }
        }
      }

      // Si faltan preguntas (algún tipo no tenía suficientes), completar con aleatorias del mismo nivel
      if (selected < needed) {
        const shuffled = shuffleArray(questionsOfLevel);
        for (const question of shuffled) {
          if (selected >= needed) break;

          if (!usedQuestionIds.has(question.id)) {
            selectedQuestions.push(question);
            usedQuestionIds.add(question.id);
            selected++;
          }
        }
      }

      if (selected < needed) {
        console.warn(`⚠️ Solo se encontraron ${selected} de ${needed} preguntas para nivel ${level}. Configura más preguntas de nivel ${level} en Admin > Diagnóstico.`);
      }
    }

    // Mezclar en orden aleatorio
    const finalShuffled = shuffleArray(selectedQuestions);

    // Log de distribución final
    const distributionByLevel = levels.map(level => {
      const questionsOfLevel = finalShuffled.filter(q => q.level === level);
      const byType: Record<string, number> = {};
      exerciseTypes.forEach(type => {
        byType[type] = questionsOfLevel.filter(q => q.exercise_type === type).length;
      });
      return {
        nivel: level,
        total: questionsOfLevel.length,
        requerido: levelDistribution[level] || 0,
        porTipo: byType
      };
    });

    if (import.meta.env.DEV) console.log('Preguntas seleccionadas:', {
      total: finalShuffled.length,
      distribucion: distributionByLevel,
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

      if (import.meta.env.DEV) console.log('Guardando resultado:', { level, correctAnswers });

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
      if (import.meta.env.DEV) console.log('Resultado guardado con ID:', resultId);

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
          if (import.meta.env.DEV) console.log(`Guardadas ${answersToInsert.length} respuestas detalladas`);
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

      // 4. ✅ Desbloquear lecciones de niveles anteriores al asignado
      await this.unlockPreviousLevels(userId, level);

      if (import.meta.env.DEV) console.log('Resultado completo guardado exitosamente');

      return level;
    } catch (error) {
      console.error("❌ Error en saveResult:", error);
      throw error;
    }
  },

  async unlockPreviousLevels(userId: string, assignedLevel: Level): Promise<void> {
    const levelOrder: Level[] = ['A1', 'A2', 'B1', 'B2'];
    const assignedIndex = levelOrder.indexOf(assignedLevel);
    if (assignedIndex <= 0) return; // A1 no necesita desbloquear nada

    const levelsToUnlock = levelOrder.slice(0, assignedIndex); // niveles anteriores

    // Obtener todas las lecciones de esos niveles
    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id')
      .in('level', levelsToUnlock);

    if (lessonsError || !lessons || lessons.length === 0) return;

    // Crear registros de progreso completado para cada lección
    const progressRecords = lessons.map((lesson: { id: string }) => ({
      user_id: userId,
      lesson_id: lesson.id,
      progress: 100,
      completed: true,
      correct_count: 1,
      total_questions: 1,
      xp_earned: 0,
    }));

    await supabase
      .from('lesson_progress')
      .upsert(progressRecords, { onConflict: 'user_id,lesson_id' });
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