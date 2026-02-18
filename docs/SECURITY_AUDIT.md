# Auditoría de Seguridad - BYE App

**Fecha:** 17/02/2026
**Alcance:** Frontend (React + TypeScript), Edge Functions (Supabase/Deno), Base de datos (Supabase PostgreSQL)

---

## Resumen Ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| **CRÍTICA** | 4 |
| **ALTA** | 6 |
| **MEDIA** | 5 |
| **BAJA** | 3 |

---

## VULNERABILIDADES CRÍTICAS

### 1. Service Role Key expuesto en `.env` (commiteado a git)
- **Archivo:** `.env` línea 3
- **Riesgo:** Cualquier persona con acceso al repo tiene acceso TOTAL a la base de datos, bypaseando RLS.
- **Solución:**
  1. Rotar el key desde Supabase Dashboard → Settings → JWT Keys → Change legacy JWT secret
  2. Eliminar `.env` del historial de git con `git filter-repo`
  3. Crear `.env.example` con placeholders y agregar `.env` a `.gitignore`

### 2. Edge Function `process-payment` sin autenticación JWT
- **Archivo:** `supabase/functions/process-payment/index.ts`
- **Riesgo:** Cualquier persona puede llamar esta función sin estar logueada y procesar pagos para cualquier `userId`.
- **Solución:**
  ```typescript
  // Agregar verificación de JWT al inicio
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'No autorizado' });

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !authData?.user) return json(401, { error: 'Token inválido' });

  // Verificar que el userId del body coincide con el usuario autenticado
  if (paymentData.userId !== authData.user.id) {
    return json(403, { error: 'No puedes procesar pagos de otro usuario' });
  }
  ```

### 3. Tablas sin políticas RLS (Row Level Security)
- **Tablas afectadas:** `profiles`, `lessons`, `lesson_questions`, `lesson_progress`, `diagnostic_questions`, `diagnostic_results`, `payments`, `subscriptions`, `payment_plans`, `notifications`, `notification_recipients`, `app_settings`, `friendships`, `messages`, `push_subscriptions`
- **Riesgo:** Un usuario puede leer/modificar datos de CUALQUIER otro usuario directamente desde el navegador con la anon key.
- **Solución:** Crear políticas RLS para cada tabla. Ejemplo para `profiles`:
  ```sql
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

  -- Usuarios leen su propio perfil
  CREATE POLICY "select_own_profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

  -- Admins leen todos los perfiles
  CREATE POLICY "admin_select_all" ON profiles
    FOR SELECT USING (
      (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'admin'
    );

  -- Solo admins pueden actualizar perfiles de otros
  CREATE POLICY "admin_update_all" ON profiles
    FOR UPDATE USING (
      auth.uid() = user_id OR
      (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'admin'
    );
  ```

### 4. Verificación de admin es solo client-side
- **Archivos:** `src/router/index.tsx` (líneas 87-138), `src/store/authStore.ts`
- **Riesgo:** Un usuario puede modificar el estado de Zustand desde DevTools, acceder a rutas admin, y ejecutar funciones de `adminService.ts` directamente.
- **Solución:** Las políticas RLS del punto anterior son la defensa principal. Cada operación sensible debe ser validada en el backend, no solo en el frontend.

---

## VULNERABILIDADES ALTAS

### 5. Webhook de Wompi con verificación de firma opcional
- **Archivo:** `supabase/functions/wompi-webhook/index.ts` líneas 28-37
- **Riesgo:** Si `WOMPI_EVENTS_SECRET` no está configurado o faltan headers, el webhook se procesa SIN verificación. Un atacante puede enviar webhooks falsos para confirmar pagos.
- **Solución:**
  ```typescript
  // Hacer la verificación OBLIGATORIA
  const eventsSecret = Deno.env.get('WOMPI_EVENTS_SECRET');
  const signature = req.headers.get('x-wompi-signature');
  const timestamp = req.headers.get('x-wompi-timestamp');

  if (!eventsSecret || !signature || !timestamp) {
    return json(401, { error: 'Missing security headers' });
  }

  const expectedSignature = createHmac('sha256', eventsSecret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    return json(401, { error: 'Invalid signature' });
  }

  // Agregar validación de timestamp para prevenir replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return json(400, { error: 'Webhook expired' });
  }
  ```

### 6. Sin validación de monto en pagos
- **Archivo:** `supabase/functions/process-payment/index.ts` líneas 40-42
- **Riesgo:** Se puede enviar un monto negativo o arbitrariamente grande.
- **Solución:**
  ```typescript
  if (!Number.isInteger(amount) || amount < 100 || amount > 10000000) {
    throw new Error('Monto inválido');
  }
  ```

### 7. Chat sin control de acceso
- **Archivo:** `src/services/chatService.ts`
- **Riesgo:** Un usuario puede leer mensajes de CUALQUIER conversación adivinando el `conversationId`.
- **Solución:** Política RLS en tabla `messages`:
  ```sql
  CREATE POLICY "read_own_messages" ON messages
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
      )
    );
  ```

### 8. Solicitudes de amistad sin verificación de ownership
- **Archivo:** `src/services/friendsService.ts` líneas 84-98
- **Riesgo:** Un usuario puede aceptar/rechazar solicitudes de amistad de otro usuario.
- **Solución:** Política RLS en `friendships`:
  ```sql
  CREATE POLICY "manage_own_requests" ON friendships
    FOR UPDATE USING (
      auth.uid() = user_id OR auth.uid() = friend_id
    );
  ```

