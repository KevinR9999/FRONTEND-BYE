# Admin: Sistema de Gestión de Contenido

## Estado: 🔴 PENDIENTE

---

## ❌ PROBLEMA ACTUAL

El admin actual en `/admin/lessons` tiene problemas:
- Los niveles (A1, A2, B1, B2) son **tabs fijos**, no se pueden agregar nuevos (C1, C2)
- El formulario de "Nueva Lección" no sigue la jerarquía correcta
- No hay separación clara entre: Nivel → Lección → Ejercicio

---

## ✅ CÓMO DEBE FUNCIONAR

```
┌─────────────────────────────────────────────────────────────────┐
│                         PANEL ADMIN                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PASO 1: NIVELES                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│  │   A1     │ │   A2     │ │   B1     │ │   B2     │ │  ➕   │ │
│  │ Básico   │ │ Básico+  │ │Intermedio│ │Intermedio+│ │AGREGAR│ │
│  │10 lecc.  │ │10 lecc.  │ │10 lecc.  │ │10 lecc.  │ │ NIVEL │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────┘ │
│       │                                                         │
│       │ click                                                   │
│       ▼                                                         │
│  PASO 2: LECCIONES (del nivel A1)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 1. Present Simple          15 min    [editar] [eliminar]   ││
│  │ 2. Present Simple (basic)  15 min    [editar] [eliminar]   ││
│  │ 3. Articles: a/an/the      10 min    [editar] [eliminar]   ││
│  │ 4. There is/There are      12 min    [editar] [eliminar]   ││
│  │                                                             ││
│  │                    [➕ AGREGAR LECCIÓN]                     ││
│  └─────────────────────────────────────────────────────────────┘│
│       │                                                         │
│       │ click en lección                                        │
│       ▼                                                         │
│  PASO 3: EJERCICIOS (de la lección "Present Simple")           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Ejercicio 1: Multiple Choice                                ││
│  │   "Choose the correct verb: We ___ coffee"                  ││
│  │   Opciones: like, likes, likeing, likeed                    ││
│  │   Correcta: like                                [editar][❌]││
│  │                                                             ││
│  │ Ejercicio 2: Speaking                                       ││
│  │   "Pronounce: I like coffee"                   [editar][❌] ││
│  │                                                             ││
│  │                    [➕ AGREGAR EJERCICIO]                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## TAREA 1: Agregar Niveles

### ¿Qué debe hacer?
El admin puede crear nuevos niveles como C1, C2, o cualquier otro.

### Formulario "Agregar Nivel"
```
┌────────────────────────────────────┐
│      ➕ AGREGAR NUEVO NIVEL        │
├────────────────────────────────────┤
│                                    │
│  Código: [_C1_______________]      │
│                                    │
│  Descripción: [_Avanzado____]      │
│                                    │
│  Orden: [_5_]                      │
│                                    │
│  [Cancelar]  [Guardar]             │
│                                    │
└────────────────────────────────────┘
```

### Campos
| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| Código | Nombre corto del nivel | C1, C2 |
| Descripción | Nombre largo | Avanzado, Experto |
| Orden | Posición en la lista | 5, 6 |

---

## TAREA 2: Agregar Lecciones (dentro de un nivel)

### ¿Qué debe hacer?
Después de seleccionar un nivel (ej: A1), el admin puede agregar lecciones.

### Formulario "Agregar Lección"
```
┌────────────────────────────────────┐
│   ➕ AGREGAR LECCIÓN (Nivel A1)    │
├────────────────────────────────────┤
│                                    │
│  Título: [_Present Continuous__]   │
│                                    │
│  Duración (min): [_15_]            │
│                                    │
│  Orden: [_11_]                     │
│                                    │
│  [Cancelar]  [Guardar]             │
│                                    │
└────────────────────────────────────┘
```

### Campos
| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| Título | Nombre de la lección | Present Continuous |
| Duración | Tiempo estimado en minutos | 15 |
| Orden | Posición en el path | 11 |

---

## TAREA 3: Agregar Ejercicios (dentro de una lección)

### ¿Qué debe hacer?
Después de seleccionar una lección, el admin puede agregar ejercicios.

### Formulario "Agregar Ejercicio"
```
┌─────────────────────────────────────────────┐
│   ➕ AGREGAR EJERCICIO (Present Simple)     │
├─────────────────────────────────────────────┤
│                                             │
│  Tipo de ejercicio:                         │
│  ○ Multiple Choice                          │
│  ○ Speaking                                 │
│  ○ Word Order (ordenar palabras)            │
│  ○ Fill in the Blank                        │
│  ○ Listening                                │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Pregunta: [_Choose the correct verb..._]   │
│                                             │
│  Opción 1: [_like___] ☑ Correcta            │
│  Opción 2: [_likes__]                       │
│  Opción 3: [_likeing_]                      │
│  Opción 4: [_likeed_]                       │
│  [+ Agregar opción]                         │
│                                             │
│  Tip del Coach (opcional):                  │
│  [_En Present Simple, con he/she/it..._]   │
│                                             │
│  [Cancelar]  [Guardar]                      │
│                                             │
└─────────────────────────────────────────────┘
```

### Campos según tipo de ejercicio

**Multiple Choice:**
| Campo | Descripción |
|-------|-------------|
| Pregunta | La pregunta a mostrar |
| Opciones | Lista de respuestas posibles |
| Respuesta correcta | Cuál opción es la correcta |
| Tip del Coach | Consejo opcional |

**Speaking:**
| Campo | Descripción |
|-------|-------------|
| Texto a pronunciar | Lo que el usuario debe decir |
| Tip del Coach | Consejo opcional |

**Word Order:**
| Campo | Descripción |
|-------|-------------|
| Palabras desordenadas | Lista de palabras |
| Orden correcto | El orden de la oración correcta |
| Tip del Coach | Consejo opcional |

---

---

## SECCIÓN: USUARIOS (`/admin/users`)

### ❌ PROBLEMAS ACTUALES

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ USUARIO              │ NIVEL │ XP │ RACHA │ ÚLTIMA CONEXIÓN │ ESTADO │ ROL       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ emanuel otero        │  A1   │ 0  │  0    │     Nunca       │ Activo │ Estudiante│
│ emmanuelotero82@... │       │    │       │                 │        │           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Proyecto             │  —    │ 0  │  0    │     Nunca       │ Activo │ Estudiante│
│ ❌ SIN EMAIL         │       │    │       │                 │        │           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Let's Speak English  │  —    │ 0  │  0    │     Nunca       │ Activo │ Estudiante│
│ ❌ SIN EMAIL         │ ❌    │ ❌ │  ❌   │      ❌         │        │           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### BUGS A CORREGIR

| # | Bug | Descripción | Prioridad |
|---|-----|-------------|-----------|
| 1 | **Email no se muestra** | Algunos usuarios no muestran su email | 🔴 Alta |
| 2 | **Nivel muestra "—"** | No toma el nivel real del usuario | 🔴 Alta |
| 3 | **XP siempre en 0** | No toma los datos reales de XP | 🔴 Alta |
| 4 | **Racha siempre en 0** | No calcula/muestra la racha real | 🔴 Alta |
| 5 | **Última conexión "Nunca"** | No registra cuándo el usuario se conectó | 🔴 Alta |
| 6 | **Estado no bloquea** | Al deshabilitar usuario, sigue pudiendo entrar | 🔴 Crítico |

### CÓMO DEBE FUNCIONAR

**1. Email:**
- Mostrar el email de todos los usuarios registrados

**2. Nivel:**
- Mostrar el nivel actual del usuario (A1, A2, B1, etc.)
- Si no tiene nivel asignado, mostrar "Sin nivel" en vez de "—"

**3. XP (Puntos de experiencia):**
- Mostrar el XP real acumulado del usuario
- Se gana XP al completar lecciones/ejercicios

**4. Racha:**
- Mostrar días consecutivos de práctica
- Calcular basado en la actividad diaria del usuario

**5. Última conexión:**
- Registrar y mostrar la fecha/hora de última conexión
- Formato: "Hace 2 horas", "Ayer", "15/01/2026"

**6. Estado (Activo/Inactivo):**
- Al marcar usuario como "Inactivo" debe:
  - Bloquear el login del usuario
  - Mostrar mensaje "Tu cuenta ha sido deshabilitada" al intentar entrar
  - El usuario NO debe poder acceder a la app

---

## SECCIÓN: DASHBOARD (`/admin`)

### ❌ PROBLEMAS ACTUALES

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DASHBOARD                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │ Usuarios     │ │ Usuarios     │ │ Lecciones    │ │ Preguntas         │  │
│  │ Registrados  │ │ Activos      │ │ Creadas      │ │ Diagnósticas      │  │
│  │     14       │ │     14       │ │     40       │ │      499          │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └───────────────────┘  │
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │ Nuevos esta semana      │  │ Lecciones completadas                   │  │
│  │        +0  ❌            │  │           0  ❌                         │  │
│  └─────────────────────────┘  └─────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### BUGS A CORREGIR

| # | Bug | Descripción | Prioridad |
|---|-----|-------------|-----------|
| 1 | **Nuevos esta semana siempre +0** | No cuenta los usuarios nuevos registrados | 🔴 Alta |
| 2 | **Lecciones completadas en 0** | No cuenta las lecciones que los usuarios han completado | 🔴 Alta |
| 3 | **Falta fecha de registro** | En la tabla de usuarios no se ve cuándo se registró | 🔴 Alta |

### CÓMO DEBE FUNCIONAR

**1. Nuevos esta semana:**
- Contar usuarios registrados en los últimos 7 días
- Mostrar el número real (+3, +5, etc.)

**2. Lecciones completadas:**
- Contar el total de lecciones completadas por TODOS los usuarios
- Actualizar en tiempo real

**3. Fecha de registro (en tabla Usuarios):**
- Agregar columna "Fecha registro" o "Miembro desde"
- Formato: "03/02/2026" o "Hace 3 días"

---

## SECCIÓN: NOTIFICACIONES (`/admin/notifications`)

### ❌ PROBLEMAS ACTUALES

```
┌─────────────────────────────────────────────────────────────────┐
│                       NOTIFICACIONES                            │
│                   Total: 0 notificaciones                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Todas]  [Pendientes]  [Enviadas]      [+ Nueva Notificación]  │
│                                                                 │
│                         🔔                                      │
│                  No hay notificaciones                          │
│               "Crear primera notificación"                      │
│                                                                 │
│            ❌ LA FUNCIÓN NO ESTÁ ACTIVA                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### BUGS A CORREGIR

