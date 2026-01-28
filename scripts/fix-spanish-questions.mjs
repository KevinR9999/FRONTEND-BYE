import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔧 Iniciando corrección de preguntas en español...\n');

async function identifyProblems() {
  console.log('📊 Paso 1: Identificando preguntas problemáticas...\n');

  // Obtener todas las preguntas
  const { data: questions, error } = await supabase
    .from('diagnostic_questions')
    .select('*')
    .order('level', { ascending: true });

  if (error) {
    console.error('❌ Error al obtener preguntas:', error);
    return null;
  }

  // Palabras clave en español (más completas)
  const spanishKeywords = [
    'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas',
    'comemos', 'cantamos', 'bebemos', 'vivimos', 'trabajamos',
    'estudia', 'dice', 'tiene', 'está', 'son', 'eres', 'soy', 'estoy',
    'tengo', 'bebo', 'como', 'corro', 'bailo', 'escribo',
    'cocino', 'viajo', 'compro', 'dijo', 'vendría', 'mañana',
    'había', 'hubiera', 'sabido', 'habría', 'actuado', 'diferente',
    'aprobó', 'obtuvo', 'mejor', 'nota', 'mis', 'nuestros', 'sus',
    'estaba', 'estaban', 'vamos', 'iremos', 'fuimos', 'hemos',
    'han', 'había', 'habían', 'será', 'serán', 'eran', 'fueron',
    'hace', 'desde', 'hasta', 'durante', 'siempre', 'nunca',
    'acostumbrado', 'levantarme', 'temprano', 'amigos', 'estudiante',
    'agua', 'años', 'casa', 'escuela', 'trabajo', 'libro'
  ];

  const problems = {
    listening: [],
    word_order: []
  };

  questions.forEach(q => {
    const questionLower = (q.question || '').toLowerCase();
    // Buscar palabras completas con word boundaries
    const hasSpanish = spanishKeywords.some(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(q.question || '');
    });

    if (!hasSpanish) return;

    // Listening sin opciones
    if (q.exercise_type === 'listening' && (!q.options || q.options.length === 0)) {
      problems.listening.push(q);
    }

    // Word order con español
    if (q.exercise_type === 'word_order') {
      problems.word_order.push(q);
    }
  });

  console.log(`✅ Encontrados ${problems.listening.length} preguntas de listening con español`);
  console.log(`✅ Encontrados ${problems.word_order.length} preguntas de word_order con español\n`);

  return problems;
}

async function fixListeningQuestions(questions) {
  console.log('🔧 Paso 2: Corrigiendo preguntas de listening...\n');

  let fixed = 0;
  let errors = 0;

  for (const q of questions) {
    try {
      const { error } = await supabase
        .from('diagnostic_questions')
        .update({
          exercise_type: 'speaking',
          question: q.correct_answer,  // El inglés va como pregunta
          audio_text: q.question       // El español va como audio_text
        })
        .eq('id', q.id);

      if (error) {
        console.error(`❌ Error actualizando ${q.id}:`, error.message);
        errors++;
      } else {
        console.log(`✅ [${q.level}] ${q.id.substring(0, 8)}... - "${q.question.substring(0, 40)}..." → "${q.correct_answer.substring(0, 40)}..."`);
        fixed++;
      }
    } catch (err) {
      console.error(`❌ Error en ${q.id}:`, err.message);
      errors++;
    }
  }

  console.log(`\n📊 Listening: ${fixed} corregidas, ${errors} errores\n`);
  return { fixed, errors };
}

async function fixWordOrderQuestions(questions) {
  console.log('🔧 Paso 3: Corrigiendo preguntas de word_order...\n');

  let fixed = 0;
  let errors = 0;

  for (const q of questions) {
    try {
      const { error } = await supabase
        .from('diagnostic_questions')
        .update({
          audio_text: q.question,     // Guardar el español original
          question: `Order these words to form a sentence`  // Instrucción en inglés
        })
        .eq('id', q.id);

      if (error) {
        console.error(`❌ Error actualizando ${q.id}:`, error.message);
        errors++;
      } else {
        console.log(`✅ [${q.level}] ${q.id.substring(0, 8)}... - "${q.question.substring(0, 40)}..."`);
        fixed++;
      }
    } catch (err) {
      console.error(`❌ Error en ${q.id}:`, err.message);
      errors++;
    }
  }

  console.log(`\n📊 Word Order: ${fixed} corregidas, ${errors} errores\n`);
  return { fixed, errors };
}

async function main() {
  try {
    const problems = await identifyProblems();

    if (!problems) {
      console.error('❌ No se pudieron identificar problemas');
      return;
    }

    if (problems.listening.length === 0 && problems.word_order.length === 0) {
      console.log('✅ No se encontraron preguntas problemáticas. Todo está correcto.');
      return;
    }

    console.log('\n⚠️  ¿Deseas continuar con las correcciones?');
    console.log('   Presiona Ctrl+C para cancelar o espera 3 segundos...\n');

    await new Promise(resolve => setTimeout(resolve, 3000));

    const results = {
      listening: { fixed: 0, errors: 0 },
      word_order: { fixed: 0, errors: 0 }
    };

    if (problems.listening.length > 0) {
      results.listening = await fixListeningQuestions(problems.listening);
    }

    if (problems.word_order.length > 0) {
      results.word_order = await fixWordOrderQuestions(problems.word_order);
    }

    console.log('\n═══════════════════════════════════════');
    console.log('📊 RESUMEN FINAL');
    console.log('═══════════════════════════════════════');
    console.log(`Listening: ${results.listening.fixed} corregidas, ${results.listening.errors} errores`);
    console.log(`Word Order: ${results.word_order.fixed} corregidas, ${results.word_order.errors} errores`);
    console.log(`\nTotal: ${results.listening.fixed + results.word_order.fixed} preguntas corregidas`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

main();
