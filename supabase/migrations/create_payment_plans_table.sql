-- Crear tabla payment_plans si no existe
CREATE TABLE IF NOT EXISTS payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'COP',
  duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsquedas rápidas de planes activos
CREATE INDEX IF NOT EXISTS idx_payment_plans_active ON payment_plans(is_active) WHERE is_active = true;

-- Índice para ordenar por precio
CREATE INDEX IF NOT EXISTS idx_payment_plans_price ON payment_plans(price);

-- Habilitar RLS (Row Level Security)
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer planes activos (para la página de pago)
CREATE POLICY "Todos pueden ver planes activos"
ON payment_plans
FOR SELECT
USING (is_active = true);

-- Política: Solo admins pueden crear, editar y eliminar planes
-- NOTA: Necesitas crear una función para verificar si el usuario es admin
-- Por ahora, permite que usuarios autenticados lean todos los planes
CREATE POLICY "Usuarios autenticados pueden ver todos los planes"
ON payment_plans
FOR SELECT
TO authenticated
USING (true);

-- Política: Permitir insert/update/delete para service role
-- (esto se usa desde el panel de admin a través de Supabase Client con service role)
CREATE POLICY "Service role puede hacer todo"
ON payment_plans
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Insertar planes de ejemplo (opcional - puedes comentar esto si ya tienes planes)
INSERT INTO payment_plans (name, price, currency, duration_days, features, is_active)
VALUES
  (
    'Plan Básico',
    150000,
    'COP',
    30,
    '["Clases 2 veces por semana", "Acceso a plataforma digital", "Material didáctico incluido", "Soporte por email"]'::jsonb,
    true
  ),
  (
    'Plan Estándar',
    250000,
    'COP',
    30,
    '["Clases 3 veces por semana", "Acceso completo a plataforma", "Material didáctico premium", "Práctica de conversación", "Certificado de nivel"]'::jsonb,
    true
  ),
  (
    'Plan Intensivo',
    350000,
    'COP',
    30,
    '["Clases 5 veces por semana", "Tutorías personalizadas", "Material exclusivo", "Preparación para exámenes", "Certificación internacional"]'::jsonb,
    true
  )
ON CONFLICT DO NOTHING;

-- Comentarios en la tabla
COMMENT ON TABLE payment_plans IS 'Planes de pago disponibles para suscripciones';
COMMENT ON COLUMN payment_plans.name IS 'Nombre del plan (ej: Plan Básico, Premium, etc.)';
COMMENT ON COLUMN payment_plans.price IS 'Precio del plan';
COMMENT ON COLUMN payment_plans.currency IS 'Moneda del precio (COP, USD, etc.)';
COMMENT ON COLUMN payment_plans.duration_days IS 'Duración del plan en días';
COMMENT ON COLUMN payment_plans.features IS 'Array JSON con las características del plan';
COMMENT ON COLUMN payment_plans.is_active IS 'Si el plan está activo y visible para usuarios';
