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

console.log('🔍 Buscando preguntas con respuestas similares...\n');

async function findSimilar() {
  const { data: questions, error } = await supabase
    .from('diagnostic_questions')
    .select('*')
    .order('level', { ascending: true });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Total de preguntas: ${questions.length}\n`);

  // Agrupar por correct_answer + level
  const answerMap = new Map();

  questions.forEach(q => {
    const key = `${q.correct_answer.toLowerCase().trim()}|||${q.level}`;

    if (!answerMap.has(key)) {
      answerMap.set(key, []);
    }

    answerMap.get(key).push(q);
  });

  // Encontrar respuestas que aparecen múltiples veces
  const similar = [];

  answerMap.forEach((questions, key) => {
    if (questions.length > 1) {
      similar.push({
        key,
        count: questions.length,
        questions
      });
    }
  });

  if (similar.length === 0) {
    console.log('✅ No se encontraron preguntas con respuestas repetidas\n');
    return;
  }

  console.log(`⚠️  Encontrados ${similar.length} grupos con la misma respuesta correcta:\n`);

  // Mostrar solo los primeros 20
  similar.slice(0, 20).forEach((sim, index) => {
    const [answer, level] = sim.key.split('|||');
    console.log(`${index + 1}. [${level}] Respuesta: "${answer}"`);
    console.log(`   Aparece ${sim.count} veces en diferentes preguntas:`);
    sim.questions.forEach(q => {
      console.log(`   - [${q.exercise_type}] "${q.question.substring(0, 50)}..."`);
    });
    console.log('');
  });

  if (similar.length > 20) {
    console.log(`... y ${similar.length - 20} grupos más\n`);
  }
}

findSimilar();
