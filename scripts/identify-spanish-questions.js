const fs = require('fs');
const path = require('path');

// Leer el CSV
const csvPath = path.join(__dirname, '..', 'diagnostic_questions_rows.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

const lines = csvContent.split('\n');
const headers = lines[0].split(',');

console.log('🔍 Buscando preguntas con texto en español...\n');

let problemCount = 0;
const problems = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;

  // Parse CSV manually (simple approach)
  const match = line.match(/^([^,]+),([^,]*),(\[.*?\]|".*?"|[^,]*),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*)$/);

  if (!match) continue;

  const [, id, question, options, correctAnswer, level, orderIndex, createdAt, exerciseType, audioUrl, imageUrl, skill, timeLimit, audioText] = match;

  // Identificar preguntas problemáticas
  const hasNoOptions = !options || options === '""' || options === '';
  const isListening = exerciseType === 'listening';
  const isWordOrder = exerciseType === 'word_order';

  // Palabras comunes en español para detectar
  const spanishKeywords = ['yo ', 'tú ', 'él ', 'ella ', 'nosotros', 'vosotros', 'ellos', 'comemos', 'cantamos', 'bebemos', 'vivimos', 'trabajamos', 'estudia', 'dice', 'tiene', 'está', 'son', 'eres', 'soy'];
  const questionLower = question.toLowerCase();
  const hasSpanish = spanishKeywords.some(word => questionLower.includes(word));

  if ((isListening && hasNoOptions && hasSpanish) || (isWordOrder && hasSpanish)) {
    problemCount++;
    problems.push({
      lineNumber: i + 1,
      id,
      question: question.substring(0, 60),
      correctAnswer: correctAnswer.substring(0, 60),
      exerciseType,
      level,
      hasOptions: !hasNoOptions
    });
  }
}

console.log(`❌ Encontradas ${problemCount} preguntas problemáticas:\n`);

problems.forEach((p, index) => {
  console.log(`${index + 1}. [${p.level}] ${p.exerciseType}`);
  console.log(`   Línea: ${p.lineNumber}`);
  console.log(`   Pregunta: ${p.question}...`);
  console.log(`   Respuesta: ${p.correctAnswer}...`);
  console.log('');
});

console.log('\n📋 RESUMEN:');
console.log(`Total de preguntas problemáticas: ${problemCount}`);
console.log('\nTipos de problemas:');
const byType = problems.reduce((acc, p) => {
  acc[p.exerciseType] = (acc[p.exerciseType] || 0) + 1;
  return acc;
}, {});
Object.entries(byType).forEach(([type, count]) => {
  console.log(`  - ${type}: ${count} preguntas`);
});
