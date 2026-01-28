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
  console.error('❌ Error: Variables de entorno no encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔧 Corrección completa de preguntas problemáticas...\n');

async function fixComplete() {
  // 1. Corregir TODAS las preguntas de listening SIN opciones
  console.log('📊 Paso 1: Buscando preguntas de listening sin opciones...\n');

  const { data: listeningQuestions, error: error1 } = await supabase
    .from('diagnostic_questions')
    .select('*')
    .eq('exercise_type', 'listening')
    .or('options.is.null,options.eq.[]');

  if (error1) {
    console.error('❌ Error:', error1);
    return;
  }

  console.log(`✅ Encontradas ${listeningQuestions.length} preguntas de listening sin opciones\n`);

  let listeningFixed = 0;
  for (const q of listeningQuestions) {
    const { error } = await supabase
      .from('diagnostic_questions')
      .update({
        exercise_type: 'speaking',
        question: q.correct_answer,
        audio_text: q.question
      })
      .eq('id', q.id);

    if (error) {
      console.error(`❌ Error en ${q.id.substring(0, 8)}:`, error.message);
    } else {
      console.log(`✅ [${q.level}] ${q.id.substring(0, 8)}: listening → speaking`);
      listeningFixed++;
    }
  }

  // 2. Corregir preguntas de word_order que NO tienen "Order these words" como pregunta
  console.log('\n📊 Paso 2: Buscando preguntas de word_order mal formadas...\n');

  const { data: wordOrderQuestions, error: error2 } = await supabase
    .from('diagnostic_questions')
    .select('*')
    .eq('exercise_type', 'word_order')
    .neq('question', 'Order these words to form a sentence');

  if (error2) {
    console.error('❌ Error:', error2);
    return;
  }

  console.log(`✅ Encontradas ${wordOrderQuestions.length} preguntas de word_order mal formadas\n`);

  let wordOrderFixed = 0;
  for (const q of wordOrderQuestions) {
    const { error } = await supabase
      .from('diagnostic_questions')
      .update({
        audio_text: q.question,
        question: 'Order these words to form a sentence'
      })
      .eq('id', q.id);

    if (error) {
      console.error(`❌ Error en ${q.id.substring(0, 8)}:`, error.message);
    } else {
      console.log(`✅ [${q.level}] ${q.id.substring(0, 8)}: word_order corregido`);
      wordOrderFixed++;
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📊 RESUMEN FINAL');
  console.log('═══════════════════════════════════════');
  console.log(`Listening → Speaking: ${listeningFixed} corregidas`);
  console.log(`Word Order: ${wordOrderFixed} corregidas`);
  console.log(`Total: ${listeningFixed + wordOrderFixed} preguntas corregidas`);
  console.log('═══════════════════════════════════════\n');
}

fixComplete();