### 9. Logs de autenticación en consola
- **Archivo:** `src/store/authStore.ts` líneas 150-157
- **Riesgo:** Expone user_id, email, rol y estado admin en la consola del navegador.
- **Solución:** Eliminar el `console.log('🔍 DEBUG AUTH:', ...)` o envolverlo en `if (import.meta.env.DEV)`.

### 10. CORS `*` en TODAS las Edge Functions
- **Archivos:** Todas las Edge Functions (`process-payment`, `wompi-webhook`, `push-test`, `send-notification-push`)
- **Riesgo:** Cualquier sitio web puede hacer peticiones a estas funciones.
- **Solución:**
  ```typescript
  const ALLOWED_ORIGINS = ['https://tu-dominio.com', 'http://localhost:5173'];
  const origin = req.headers.get('origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : '',
    // ...
  };
  ```

---

## VULNERABILIDADES MEDIAS

### 11. Mass assignment en `updateUser()`
- **Archivo:** `src/services/adminService.ts` líneas 111-121
- **Riesgo:** Acepta cualquier campo de `Partial<UserProfile>`, incluyendo `role` y `is_active`.
- **Solución:** Whitelist de campos permitidos en el backend (RLS) o en el frontend:
  ```typescript
  const ALLOWED = ['full_name', 'avatar_url', 'level'];
  const safe = Object.fromEntries(
    Object.entries(updates).filter(([k]) => ALLOWED.includes(k))
  );
  ```

### 12. Sin rate limiting en endpoints de autenticación
- **Archivo:** `src/services/authService.ts`
- **Riesgo:** Ataques de fuerza bruta contra login/registro.
- **Solución:** Implementar backoff exponencial en el frontend + rate limiting en Supabase.

### 13. Session tokens en localStorage
- **Archivo:** `src/lib/supabaseClient.ts` línea 14
- **Riesgo:** Vulnerable a XSS: cualquier script inyectado puede robar el token de autenticación.
- **Solución:** Implementar Content Security Policy (CSP) headers. Considerar `httpOnly cookies` para autenticación.

### 14. Sin validación de `user_ids` en push notifications
- **Archivo:** `supabase/functions/send-notification-push/index.ts` línea 61
- **Riesgo:** Array sin límite de tamaño podría causar DoS.
- **Solución:**
  ```typescript
  if (!Array.isArray(userIds) || userIds.length > 10000) {
    return json(400, { error: 'Invalid user_ids' });
  }
  ```

### 15. Sin idempotencia en webhook de Wompi
- **Archivo:** `supabase/functions/wompi-webhook/index.ts`
- **Riesgo:** Replay de webhooks puede duplicar pagos/suscripciones.
- **Solución:** Guardar `transaction_id` procesados y rechazar duplicados.

---

## VULNERABILIDADES BAJAS

### 16. `innerHTML` para fallback de SVG
- **Archivo:** `src/pages/Achievements/AchievementsPage.tsx` línea 218
- **Riesgo:** Potencial XSS si se modifica para usar contenido dinámico. Actualmente es SVG hardcodeado (bajo riesgo).
- **Solución:** Usar `createElement()` en vez de `innerHTML`.

### 17. `console.log` en múltiples archivos de producción
- **Archivos:** `adminService.ts`, `wompi.ts`, `UsersPage.tsx`, `diagnosticService.ts`
- **Riesgo:** Fuga de información menor (IDs, estados, errores detallados).
- **Solución:** Eliminar o envolver en `if (import.meta.env.DEV)`.

### 18. Error messages detallados expuestos al cliente
- **Archivo:** `supabase/functions/process-payment/index.ts` línea 143
- **Riesgo:** Mensajes de error de Wompi API expuestos al usuario, revelando detalles del sistema.
- **Solución:** Retornar mensajes genéricos: `"Error procesando el pago"`.

---

## COSAS QUE ESTÁN BIEN ✅

| Aspecto | Detalle |
|---------|---------|
| Flujo PKCE | Auth usa `flowType: 'pkce'` (más seguro que implicit) |
| Verificación admin en push | `send-notification-push` verifica rol admin correctamente |
| Detección de cuentas bloqueadas | `checkSession()` verifica `is_active` y fuerza logout |
| Auto-refresh de tokens | `autoRefreshToken: true` configurado |
| Publishable key | Frontend usa `sb_publishable_...` (no legacy JWT anon key) |
| Protección de rutas admin | `AdminRoute` component en el router |
| Edge Function push-test | Verifica JWT del usuario antes de enviar push |

---

## PLAN DE ACCIÓN RECOMENDADO

### Fase 1 - Inmediato (antes de producción)
1. ✅ Rotar el service_role key
2. ✅ Implementar RLS en TODAS las tablas
3. ✅ Agregar JWT auth a `process-payment`
4. ✅ Hacer obligatoria la firma en `wompi-webhook`
5. ✅ Eliminar debug console.logs con datos sensibles

### Fase 2 - Esta semana
6. Validar montos y ownership en pagos
7. Restringir CORS a dominios conocidos
8. Control de acceso en chat (mensajes)
9. Verificación de ownership en solicitudes de amistad
10. Sanitizar campos en `updateUser()`

### Fase 3 - Sprint actual
11. Implementar CSP headers
12. Rate limiting en auth
13. Idempotencia en webhooks
14. Limitar array de `user_ids` en push
15. Eliminar todos los `console.log` de producción

---

*Reporte generado el 17/02/2026 — Auditoría realizada sobre el código fuente del repositorio FRONTEND-BYE-main*
