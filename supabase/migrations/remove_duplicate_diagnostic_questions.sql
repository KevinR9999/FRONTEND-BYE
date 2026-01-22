-- Script para eliminar preguntas diagnósticas duplicadas
-- De 1000 registros a 500 únicos

-- PASO 1: Primero eliminar las respuestas de usuarios que referencian preguntas duplicadas
DELETE FROM diagnostic_user_answers
WHERE question_id NOT IN (
  SELECT DISTINCT ON (question) id
  FROM diagnostic_questions
  ORDER BY question, created_at ASC
);

-- PASO 2: Ahora sí eliminar las preguntas duplicadas
DELETE FROM diagnostic_questions
WHERE id NOT IN (
  SELECT DISTINCT ON (question) id
  FROM diagnostic_questions
  ORDER BY question, created_at ASC
);

-- PASO 3: Verificar resultado
SELECT COUNT(*) as total_preguntas FROM diagnostic_questions;
