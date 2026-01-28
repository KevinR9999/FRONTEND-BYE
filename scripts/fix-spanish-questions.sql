-- Script para corregir preguntas con texto en español en diagnostic_questions
-- =====================================================================
-- PROBLEMA: Las preguntas de tipo "listening" sin opciones se convierten
-- automáticamente en ejercicios de "speaking" con traducción, pero muestran
-- el texto en español como pregunta.
--
-- SOLUCIÓN: Cambiar el exercise_type a "speaking" y poner el inglés como question
-- =====================================================================

-- Paso 1: Identificar preguntas problemáticas
-- Estas son preguntas de tipo "listening" sin opciones que tienen texto en español

SELECT
  id,
  LEFT(question, 50) as question_preview,
  LEFT(correct_answer, 50) as answer_preview,
  exercise_type,
  level,
  CASE
    WHEN options IS NULL OR options = '[]' THEN 'Sin opciones'
    ELSE 'Con opciones'
  END as has_options
FROM diagnostic_questions
WHERE exercise_type = 'listening'
  AND (options IS NULL OR options = '[]' OR jsonb_array_length(options::jsonb) = 0)
ORDER BY level, order_index;

-- =====================================================================
-- Paso 2: ACTUALIZAR las preguntas de listening sin opciones
-- Cambiar a tipo "speaking" y ajustar los campos
-- =====================================================================

-- OPCIÓN A: Convertir todas las preguntas de listening sin opciones a speaking
-- El question pasa a ser el correct_answer (inglés)
-- El audio_text guarda el español original si es necesario

UPDATE diagnostic_questions
SET
  exercise_type = 'speaking',
  question = correct_answer,  -- El inglés va como pregunta (lo que el usuario debe decir)
  audio_text = CASE
    WHEN audio_text IS NULL OR audio_text = '' THEN question  -- Guardar el español en audio_text
    ELSE audio_text
  END
WHERE
  exercise_type = 'listening'
  AND (options IS NULL OR options = '[]' OR jsonb_array_length(options::jsonb) = 0)
  AND question ~ '(yo |tú |él |ella |nosotros|vosotros|ellos|comemos|cantamos|bebemos|vivimos|trabajamos|estudia|dice|tiene|está|son|eres|soy|tengo|bebo|como|corro|bailo|escribo|cocino|viajo|compro)';

-- =====================================================================
-- Paso 3: Verificar los cambios
-- =====================================================================

SELECT
  id,
  LEFT(question, 50) as question_preview,
  LEFT(correct_answer, 50) as answer_preview,
  LEFT(audio_text, 50) as audio_text_preview,
  exercise_type,
  level
FROM diagnostic_questions
WHERE exercise_type = 'speaking'
  AND audio_text IS NOT NULL
  AND audio_text != ''
ORDER BY level, order_index
LIMIT 20;

-- =====================================================================
-- ROLLBACK (si algo sale mal, ejecutar esto para revertir)
-- =====================================================================

-- COMENTADO - Solo descomenta si necesitas revertir los cambios
-- UPDATE diagnostic_questions
-- SET
--   exercise_type = 'listening',
--   question = audio_text,
--   audio_text = ''
-- WHERE
--   exercise_type = 'speaking'
--   AND audio_text ~ '(yo |tú |él |ella |nosotros)';
