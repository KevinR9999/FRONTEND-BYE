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

console.log('🔍 Buscando preguntas con opciones incorrectas...\n');

async function findBadOptions() {
  // Buscar preguntas multiple_choice
  const { data: questions, error } = await supabase
    .from('diagnostic_questions')
    .select('*')
    .eq('exercise_type', 'multiple_choice');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Total preguntas multiple_choice: ${questions.length}\n`);

  const problems = [];

  for (const q of questions) {
    const optionsCount = q.options ? q.options.length : 0;

    if (optionsCount < 2) {
      problems.push({
        id: q.id,
        level: q.level,
        question: q.question,
        correct_answer: q.correct_answer,
        options: q.options,
        optionsCount
      });
    }
  }

  if (problems.length === 0) {
    console.log('✅ No se encontraron preguntas con opciones incorrectas\n');
    return;
  }

  console.log(`❌ Encontradas ${problems.length} preguntas con opciones incorrectas:\n`);

  problems.forEach((p, index) => {
    console.log(`${index + 1}. [${p.level}] ID: ${p.id.substring(0, 8)}`);
    console.log(`   Pregunta: "${p.question}"`);
    console.log(`   Respuesta correcta: "${p.correct_answer}"`);
    console.log(`   Opciones actuales (${p.optionsCount}): ${JSON.stringify(p.options)}`);
    console.log('');
  });

  console.log('\n⚠️  Estas preguntas necesitan ser corregidas manualmente en la base de datos');
  console.log('   Cada pregunta multiple_choice debe tener al menos 2 opciones (idealmente 3-4)\n');
}

findBadOptions();
