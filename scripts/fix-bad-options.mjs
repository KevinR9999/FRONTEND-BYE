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

console.log('🔧 Corrigiendo preguntas con opciones incorrectas...\n');

const fixes = [
  { id: '5a751ac9-fa15-407f-982f-c7293cac8b54', options: ['Do', 'Does', 'Is', 'Are'] },
  { id: 'dc308f2a-f20d-48dc-8023-8d7330ce210c', options: ['Does', 'Do', 'Is', 'Are'] },
  { id: '73f6e65f-420f-40bf-8514-d8b6822f898c', options: ['Apples', 'Oranges', 'Bananas'] },
  { id: '1d90c226-88c6-45ae-a26c-6f1642d0e230', options: ['Are', 'Is', 'Am', 'Be'] },
  { id: 'd729dd34-5104-4fd2-998b-63ab6d8d2047', options: ['By tomorrow morning', 'By next week', 'By tonight'] },
  { id: '04d97c1d-c8a5-4bff-874f-27c880b0a65d', options: ['Before the person arrived', 'When the person arrived', 'After the person arrived'] }
];

async function fixOptions() {
  let fixed = 0;
  let errors = 0;

  for (const fix of fixes) {
    const { error } = await supabase
      .from('diagnostic_questions')
      .update({ options: fix.options })
      .eq('id', fix.id);

    if (error) {
      console.log(`❌ Error en ${fix.id.substring(0, 8)}: ${error.message}`);
      errors++;
    } else {
      console.log(`✅ Corregido ${fix.id.substring(0, 8)}: ${fix.options.length} opciones`);
      fixed++;
    }
  }

  console.log(`\n📊 Resumen: ${fixed} corregidas, ${errors} errores\n`);
}

fixOptions();
