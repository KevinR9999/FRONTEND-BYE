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

console.log('🔍 Buscando preguntas duplicadas...\n');

async function findDuplicates() {
  const { data: questions, error } = await supabase
    .from('diagnostic_questions')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Total de preguntas: ${questions.length}\n`);

  // Agrupar por question + correct_answer + level
  const questionMap = new Map();

  questions.forEach(q => {
    const key = `${q.question}|||${q.correct_answer}|||${q.level}|||${q.exercise_type}`;

    if (!questionMap.has(key)) {
      questionMap.set(key, []);
    }

    questionMap.get(key).push(q);
  });

  // Encontrar duplicados
  const duplicates = [];

  questionMap.forEach((questions, key) => {
    if (questions.length > 1) {
      duplicates.push({
        key,
        count: questions.length,
        questions
      });
    }
  });

  if (duplicates.length === 0) {
    console.log('✅ No se encontraron preguntas duplicadas\n');
    return [];
  }

  console.log(`❌ Encontrados ${duplicates.length} grupos de preguntas duplicadas:\n`);

  duplicates.forEach((dup, index) => {
    const [question, answer, level, type] = dup.key.split('|||');
    console.log(`${index + 1}. [${level}] ${type}`);
    console.log(`   Pregunta: "${question.substring(0, 60)}..."`);
    console.log(`   Respuesta: "${answer.substring(0, 60)}..."`);
    console.log(`   Aparece ${dup.count} veces`);
    console.log(`   IDs: ${dup.questions.map(q => q.id.substring(0, 8)).join(', ')}`);
    console.log('');
  });

  return duplicates;
}

findDuplicates();
