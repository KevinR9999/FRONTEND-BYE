-- Script para corregir preguntas word_order con texto en español
-- =====================================================================
-- PROBLEMA: Las preguntas de tipo "word_order" tienen el texto de instrucción
-- en español (ej: "Ella dijo que vendría mañana") cuando debería mostrar
-- instrucciones en inglés y el usuario debe ordenar las palabras en inglés.
-- =====================================================================

-- Paso 1: Identificar preguntas word_order con texto en español
SELECT
  id,
  LEFT(question, 60) as question_spanish,
  LEFT(correct_answer, 60) as correct_english,
  level,
  LEFT(options::text, 100) as words_to_order
FROM diagnostic_questions
WHERE exercise_type = 'word_order'
  AND question ~ '(yo |tú |él |ella |nosotros|vosotros|ellos|comemos|cantamos|bebemos|vivimos|trabajamos|estudia|dice|tiene|está|son|eres|soy|tengo|bebo|como|corro|bailo|escribo|cocino|viajo|compro|dijo|vendría|maÃ±ana|habÃ­a|hubiera|sabido|habrÃ­a|actuado|diferente|aprobarÃ³|obtuvo|mejor|nota)'
ORDER BY level, order_index;

-- =====================================================================
-- Paso 2: ACTUALIZAR word_order con instrucciones en inglés
-- =====================================================================

-- Para word_order, la estructura correcta debería ser:
-- - question: "Order the words to form the correct sentence" (instrucción en inglés)
-- - audio_text: El español original (para referencia o audio)
-- - options: Las palabras en inglés para ordenar
-- - correct_answer: La oración correcta en inglés

UPDATE diagnostic_questions
SET
  audio_text = question,  -- Guardar el español como audio_text
  question = 'Order the words to form the correct sentence: ' || correct_answer
WHERE
  exercise_type = 'word_order'
  AND question ~ '(yo |tú |él |ella |nosotros|vosotros|ellos|comemos|cantamos|bebemos|vivimos|trabajamos|estudia|dice|tiene|está|son|eres|soy|tengo|bebo|como|corro|bailo|escribo|cocino|viajo|compro|dijo|vendría|maÃ±ana|habÃ­a|hubiera|sabido|habrÃ­a|actuado|diferente|aprobarÃ³|obtuvo|mejor|nota)';

-- =====================================================================
-- ALTERNATIVA: Si prefieres NO mostrar el español en absoluto
-- Solo mostrar: "Order these words:"
-- =====================================================================

-- UPDATE diagnostic_questions
-- SET
--   audio_text = question,  -- Guardar el español como referencia
--   question = 'Order these words to form a sentence'
-- WHERE
--   exercise_type = 'word_order'
--   AND question ~ '(español|palabras|clave)';

-- =====================================================================
-- Paso 3: Verificar los cambios
-- =====================================================================

SELECT
  id,
  LEFT(question, 80) as question_english,
  LEFT(audio_text, 50) as original_spanish,
  LEFT(correct_answer, 50) as answer,
  exercise_type,
  level
FROM diagnostic_questions
WHERE exercise_type = 'word_order'
  AND audio_text IS NOT NULL
  AND audio_text != ''
ORDER BY level, order_index
LIMIT 20;