| # | Bug | Descripción | Prioridad |
|---|-----|-------------|-----------|
| 1 | **Crear notificación no funciona** | El botón "+ Nueva Notificación" no hace nada o no guarda | 🔴 Alta |
| 2 | **No se envían a usuarios** | Las notificaciones no llegan a los usuarios | 🔴 Alta |
| 3 | **Tabs no filtran** | Todas/Pendientes/Enviadas no funcionan | 🟡 Media |

### CÓMO DEBE FUNCIONAR

**1. Crear notificación:**
```
┌────────────────────────────────────────┐
│     ➕ NUEVA NOTIFICACIÓN              │
├────────────────────────────────────────┤
│                                        │
│  Título: [_Nuevo curso disponible__]   │
│                                        │
│  Mensaje:                              │
│  [_Ya puedes acceder al nivel B2..._]  │
│                                        │
│  Enviar a:                             │
│  ○ Todos los usuarios                  │
│  ○ Solo nivel específico [A1 ▼]        │
│  ○ Usuario específico [Buscar...]      │
│                                        │
│  [Cancelar]  [Enviar]                  │
│                                        │
└────────────────────────────────────────┘
```

**2. Lista de notificaciones:**
- Mostrar historial de notificaciones enviadas
- Ver cuántos usuarios la recibieron/leyeron
- Filtrar por: Todas, Pendientes, Enviadas

