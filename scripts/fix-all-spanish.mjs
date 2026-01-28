import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔧 Buscando y corrigiendo TODAS las preguntas en español...\n');

async function fixAll() {
  // Obtener todas las preguntas
  const { data: questions, error } = await supabase
    .from('diagnostic_questions')
    .select('*')
    .order('level', { ascending: true });

  if (error) {
    console.error('❌ Error al obtener preguntas:', error);
    return;
  }

  console.log(`📊 Total de preguntas: ${questions.length}\n`);

  let listeningFixed = 0;
  let wordOrderFixed = 0;
  let errors = 0;

  // Detectar español por acentos, ñ, o patrones comunes
  const spanishPattern = /[áéíóúñü]|estoy|soy|está|son|ellos|ellas|nosotros|vamos|hemos|tengo|tiene|bebo|como|años|mañana|trabajo|escuela|amigos|mejor|peor/i;

  for (const q of questions) {
    const questionText = q.question || '';
    const hasSpanish = spanishPattern.test(questionText);

    if (!hasSpanish) continue;

    // Listening sin opciones -> convertir a speaking
    if (q.exercise_type === 'listening' && (!q.options || q.options.length === 0)) {
      try {
        const { error } = await supabase
          .from('diagnostic_questions')
          .update({
            exercise_type: 'speaking',
            question: q.correct_answer,
            audio_text: q.question
          })
          .eq('id', q.id);

        if (error) {
          console.error(`❌ Error en listening ${q.id}:`, error.message);
          errors++;
        } else {
          console.log(`✅ [${q.level}] Listening: "${q.question.substring(0, 40)}..." → "${q.correct_answer.substring(0, 40)}..."`);
          listeningFixed++;
        }
      } catch (err) {
        console.error(`❌ Error en ${q.id}:`, err.message);
        errors++;
      }
    }

    // Word order con español
    if (q.exercise_type === 'word_order') {
      try {
        const { error } = await supabase
          .from('diagnostic_questions')
          .update({
            audio_text: q.question,
            question: 'Order these words to form a sentence'
          })
          .eq('id', q.id);

        if (error) {
          console.error(`❌ Error en word_order ${q.id}:`, error.message);
          errors++;
        } else {
          console.log(`✅ [${q.level}] Word Order: "${q.question.substring(0, 40)}..."`);
          wordOrderFixed++;
        }
      } catch (err) {
        console.error(`❌ Error en ${q.id}:`, err.message);
        errors++;
      }
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 RESUMEN FINAL');
  console.log('═══════════════════════════════════════');
  console.log(`Listening: ${listeningFixed} corregidas`);
  console.log(`Word Order: ${wordOrderFixed} corregidas`);
  console.log(`Errores: ${errors}`);
  console.log(`Total: ${listeningFixed + wordOrderFixed} preguntas corregidas`);
  console.log('═══════════════════════════════════════\n');
}

fixAll();
