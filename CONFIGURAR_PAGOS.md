# 💳 Guía Rápida: Activar Pasarela de Pagos Wompi

## ✅ Lo que ya está listo

La pasarela de pagos ya está **100% implementada** y lista para funcionar. Solo falta configurar las credenciales.

## 🚀 Pasos para activar (5 minutos)

### 1️⃣ Obtener credenciales de Wompi

1. Ir a [https://comercios.wompi.co](https://comercios.wompi.co)
2. Iniciar sesión o crear cuenta
3. Ir a **Configuración** → **Claves API**
4. Copiar:
   - **Public Key** → `pub_prod_XXXXXXXX`
   - **Private Key** → `prv_prod_XXXXXXXX`
   - **Events Secret** → `prod_events_XXXXXXXX`

### 2️⃣ Crear archivo `.env.local`

Crear un archivo llamado `.env.local` en la raíz del proyecto:

```bash
# Copiar desde .env.example
cp .env.example .env.local
```

Luego editar `.env.local` y pegar las credenciales de Wompi:

```env
# WOMPI (Producción)
VITE_WOMPI_PUBLIC_KEY=pub_prod_XXXXXXXX
VITE_WOMPI_PRIVATE_KEY=prv_prod_XXXXXXXX
VITE_WOMPI_EVENTS_SECRET=prod_events_XXXXXXXX

# Supabase (ya deberían estar)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 3️⃣ Crear tablas en Supabase

1. Ir a [https://supabase.com](https://supabase.com)
2. Abrir tu proyecto
3. Ir a **SQL Editor**
4. Copiar y ejecutar el SQL que está en `SETUP_WOMPI.md` (sección "Paso 2")

### 4️⃣ Desplegar Edge Functions

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link al proyecto
supabase link --project-ref TU_PROJECT_ID

# Configurar secrets
supabase secrets set WOMPI_PRIVATE_KEY=prv_prod_XXXXXXXX
supabase secrets set WOMPI_EVENTS_SECRET=prod_events_XXXXXXXX

# Desplegar funciones
supabase functions deploy process-payment
supabase functions deploy wompi-webhook
```

### 5️⃣ Configurar Webhooks en Wompi

1. Ir a Wompi Dashboard → **Webhooks**
2. Agregar nueva URL:
   ```
   https://TU-PROYECTO.supabase.co/functions/v1/wompi-webhook
   ```
3. Seleccionar eventos:
   - ✅ `transaction.updated`
   - ✅ `transaction.approved`
   - ✅ `transaction.declined`

## 🎉 ¡Listo!

La pasarela ya está funcionando. Los usuarios pueden:

1. Ir a **Perfil** → **Pagar Mensualidad**
2. Seleccionar un plan
3. Ingresar datos de tarjeta
4. Pagar

## 🧪 Probar antes de activar producción

**IMPORTANTE**: Primero probar con credenciales de TEST:

```env
# Modo TEST (para pruebas)
VITE_WOMPI_PUBLIC_KEY=pub_test_XXXXXXXX
VITE_WOMPI_PRIVATE_KEY=prv_test_XXXXXXXX
```

**Tarjeta de prueba APROBADA**:
- Número: `4242 4242 4242 4242`
- CVV: `123`
- Fecha: `12/25`
- Nombre: Cualquiera

**Tarjeta de prueba RECHAZADA**:
- Número: `4111 1111 1111 1111`

## 📊 Ver pagos en Supabase

```sql
-- Ver todos los pagos
SELECT * FROM payments ORDER BY created_at DESC;

-- Ver suscripciones activas
SELECT * FROM subscriptions WHERE status = 'active';

-- Ver pagos de un usuario
SELECT * FROM payments WHERE user_id = 'UUID_DEL_USUARIO';
```

## 🔍 Verificar que todo funciona

1. **Frontend**: La app debe cargar sin errores
2. **Supabase**: Las tablas `payments` y `subscriptions` deben existir
3. **Edge Functions**: Deben aparecer en Supabase Dashboard
4. **Webhooks**: Debe estar configurado en Wompi
5. **Hacer un pago de prueba**: Debe aparecer en la tabla `payments`

## ⚠️ Notas importantes

- **NUNCA** subir el archivo `.env.local` a Git
- Las credenciales de producción son secretas
- Usar modo TEST primero antes de producción
- Los webhooks son obligatorios para actualizar estados
- Supabase maneja las claves privadas de forma segura

## 📞 ¿Problemas?

Si algo no funciona:

1. Revisar logs en: Supabase → Edge Functions → Logs
2. Revisar consola del navegador (F12)
3. Verificar que todas las credenciales estén correctas
4. Ver documentación completa en `SETUP_WOMPI.md`

---

**Tiempo estimado de configuración**: 5-10 minutos
