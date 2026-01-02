# 🔧 Configuración de Wompi - Pasarela de Pagos

## 📋 Requisitos previos

1. **Cuenta en Wompi**
   - Registrarse en [https://wompi.co](https://wompi.co)
   - Completar verificación de identidad
   - Obtener credenciales de producción

## 🔑 Paso 1: Obtener Credenciales de Wompi

Desde tu dashboard de Wompi, obtén:

- **Public Key**: `pub_prod_XXXXXXXX`
- **Private Key**: `prv_prod_XXXXXXXX`
- **Events Secret**: `test_events_XXXXXXXX` (para webhooks)

## 📊 Paso 2: Crear tabla en Supabase

Ejecuta este SQL en Supabase SQL Editor:

```sql
-- Tabla de pagos
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  reference TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'COP',
  status TEXT NOT NULL,
  payment_method TEXT,
  plan_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de suscripciones
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  payment_id UUID REFERENCES payments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at);

-- RLS (Row Level Security)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas: Los usuarios solo pueden ver sus propios pagos
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Solo el servidor puede insertar/actualizar pagos
CREATE POLICY "Service role can insert payments"
  ON payments FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update payments"
  ON payments FOR UPDATE
  USING (auth.role() = 'service_role');
```

## 🔐 Paso 3: Configurar Variables de Entorno

### Opción A: Variables de entorno locales (desarrollo)

Crea un archivo `.env.local` en la raíz del proyecto:

```env
# Wompi Credentials (MODO TEST para desarrollo)
VITE_WOMPI_PUBLIC_KEY=pub_test_XXXXXXXX
VITE_WOMPI_PRIVATE_KEY=prv_test_XXXXXXXX
VITE_WOMPI_EVENTS_SECRET=test_events_XXXXXXXX

# Wompi Credentials (MODO PRODUCCIÓN)
# VITE_WOMPI_PUBLIC_KEY=pub_prod_XXXXXXXX
# VITE_WOMPI_PRIVATE_KEY=prv_prod_XXXXXXXX
# VITE_WOMPI_EVENTS_SECRET=prod_events_XXXXXXXX

# Supabase (ya deberías tenerlas)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Opción B: Supabase Edge Secrets (producción)

```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Login a Supabase
supabase login

# Configurar secretos
supabase secrets set WOMPI_PRIVATE_KEY=prv_prod_XXXXXXXX
supabase secrets set WOMPI_EVENTS_SECRET=prod_events_XXXXXXXX
```

## 🚀 Paso 4: Desplegar Edge Function (Backend)

La Edge Function ya está creada en `supabase/functions/process-payment/index.ts`

Para desplegarla:

```bash
# Desde la raíz del proyecto
supabase functions deploy process-payment
```

## ✅ Paso 5: Configurar Webhooks en Wompi

1. Ve a tu dashboard de Wompi
2. Configuración → Webhooks
3. Agrega esta URL:
   ```
   https://TU-PROYECTO.supabase.co/functions/v1/wompi-webhook
   ```
4. Selecciona los eventos:
   - `transaction.updated`
   - `transaction.approved`
   - `transaction.declined`

## 🧪 Paso 6: Probar con Tarjetas de Test

Wompi provee tarjetas de prueba:

### Tarjeta de APROBACIÓN:
- Número: `4242 4242 4242 4242`
- CVV: `123`
- Fecha: Cualquier fecha futura (ej: `12/25`)
- Nombre: Cualquier nombre

### Tarjeta de RECHAZO:
- Número: `4111 1111 1111 1111`
- CVV: `123`
- Fecha: Cualquier fecha futura

## 📱 Paso 7: Activar en la App

Una vez configurado todo, la pasarela ya funciona automáticamente.

El flujo es:
1. Usuario selecciona plan → Frontend
2. Usuario llena datos de tarjeta → Frontend
3. Frontend tokeniza tarjeta → Wompi API (Public Key)
4. Frontend envía token a Edge Function → Supabase
5. Edge Function procesa pago → Wompi API (Private Key)
6. Wompi notifica webhook → Supabase
7. Supabase actualiza BD → Estado del pago
8. Frontend muestra confirmación

## 🔍 Verificar que todo funciona

1. Revisa los logs en Supabase:
   - Dashboard → Edge Functions → Logs

2. Revisa la tabla `payments`:
   ```sql
   SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
   ```

3. Revisa las transacciones en Wompi Dashboard

## 🆘 Solución de problemas

### Error: "Public key inválida"
- Verifica que la clave empiece con `pub_test_` o `pub_prod_`
- Verifica que esté en `.env.local` como `VITE_WOMPI_PUBLIC_KEY`

### Error: "Private key inválida"
- La private key solo se usa en el backend (Edge Function)
- Debe empezar con `prv_test_` o `prv_prod_`

### Pago no se refleja en BD
- Revisa los logs de Edge Function
- Verifica que el webhook esté configurado correctamente
- Verifica que la URL del webhook sea correcta

## 📞 Contacto

Si tienes problemas, contacta a soporte de Wompi:
- Email: soporte@wompi.co
- Documentación: https://docs.wompi.co