**3. Usuarios reciben notificación:**
- Aparece en la campanita de la app
- Puede marcarla como leída

---

## RESUMEN DE TAREAS

### Lecciones (Admin)
| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| 1 | Poder agregar NUEVOS NIVELES (C1, C2, etc.) | 🔴 Pendiente | Los tabs actuales son fijos |
| 2 | Arreglar formulario de agregar LECCIÓN | 🔴 Pendiente | Debe estar dentro de un nivel |
| 3 | Poder agregar EJERCICIOS dentro de lección | 🔴 Pendiente | Formulario dinámico según tipo |
| 4 | Editar niveles existentes | 🔴 Pendiente | |
| 5 | Editar lecciones existentes | 🔴 Pendiente | |
| 6 | Editar ejercicios existentes | 🔴 Pendiente | |

### Usuarios (Admin)
| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| 7 | Mostrar email de todos los usuarios | 🔴 Pendiente | Algunos no se muestran |
| 8 | Mostrar nivel real del usuario | 🔴 Pendiente | Muestra "—" |
| 9 | Activar/mostrar XP real | 🔴 Pendiente | Siempre muestra 0 |
| 10 | Activar/mostrar Racha real | 🔴 Pendiente | Siempre muestra 0 |
| 11 | Activar última conexión | 🔴 Pendiente | Siempre muestra "Nunca" |
| 12 | Arreglar bloqueo de usuarios | 🔴 Crítico | Usuario deshabilitado sigue entrando |

### Dashboard (Admin)
| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| 13 | Activar "Nuevos esta semana" | 🔴 Pendiente | Siempre muestra +0 |
| 14 | Activar "Lecciones completadas" | 🔴 Pendiente | Siempre muestra 0 |
| 15 | Agregar fecha de registro en usuarios | 🔴 Pendiente | Ver cuándo se registró cada usuario |

### Notificaciones (Admin)
| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| 16 | Activar crear notificación | 🔴 Pendiente | No funciona el formulario |
| 17 | Hacer que notificaciones lleguen a usuarios | 🔴 Pendiente | No se envían |
| 18 | Activar filtros (Todas/Pendientes/Enviadas) | 🟡 Pendiente | No filtran |

---

## NAVEGACIÓN ESPERADA

```
/admin/niveles
    → Lista de niveles + botón agregar nivel

/admin/niveles/:nivelId/lecciones
    → Lista de lecciones del nivel + botón agregar lección

/admin/niveles/:nivelId/lecciones/:leccionId/ejercicios
    → Lista de ejercicios + botón agregar ejercicio
```

---

## DEPENDENCIAS

| Qué se necesita | Responsable | Estado |
|-----------------|-------------|--------|
| API CRUD Niveles | Compañero | 🔴 Pendiente |
| API CRUD Lecciones | Compañero | 🔴 Pendiente |
| API CRUD Ejercicios | Compañero | 🔴 Pendiente |

---

## HISTORIAL

| Fecha | Cambio |
|-------|--------|
| 2026-02-03 | Documento creado con especificación visual |
| 2026-02-03 | Agregada sección USUARIOS con 6 bugs a corregir |
| 2026-02-03 | Agregada sección DASHBOARD con 3 bugs a corregir |
| 2026-02-03 | Agregada sección NOTIFICACIONES con 3 bugs a corregir |

