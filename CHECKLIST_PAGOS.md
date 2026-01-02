# ✅ Checklist: Activar Pasarela de Pagos

Marca cada paso cuando lo completes:

## Antes de empezar

- [ ] Tener cuenta en Wompi ([comercios.wompi.co](https://comercios.wompi.co))
- [ ] Tener cuenta verificada
- [ ] Tener proyecto de Supabase activo

## Configuración (hacer solo UNA VEZ)

### Paso 1: Wompi
- [ ] Obtener **Public Key** de Wompi
- [ ] Obtener **Private Key** de Wompi
- [ ] Obtener **Events Secret** de Wompi

### Paso 2: Variables de Entorno
- [ ] Crear archivo `.env.local` en la raíz del proyecto
- [ ] Copiar contenido de `.env.example`
- [ ] Pegar las 3 credenciales de Wompi
- [ ] Verificar que las credenciales de Supabase estén

### Paso 3: Base de Datos
- [ ] Abrir Supabase SQL Editor
- [ ] Ejecutar el SQL de `SETUP_WOMPI.md` (Paso 2)
- [ ] Verificar que se crearon las tablas `payments` y `subscriptions`

### Paso 4: Backend (Edge Functions)
- [ ] Instalar Supabase CLI: `npm install -g supabase`
- [ ] Login: `supabase login`
- [ ] Link al proyecto: `supabase link`
- [ ] Configurar secrets de Wompi
- [ ] Desplegar función `process-payment`
- [ ] Desplegar función `wompi-webhook`

### Paso 5: Webhooks
- [ ] Ir a Wompi Dashboard → Webhooks
- [ ] Agregar URL de webhook de Supabase
- [ ] Activar eventos: `transaction.updated`, `transaction.approved`, `transaction.declined`

## Pruebas (IMPORTANTE)

### Modo TEST
- [ ] Usar credenciales `pub_test_` y `prv_test_`
- [ ] Hacer pago de prueba con tarjeta `4242 4242 4242 4242`
- [ ] Verificar que aparece en tabla `payments`
- [ ] Verificar que se crea `subscription` activa
- [ ] Revisar logs de Edge Functions (sin errores)

### Modo PRODUCCIÓN
- [ ] Cambiar a credenciales `pub_prod_` y `prv_prod_`
- [ ] Hacer pago real de prueba
- [ ] Verificar que todo funciona correctamente
- [ ] Revisar que Wompi Dashboard muestre la transacción

## Verificación Final

- [ ] La app carga sin errores
- [ ] Aparece opción "Pagar Mensualidad" en el Perfil
- [ ] Los 3 planes se muestran correctamente
- [ ] El formulario de pago funciona
- [ ] Los inputs muestran el texto que escribes
- [ ] Los pagos se guardan en Supabase
- [ ] Las suscripciones se crean automáticamente
- [ ] Los webhooks llegan correctamente

## En caso de error

- [ ] Revisar logs en Supabase: Dashboard → Edge Functions → Logs
- [ ] Revisar consola del navegador (F12)
- [ ] Verificar que `.env.local` tiene todas las credenciales
- [ ] Verificar que las Edge Functions están desplegadas
- [ ] Verificar que el webhook está configurado en Wompi

---

✅ **Todo listo**: Cuando todos los checkboxes estén marcados, la pasarela está funcionando.

📞 **Documentación completa**: Ver `SETUP_WOMPI.md` y `CONFIGURAR_PAGOS.md`
