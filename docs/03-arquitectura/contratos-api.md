# Contratos de API

> Convenciones, formato de error y catálogo de endpoints. El contrato se declara en `packages/shared` con Zod y se documenta con Swagger.

---

## 1. Convenciones generales

| Aspecto | Regla |
|---------|-------|
| Base URL | `/api` |
| Versión | Prefijo `/api/v1` para cambios incompatibles |
| Formato | JSON (`application/json`) |
| Fechas | ISO 8601 UTC (`2026-10-26T14:30:00.000Z`) |
| Identificadores | `cuid()` como string |
| Nombres de campo | `camelCase` |
| Paginación | `?page=1&pageSize=20` (máx. 100) |
| Ordenamiento | `?sort=createdAt:desc` |
| Autenticación | Cookie `access_token` httpOnly + `Authorization: Bearer` para clientes externos |

---

## 2. Formato de error único

Todas las respuestas de error comparten **la misma forma**. Sin excepciones.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El campo email no es válido",
    "details": [
      { "field": "email", "message": "Debe ser un correo válido" }
    ],
    "traceId": "ckv2n3x0a0001qz8h2b3c4d5e"
  }
}
```

### Catálogo de códigos

| HTTP | `code` | Cuándo |
|------|--------|--------|
| 400 | `VALIDATION_ERROR` | Datos de entrada inválidos |
| 401 | `UNAUTHENTICATED` | Sin token o token inválido/expirado |
| 403 | `FORBIDDEN` | Autenticado pero sin permiso |
| 404 | `NOT_FOUND` | Recurso inexistente |
| 409 | `CONFLICT` | Duplicado o estado incompatible |
| 422 | `RULE_VIOLATION` | Regla de negocio incumplida (p. ej. unidad bloqueada) |
| 429 | `RATE_LIMITED` | Demasiadas solicitudes |
| 500 | `INTERNAL_ERROR` | Error inesperado (nunca expone stack) |
| 503 | `SERVICE_UNAVAILABLE` | Dependencia caída (IA, sandbox) |

> **Prohibido:** devolver `{ "message": "..." }` suelto o un string plano. Los agentes y el frontend dependen de esta forma.

---

## 3. Paginación

**Request:** `GET /api/content/units?page=2&pageSize=20&sort=order:asc`

**Response:**

```json
{
  "data": [ ],
  "meta": {
    "page": 2,
    "pageSize": 20,
    "total": 147,
    "totalPages": 8
  }
}
```

**Regla:** los listados **siempre** devuelven `{ data, meta }`, nunca un array suelto.

---

## 4. Endpoints por módulo

> **Estado del contrato (2026-10-27):** implementados `GET /api/health` (S0), `/api/auth/*` (S1) y `/api/content/*` (S2), con el contrato ampliado en S3 (`units` en el módulo y `stageId` en la unidad) y consumido por la web en `/learn/*`. El resto de endpoints describe el **contrato objetivo** y se implementa en los sprints S4–S11 según el [`roadmap`](../04-plan-ejecucion/roadmap-sprints.md).

### 4.1 Autenticación (`/api/auth`) — ✅ implementado en S1

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/register` | — | Crea cuenta. Body: `{ email, password, name }` |
| POST | `/login` | — | Devuelve cookies + `{ user }` |
| POST | `/refresh` | cookie | Renueva access token |
| POST | `/logout` | cookie | Revoca refresh token |
| GET | `/me` | ✅ | Usuario actual |

**POST `/api/auth/register`**

```json
// Request
{ "email": "ana@example.com", "password": "S3gura!pass", "name": "Ana" }

// 201 Response
{
  "user": {
    "id": "ckv...",
    "email": "ana@example.com",
    "name": "Ana",
    "role": "STUDENT",
    "createdAt": "2026-10-26T14:30:00.000Z"
  }
}
```

**Reglas de contraseña:** mínimo 8 caracteres, al menos una letra y un número. El hash (bcrypt, coste 12) nunca se devuelve.

**Cookies de sesión**

| Cookie | Contenido | `Path` | TTL | Flags |
|--------|-----------|--------|-----|-------|
| `access_token` | JWT HS256 (`sub`, `email`, `role`) | `/` | 15 min | `HttpOnly`, `SameSite=Lax`, `Secure` en producción |
| `refresh_token` | 48 bytes aleatorios (base64url) | `/api/auth` | 7 días | `HttpOnly`, `SameSite=Lax`, `Secure` en producción |

**Comportamiento**

- `POST /register` → `201`; `409 CONFLICT` si el correo ya existe; `429` + `Retry-After` al superar 3 registros/hora por IP.
- `POST /login` → `200`; `401 UNAUTHENTICATED` con un mensaje único (no revela si el correo existe); `429` al superar 5 intentos/15 min por IP + email.
- `POST /refresh` rota el refresh token; reutilizar uno revocado invalida **toda** la familia de sesiones y devuelve `401`.
- `POST /logout` → `204`, idempotente, y borra ambas cookies.
- `GET /me` acepta la cookie `access_token` o `Authorization: Bearer`.
- Las respuestas de auth solo incluyen `{ user }`; nunca `passwordHash` ni tokens en el cuerpo.

### 4.2 Contenido (`/api/content`) — ✅ implementado en S2

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/stages` | — | Etapas publicadas (`?page&pageSize&level`) |
| GET | `/stages/:id` | — | Etapa con módulos |
| GET | `/units/:code` | opcional | Unidad con lecciones y ejercicios (oculta soluciones) |
| GET | `/lessons/:slug` | opcional | Lección con bloques de contenido |
| GET | `/resources` | — | Recursos verificados (`?page&pageSize&stage&type`) |

- Módulo de **solo lectura**: no hay mutaciones de contenido en el contrato.
- Filtro de publicación en el adaptador: solo etapas publicadas, elementos con ancestros publicados y recursos `VERIFIED`. En la semilla eso son 4 etapas (E0–E3); E4–E11 quedan como borrador.
- Paginación 1-based: `skip = (page - 1) × pageSize`, `totalPages = ceil(total / pageSize)` (0 si no hay coincidencias).
- `:id`, `:code` y `:slug` se validan antes de llegar al servicio, así que un formato inválido devuelve `400 VALIDATION_ERROR` con `details[].field` en vez de un `404` engañoso.
- `solution`, `sources` y pruebas ocultas no se seleccionan en la consulta: nunca salen de la base de datos.

**Ampliación de S3: `units` en el módulo y `stageId` en la unidad**

```json
{
  "stage": {
    "id": 1,
    "modules": [
      {
        "id": "cmvpiam7600111dic1x2obsqq",
        "code": "M1.1",
        "order": 1,
        "unitCount": 4,
        "units": [
          {
            "id": "cmvpiam7900131dicnddo43lt",
            "code": "U1.1.1",
            "title": "Algoritmos y pseudocódigo",
            "stageId": 1,
            "moduleCode": "M1.1",
            "order": 1,
            "estimatedMin": null,
            "prerequisiteIds": []
          }
        ]
      }
    ]
  }
}
```

- `units` viaja **dentro de cada módulo**, ordenado por `order` ascendente y sin elementos no publicados: una sola petición pinta la etapa completa. `unitCount` se deriva de esa misma lista, así que nunca discrepan.
- `stageId` es obligatorio en `UnitSummary` y es el dato con el que la web pide la etapa desde la vista de unidad (migas y navegación anterior/siguiente). El cliente **no** deduce la etapa parseando `U0.1.1`.
- `GET /api/content/units/:code` devuelve `{ unit }` con `lessons` y `exercises` (listas vacías hoy, porque la semilla no siembra lecciones) y sigue sin exponer `solution` ni `sources`.
- Verificado por HTTP el 2026-10-27 (S3-T9): `stages/1` devuelve 5 módulos con sus unidades ordenadas y `units/U0.1.1` responde `stageId: 0` con `lessons: []`.

### 4.3 Ejercicios (`/api/exercises`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/units/:unitCode` | ✅ | Ejercicios de la unidad (sin `solution`, sin tests ocultos) |
| GET | `/:id` | ✅ | Detalle del ejercicio |
| POST | `/:id/hints` | ✅ | Solicita pista. Body: `{ level }` |
| POST | `/:id/submissions` | ✅ | Envía solución |
| GET | `/:id/submissions` | ✅ | Historial propio |
| POST | `/:id/quiz-answers` | ✅ | Corrige un `QUIZ` en el servidor. Body: `{ optionId }` (`a`–`d`). Responde `{ result: { correct, correctOptionId, explanation, correctExplanation } }`; la respuesta correcta y las explicaciones salen **solo después** del intento. `400` si no es un quiz o la opción no existe; `409` si agotó `maxAttempts` |
| POST | `/:id/flashcard-reveal` | ✅ | Registra el intento de recuerdo y devuelve el reverso. Body: `{ attempt }` (no vacío). Responde `{ back }` |
| POST | `/:id/flashcard-ratings` | ✅ | Autocalificación SM-2. Body: `{ quality }` (0–5). Solo válida justo después de revelar (`409` si no); responde `{ scheduled }` y reprograma el ítem de repaso |

QUIZ y FLASHCARD no usan el sandbox. Sus envíos se guardan como `Submission` (opción elegida, intento o `quality:N`), por lo que cuentan para `maxAttempts` y para el repaso.

**POST `/api/exercises/:id/submissions`**

```json
// Request
{
  "code": "export async function fetchUser(id) { ... }",
  "selfExplanation": "Uso try/catch y valido el status antes de parsear."
}

// 201 Response
{
  "submission": {
    "id": "ckx...",
    "outcome": "PARTIAL",
    "score": 75,
    "achievedLevel": 3,
    "hintsUsed": 1,
    "results": [
      { "testId": "t1", "passed": true,  "name": "devuelve el usuario" },
      { "testId": "t2", "passed": true,  "name": "lanza UserNotFoundError" },
      { "testId": "hidden-1", "passed": false, "name": "prueba oculta" }
    ],
    "feedback": "2 de 3 pruebas superadas. Revisa el caso de reintento."
  }
}
```

> Los tests ocultos devuelven **solo el resultado agregado**, nunca su contenido.

### 4.4 Progreso (`/api/progress`) — ✅ implementado en S4

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/overview` | ✅ | Resumen global: etapas, competencias, pendientes |
| GET | `/units` | ✅ | Estado de todas las unidades del usuario |
| GET | `/competencies` | ✅ | Niveles C1–C14 |
| POST | `/units/:id/complete-lesson` | ✅ | Marca lección vista (no acredita) |

**GET `/api/progress/overview`**

```json
{
  "user": { "id": "ckv...", "name": "Ana" },
  "currentStage": 2,
  "overallPct": 34.5,
  "units": { "mastered": 12, "inProgress": 3, "needsReview": 2, "locked": 40 },
  "competencies": [
    { "code": "C1", "level": 3, "evidenceCount": 14 },
    { "code": "C4", "level": 2, "evidenceCount": 6 }
  ],
  "dueReviews": 7
}
```

**Resto de rutas** (todas exigen cookie de sesión; sin ella responden `401 UNAUTHENTICATED`):

| Ruta | Respuesta |
|------|-----------|
| `GET /units` | `{ "units": UnitProgressSummary[] }` |
| `GET /competencies` | `{ "competencies": CompetencyProgress[] }`, con C1–C14 completos y nivel 0 en las que no tienen evidencia |
| `POST /units/:id/complete-lesson` | `200 { "unit": UnitProgressSummary }`; cuerpo `{ "lessonId": "..." }` |

**Idempotencia:** `complete-lesson` guarda las lecciones vistas en `UnitProgress.completedLessonIds`, así que repetir la misma lección no cambia el porcentaje. Responde `404 NOT_FOUND` si la unidad o la lección no existen (o si la lección no pertenece a la unidad) y `409 CONFLICT` si la unidad está bloqueada. Nunca acredita `MASTERED`: eso lo decide la evaluación de S6.

### 4.5 Repaso (`/api/review`) — ✅ implementado en S7

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/queue` | ✅ | Ítems vencidos (máx. 30), intercalados por concepto |
| POST | `/items/:id/answer` | ✅ | Registra calidad y recalcula SM-2 |

**GET `/api/review/queue`**

```json
{
  "items": [
    {
      "id": "ckx…",
      "exerciseId": "ckx…",
      "exerciseTitle": "Suma segura",
      "exerciseSlug": "suma-segura-001",
      "concept": "funciones",
      "competencies": ["C1"],
      "dueAt": "2026-10-28T09:00:00.000Z",
      "intervalDays": 1,
      "repetitions": 1,
      "easeFactor": 2.6,
      "priority": 0
    }
  ],
  "dueReviews": 7,
  "limit": 30
}
```

**POST `/api/review/items/:id/answer`**

```json
// Request
{ "quality": 4, "durationMs": 42000 }

// 200 Response
{
  "nextDueAt": "2026-11-02T14:30:00.000Z",
  "intervalDays": 6,
  "easeFactor": 2.6,
  "repetitions": 2
}
```

**Reglas del repaso**

- La cola se ordena por `priority` desc y `dueAt` asc, y se **intercala por concepto** antes de servirse: al menos el 30 % de las parejas adyacentes mezcla conceptos (`prerequisitos-y-progreso.md` §5.3).
- `dueReviews` cuenta **todos** los vencidos, no sólo los 30 servidos; el límite diario es `REVIEW_QUEUE_MAX = 30`.
- `quality` es un entero 0–5; el servidor aplica SM-2 y nunca acepta un intervalo calculado por el cliente.
- `durationMs` se valida y todavía **no se persiste**: `ReviewLog` (`modelo-datos.md` §5) no tiene columna de duración; su análisis es de S11.
- `404 NOT_FOUND` si el ítem no existe o pertenece a otro estudiante (`contratos-api.md` §5).
- Cada respuesta añade una fila a `ReviewLog` y actualiza el único ítem del usuario para ese ejercicio.

### 4.6 Sandbox (`/api/sandbox`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/run` | ✅ | Ejecución libre (límite por minuto) |
| GET | `/status` | ✅ | Salud del servicio de ejecución |

### 4.7 Tutor IA (`/api/ai`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/tutor` | ✅ | Mensaje al tutor con contexto de la lección |
| POST | `/explain-error` | ✅ | Explica un error de código |
| GET | `/usage` | ✅ | Consumo propio del mes |

**POST `/api/ai/tutor`**

```json
// Request
{ "lessonId": "ck...", "message": "No entiendo por qué falla el await", "history": [] }

// 200 Response
{
  "reply": "Antes de responderte: ¿qué crees que devuelve fetch cuando el estado es 404?",
  "suggestedHints": ["respuesta-http", "promesas"],
  "tokensUsed": 412,
  "budgetRemainingUsd": 4.98,
  "source": "provider",
  "filtered": false
}
```

- `source`: `provider` (llamada real), `cache` (misma pregunta en la lección en 24 h, `tokensUsed: 0`) o `fallback` (presupuesto agotado o proveedor caído, `tokensUsed: 0`). La degradación **siempre** responde `200`.
- `filtered: true` indica que el backend sustituyó la respuesta por una pista segura (solución literal o bloque de código casi idéntico a la oficial).
- `suggestedHints` ≤ 3 y siempre subconjunto de `Exercise.concepts` de la unidad.
- Errores: `400 VALIDATION_ERROR` (mensaje vacío o > 2000, `history` > 10, `role: "system"`), `401`, `404` (lección inexistente o no publicada), `429 RATE_LIMITED` con `Retry-After`.

**POST `/api/ai/explain-error`**

```json
// Request
{ "submissionId": "ck..." }

// 200 Response
{
  "explanation": "Tu función devuelve antes de esperar la promesa. ¿Qué imprime el console.log de la línea 4?",
  "errorCategory": "async",
  "suggestedHints": ["funciones", "promesas"],
  "tokensUsed": 214,
  "budgetRemainingUsd": 4.97,
  "source": "provider",
  "filtered": false
}
```

Sólo explica envíos **propios**: un `submissionId` ajeno o inexistente es `404`; un envío sin código (quiz, reflexión) es `422 RULE_VIOLATION`.

**GET `/api/ai/usage`**

```json
// 200 Response
{
  "month": "2026-10",
  "spentUsd": 3.62,
  "budgetUsd": 5,
  "remainingUsd": 1.38,
  "percentUsed": 72.4,
  "level": "economy",
  "interactions": 27
}
```

`level`: `normal` (< 70 %), `economy` (70–90 %), `tutor_only` (90–100 %), `disabled` (≥ 100 %). El mes es UTC y `interactions` sólo cuenta llamadas reales (la caché no).

> El tutor **no entrega la solución completa**. El prompt del sistema lo prohíbe explícitamente y los filtros del backend lo refuerzan (ver [`capa-ia.md`](capa-ia.md)).

### 4.8 Analítica (`/api/analytics`)

| Método | Ruta | Auth | Rol | Descripción |
|--------|------|------|-----|-------------|
| GET | `/me/summary` | ✅ | student | Progreso, tiempo, errores frecuentes |
| GET | `/me/errors` | ✅ | student | Categorías de error más repetidas |
| GET | `/cohort` | ✅ | instructor | Agregados de la cohorte |

---

### 4.9 Sistema (`/health`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/health` | — | Estado del servicio. **Implementado en S0** |

**GET `/api/health` → 200**

```json
{
  "status": "ok",
  "service": "codeai-api",
  "version": "0.1.0",
  "uptimeSeconds": 128,
  "timestamp": "2026-10-26T14:30:00.000Z"
}
```

**Reglas:**

- No expone secretos, rutas internas ni estado de dependencias todavía (se amplía en S11 con `ready`).
- Devuelve cabecera `x-trace-id` como el resto de la API.
- El contrato vive en `packages/shared` (`healthResponseSchema` / `HealthResponse`).

---

### 4.10 Usuarios (`/api/users`) — ✅ implementado (2026-10-28)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/me` | ✅ | Perfil del usuario del token |
| PATCH | `/me` | ✅ | Nombre, avatar o idioma |
| GET | `/` | 🎓 `ADMIN` | Listado paginado con filtro por rol y búsqueda |

**GET `/api/users/me` → 200**

```json
{
  "user": {
    "id": "ckv9x1",
    "email": "ana@example.com",
    "name": "Ana",
    "role": "STUDENT",
    "createdAt": "2026-10-20T09:00:00.000Z",
    "avatarUrl": null,
    "locale": "es"
  }
}
```

**PATCH `/api/users/me`** — cuerpo con **al menos un** campo; `.strict()` rechaza claves desconocidas:

```json
{ "name": "Ana Ruiz", "avatarUrl": "https://cdn.example.com/ana.png", "locale": "es-ES" }
```

| Campo | Regla |
|-------|-------|
| `name` | 2–80 caracteres, el mismo `nameSchema` del registro |
| `avatarUrl` | `http(s)` y ≤ 2048 caracteres, o `null` para borrarlo; omitirlo lo conserva |
| `locale` | Etiqueta BCP 47 corta (`es`, `es-ES`, `en`), ≤ 15 caracteres |

**GET `/api/users?role&search&page&pageSize` → 200**

```json
{
  "data": [
    {
      "id": "ckv9x1",
      "email": "ana@example.com",
      "name": "Ana",
      "role": "STUDENT",
      "createdAt": "2026-10-20T09:00:00.000Z",
      "avatarUrl": null,
      "locale": "es"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 41, "totalPages": 3 }
}
```

**Reglas:**

- El `userId` **solo** sale del token (`AccessTokenPayload.sub`): no existe `/users/:id` y ningún cuerpo o parámetro puede apuntar a otro usuario. `GET /api/users` es la única ruta de alcance global y exige `ADMIN`.
- Un token todavía vigente de una cuenta desactivada responde `404 NOT_FOUND` con el mismo texto que un usuario inexistente: el estado de la cuenta no se filtra (`getProfile` y `updateProfile` lo comprueban antes de escribir).
- `PATCH` vacío, con clave desconocida o con `avatarUrl` no http(s) → `400 VALIDATION_ERROR`. Se rechazan `data:` y `javascript:` porque el avatar acaba en un `<img src>`.
- `GET /api/users` sin cookie → `401 UNAUTHENTICATED`; con `STUDENT` o `INSTRUCTOR` → `403 FORBIDDEN`. `search` exige ≥ 2 caracteres y `pageSize` no pasa de 100; nunca se listan cuentas inactivas.
- El rol se lee del **token**, no de la base: cambiar el rol de un usuario surte efecto cuando renueva la sesión (15 min de access token). Es la misma regla de `RolesGuard` en S9.
- Contrato en `packages/shared/src/schemas/user.ts` (`userProfileSchema`, `updateProfileSchema`, `userListQuerySchema`, `userListResponseSchema`); `userProfileSchema` **amplía** `userPublicSchema` de S1 sin cambiarlo, así que `/api/auth/*` sigue devolviendo `UserPublic`.

---

### 4.11 Proyectos, rúbricas y portafolio (`/api/projects`, `/api/portfolio`) — ✅ implementado (2026-10-28)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/projects?stage&page&pageSize` | ✅ | Catálogo paginado de proyectos publicados |
| GET | `/api/projects/:slug` | ✅ | Enunciado, rúbrica, competencias y entregas propias |
| POST | `/api/projects/:slug/submissions` | ✅ | Registrar una entrega (acumulable) |
| POST | `/api/projects/submissions/:id/review` | 🎓 `INSTRUCTOR`/`ADMIN` | Revisar con la rúbrica completa |
| POST | `/api/projects/submissions/:id/publish` | ✅ autor | Publicar la entrega en el portafolio |
| POST | `/api/projects/submissions/:id/unpublish` | ✅ autor | Retirarla del portafolio |
| GET | `/api/portfolio/me` | ✅ | Portafolio propio, incluidas las privadas |
| GET | `/api/portfolio/:userId` | — público | Portafolio público, sólo entregas publicadas |

**Tipos.** `ProjectCriterion` es `correctitud | calidad | pruebas | seguridad | justificacion`; `ProjectSubmissionStatus` es `SUBMITTED | REVIEWED`. La rúbrica (`Project.rubric`) es `Json` y se valida con `projectRubricSchema`: exactamente **5 criterios distintos**, pesos enteros que **suman 100**, y **cuatro anclajes** por criterio en orden 1–4 (`anchor` ≤ 280 caracteres). `correctitudGate` debe ser `true`.

**GET `/api/projects` → 200**

```json
{
  "data": [
    {
      "id": "prj_1",
      "slug": "entorno-reproducible",
      "stageId": 0,
      "title": "Entorno reproducible",
      "brief": "Deja un repositorio que arranque en cualquier máquina.",
      "requirements": ["README con requisitos", "Script de verificación"],
      "isPublished": true,
      "submitted": false
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

Sólo se listan proyectos publicados. `submitted` se calcula con las entregas del **usuario del token**, nunca de otro.

**GET `/api/projects/:slug` → 200 (ProjectDetail)** añade `rubric`, `competencies` (C1–C14 declaradas), `bestScore` (mejor nota propia, `null` sin revisión) y `mySubmissions` (sólo del autor, más reciente primero). La rúbrica se valida antes de publicarse: una fila corrupta responde `500`, no una nota inventada.

**POST `/api/projects/:slug/submissions` → 201 (ProjectSubmission)** con `.strict()`:

```json
{
  "repoUrl": "https://github.com/ana/entorno",
  "deployUrl": "https://entorno.vercel.app",
  "notes": "Elegí un script único de verificación."
}
```

| Campo | Regla |
|-------|-------|
| `repoUrl` | **Obligatorio**, `http(s)`, ≤ 500 caracteres |
| `deployUrl` | Opcional, `http(s)` o `null`, ≤ 500 caracteres |
| `notes` | Opcional, ≤ 2000 caracteres; vacía se guarda como `null` |

`repoUrl` ausente, no http(s) o > 500 → `400 VALIDATION_ERROR` con `details[].field`. Proyecto inexistente o no publicado → `404 NOT_FOUND`. Cada llamada crea una fila nueva: las entregas no se sobrescriben.

**POST `/api/projects/submissions/:id/review` → 200 (ProjectSubmission)** con `.strict()`:

```json
{
  "rubricScores": {
    "correctitud": 4,
    "calidad": 4,
    "pruebas": 4,
    "seguridad": 4,
    "justificacion": 0
  },
  "feedback": "Falta explicar las decisiones del README."
}
```

| Regla | Respuesta |
|-------|-----------|
| Faltan criterios, sobran o un nivel no es entero 0–4 | `422 RULE_VIOLATION` (rúbrica incompleta) |
| `correctitud = 0` | `422 RULE_VIOLATION`; **no se persiste** y la entrega conserva su estado y nota anteriores |
| Rol `STUDENT` | `403 FORBIDDEN` |
| Nota resultante ≥ 80 | Escribe evidencia en `CompetencyProgress` del autor (nivel ≥ 3, `evidenceCount` +1, sin bajar el nivel alcanzado) |

**Cálculo de la nota** (`readRubric` + `scoreSubmission`, `apps/api/src/modules/projects/rubric.ts`):

```
nota(criterio) = peso(criterio) × nivel(criterio) / 4
score          = round(Σ nota, 2)
```

- Sin explicación propia en la entrega, `justificacion` vale **0** aunque el instructor la puntúe: resta el 15 % completo de la rúbrica base.
- Todos en nivel 3 → `75`; todos en 4 → `100`; 4/4/4/4 y sin explicación → `85`.

**Publicar y despublicar** son `POST` sin cuerpo y responden `200` con la entrega resultante. Sólo el autor puede hacerlo; un tercero recibe `404 NOT_FOUND` (no se confirma que la entrega exista). Despublicar limpia `publishedAt` y conserva la nota.

**GET `/api/portfolio/:userId` → 200 (PortfolioResponse)** es la primera ruta pública fuera de auth y contenido: no acepta cookie, sólo incluye entregas con `isPublic = true` ordenadas por `publishedAt` descendente y nunca devuelve `email` ni el rol del autor.

```json
{
  "user": { "id": "usr_1", "name": "Ana", "avatarUrl": null },
  "entries": [],
  "publicCount": 0
}
```

`GET /api/portfolio/me` exige sesión, incluye las privadas y `publicCount` cuenta sólo las públicas incluidas. Un `userId` inexistente → `404 NOT_FOUND`; un usuario sin entregas públicas → `200` con `entries: []`.

**Reglas:** `userId` sale siempre del token; las rutas `submissions/*` se declaran antes de `:slug/submissions` en el controlador; límite de **120 peticiones/minuto** por usuario en `/projects/*` y por IP en `/portfolio/:userId` (`429 RATE_LIMITED` con `Retry-After`). Contrato en `packages/shared/src/schemas/project.ts`.

---

### 4.12 Entrevistas (`/api/interviews`) — ✅ implementado (2026-10-28)

Entrevistas técnicas de práctica en texto: el servidor impone un guion de **seis fases** (`warmup`, `conceptual`, `live-coding`, `code-review`, `follow-ups`, `candidate-questions`), el estudiante responde y el instructor emite la nota con la rúbrica de `rubricas-evaluacion.md` §2.6. Todas las rutas exigen `JwtAuthGuard`; **`userId` sale siempre del token**. Sólo la revisión exige rol.

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| `GET` | `/api/interviews/scenarios?role&level&language&page&pageSize` | ✅ | `200` sobre `{ data, meta }` con escenarios publicados e `attempts` propios |
| `GET` | `/api/interviews/scenarios/:slug` | ✅ | `200` con fases y rúbrica; **nunca** `referenceSolution` |
| `POST` | `/api/interviews/sessions` | ✅ | `201` sesión `IN_PROGRESS` + primer turno del entrevistador |
| `GET` | `/api/interviews/sessions/me` | ✅ | `200` historial propio con `best` y `average` |
| `GET` | `/api/interviews/sessions/:id` | ✅ dueño · 🎓 | `200` con transcripción; ajeno → `404` idéntico a inexistente |
| `POST` | `/api/interviews/sessions/:id/messages` | ✅ dueño | `200` réplica del entrevistador |
| `POST` | `/api/interviews/sessions/:id/finish` | ✅ dueño | `200` sesión `COMPLETED` (idempotente) |
| `POST` | `/api/interviews/sessions/:id/self-review` | ✅ dueño | `200` con `selfScores` y `selfScore` |
| `POST` | `/api/interviews/sessions/:id/review` | 🎓 `INSTRUCTOR`/`ADMIN` | `200` sesión `REVIEWED` con nota y `feedback` |

**Escenario** (`GET …/scenarios/:slug`):

```json
{
  "slug": "backend-junior",
  "title": "Backend junior: API de tareas",
  "role": "backend",
  "level": "junior",
  "language": "ts",
  "competencies": ["C4", "C10"],
  "phaseCount": 6,
  "estimatedMinutes": 45,
  "attempts": 2,
  "phases": [
    { "phase": "warmup", "maxTurns": 2, "objective": "Romper el hielo." }
  ],
  "rubric": {
    "razonamiento": 30,
    "correctitud": 25,
    "comunicacion": 20,
    "seguimiento": 15,
    "limites": 10
  }
}
```

`role` ∈ `{ backend, frontend, fullstack, data, qa }`, `level` ∈ `{ junior, semi-senior, senior }`, `language` ∈ `{ ts, py, java, go }`. La rúbrica es **fija** (§2.6), suma 100 y no viaja al prompt del modelo.

**Sesión** (`POST /sessions` → `201`): estado `IN_PROGRESS → COMPLETED → REVIEWED`, con `ABANDONED` al leer una sesión sin actividad durante **48 h**. Una sola sesión `IN_PROGRESS` por usuario y escenario. `durationMinutes` se calcula al cerrar entre 1 y 240 minutos. La respuesta incluye `transcript` (`{ role: "interviewer" | "candidate", phase, content, at }[]`), `degraded`, `selfScores`, `scores` y `feedback`.

**Turno** (`POST …/messages` con `{ message }`, 1–2 000 caracteres y ≤ 400 líneas):

```json
{
  "reply": "Bien. Antes de escribir código: ¿qué harías si la lista tiene 10^6 elementos?",
  "phase": "conceptual",
  "turn": 3,
  "turnsRemaining": 37,
  "degraded": false,
  "budgetRemainingUsd": 4.82
}
```

- La fase y el turno los decide el **servidor por conteo** (`maxTurns` de cada fase), nunca el modelo.
- Tope duro de **40 turnos** por sesión; el 41 responde `429 TURN_LIMIT_REACHED` **antes** de llamar al proveedor.
- `degraded: true` cuando no hay proveedor (`AI_PROVIDER=mock`), el presupuesto está agotado, la respuesta se filtró por fuga o el proveedor falló. En ese caso la réplica es la estática de la fase y la sesión sigue siendo evaluable.
- El prompt recibe escenario, nivel, lenguaje y fase actual; **no** recibe rúbrica, nota ni solución de referencia. El filtro de fuga de S8 compara contra `referenceSolution`.

**Autoevaluación** (`POST …/self-review`) exige la sesión `COMPLETED`, los cinco criterios con enteros 0–4 y una `reflection` de 200–2 000 caracteres. La nota autoevaluada usa la fórmula de S9 **sin** la puerta de correctitud. Con 199 caracteres → `400 VALIDATION_ERROR`.

**Revisión** (`POST …/review`) exige `INSTRUCTOR`/`ADMIN`, autoevaluación previa y una sola emisión:

```json
{
  "scores": { "razonamiento": 4, "correctitud": 4, "comunicacion": 3, "seguimiento": 2, "limites": 3 },
  "feedback": "Razonamiento sólido; cuida el seguimiento.",
  "invalidate": false
}
```

- `feedback` es obligatorio salvo `invalidate: true`; una invalidación deja nota `0` y **no** escribe evidencia.
- `correctitud = 0` → `422 RULE_VIOLATION`; la revisión no se persiste.
- Nota ≥ **80** escribe evidencia de **C10** en `CompetencyProgress` del **autor** (nivel ≥ 3, `evidenceCount` +1, sin bajar el nivel alcanzado). Por debajo de 80 no escribe nada.
- La sesión guarda `scores = { rubric, levels, score }`: la rúbrica aplicada queda congelada con la nota.

**Errores propios** (el catálogo HTTP sigue siendo el de §2; el código específico va en el mensaje):

| Código | HTTP | Cuándo |
|--------|------|--------|
| `SCENARIO_NOT_FOUND` | `404` | Escenario inexistente o no publicado |
| `SESSION_NOT_FOUND` | `404` | Sesión inexistente **o ajena** (mismo texto) |
| `SESSION_IN_PROGRESS` | `409` | Ya hay una sesión abierta de ese escenario |
| `SESSION_CLOSED` | `409` | Turno/cierre/autoevaluación sobre una sesión cerrada o abandonada |
| `SESSION_ALREADY_REVIEWED` | `409` | Segunda revisión o cierre de una sesión ya revisada |
| `SELF_REVIEW_REQUIRED` | `409` | Revisión antes de la autoevaluación |
| `TURN_LIMIT_REACHED` | `429` | 40 turnos consumidos |
| `RATE_LIMITED` | `429` | Cuota horaria de la capa de IA |

**Límites:** 120 peticiones/minuto por usuario en catálogo y ciclo de sesión; **120 turnos/hora** por usuario (el tope real de 40 es por sesión). Contrato en `packages/shared/src/schemas/interview.ts`.

---

## 5. Reglas de autorización

| Recurso | Regla |
|---------|-------|
| Lecciones y etapas publicadas | Públicas |
| Ejercicios y soluciones | Requiere autenticación; `solution` solo para `INSTRUCTOR`/`ADMIN` |
| `Submission` | Solo el propietario o un `INSTRUCTOR` |
| `Progress` | Solo el propietario |
| Contenido (mutaciones) | `INSTRUCTOR` o `ADMIN` |
| Perfil propio (`/api/users/me`) | Solo el propietario; el `userId` sale del token |
| Usuarios (listado) | `ADMIN` |
| Proyectos (catálogo y detalle) | Requiere sesión; `submitted`, `bestScore` y `mySubmissions` sólo del usuario del token |
| Entregas de proyecto | Sólo el autor publica o despublica; la revisión exige `INSTRUCTOR` o `ADMIN` |
| Portafolio público (`/api/portfolio/:userId`) | Sin sesión; sólo entregas publicadas y sin `email` |

> Toda ruta protegida se cubre con **una prueba de aislamiento**: usuario A no puede leer datos de usuario B.

**Implementación (2026-10-28).** `JwtAuthGuard` valida el token y adjunta `request.user`; `RolesGuard` compara `request.user.role` con los roles de `@Roles(...)` y responde `401 UNAUTHENTICATED` sin usuario y `403 FORBIDDEN` si el rol no alcanza. Sin `@Roles`, el guard no restringe la ruta. El rol viene firmado en el token, así que un cambio de rol en la base aplica al renovar la sesión — no se consulta `User.role` en cada petición.

---

## 6. Rate limiting

| Endpoint | Límite |
|----------|--------|
| `/auth/login` | 5 / 15 min por IP + email |
| `/auth/register` | 3 / hora por IP |
| `/sandbox/run` | 20 / min por usuario |
| `/exercises/:id/hints` | 20 / min por usuario |
| `/projects/*` | 120 / min por usuario |
| `/portfolio/:userId` | 120 / min por IP |
| `/ai/tutor` | 30 / hora por usuario |
| Resto | 120 / min por usuario |

Al exceder: `429 RATE_LIMITED` con cabecera `Retry-After`.

---

## 7. Versionado y compatibilidad

- Cambio **compatible** (añadir campo opcional): sin cambio de versión.
- Añadir un campo **requerido en una respuesta** se considera compatible para el consumidor pero rompe a quien construye el objeto (fixtures, mappers, pruebas): se entrega en un solo commit con el esquema de `shared`, el mapper, el adaptador y los fixtures actualizados. Así se hizo en S3 con `ModuleSummary.units` y `UnitSummary.stageId`.
- Cambio **incompatible** (renombrar, eliminar, cambiar tipo): nueva versión `/api/v2`.
- Ambas versiones conviven al menos un sprint.

---

## 8. Contratos compartidos en `packages/shared`

```ts
// packages/shared/src/schemas/auth.ts
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Za-z]/, "Debe incluir una letra")
    .regex(/[0-9]/, "Debe incluir un número"),
  name: z.string().min(2).max(80),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const userPublicSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN"]),
  createdAt: z.string().datetime(),
});

export type UserPublic = z.infer<typeof userPublicSchema>;
```

```ts
// packages/shared/src/schemas/user.ts — perfil (S3, 2026-10-28)
export const userProfileSchema = userPublicSchema.extend({
  avatarUrl: z.string().url().max(2048).refine(httpOrHttps).nullable(),
  locale: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/).max(15),
});

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    avatarUrl: avatarUrlSchema.optional(),
    locale: localeSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);

export const userListQuerySchema = z
  .object({
    role: z.enum(ROLES).optional(),
    search: z.string().trim().min(2).max(80).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
  })
  .strict();

export const userListResponseSchema = paginatedSchema(userProfileSchema);
```

```ts
// packages/shared/src/schemas/project.ts — proyectos y portafolio (S9, 2026-10-28)
export const projectRubricSchema = z
  .object({
    criteria: z.array(projectRubricCriterionSchema).length(5),
    correctitudGate: z.literal(true),
  })
  .strict();

export const createProjectSubmissionSchema = z
  .object({
    repoUrl: projectRepoUrlSchema, // obligatorio, http(s), ≤ 500
    deployUrl: projectDeployUrlSchema.optional(), // http(s) | null
    notes: projectNotesSchema.nullable().optional(), // ≤ 2000
  })
  .strict();

export const reviewProjectSubmissionSchema = z
  .object({
    rubricScores: projectRubricScoresSchema, // los 5 criterios, entero 0..4
    feedback: projectFeedbackSchema.nullable().optional(),
  })
  .strict();

export const portfolioResponseSchema = z.object({
  user: portfolioUserSchema, // id, name, avatarUrl; nunca email
  entries: z.array(projectSubmissionSchema),
  publicCount: z.number().int().nonnegative(),
});
```

**Uso en el backend:** el `ValidationPipe` valida contra el esquema Zod del `shared`.
**Uso en el frontend:** el mismo esquema valida el formulario antes de enviar.

> Esto es lo que impide que DeepSeek invente campos en un lado de la frontera.

---

## Documentos relacionados

- [`modelo-datos.md`](modelo-datos.md)
- [`../04-plan-ejecucion/convenciones-codigo.md`](../04-plan-ejecucion/convenciones-codigo.md)
- [`../04-plan-ejecucion/roadmap-sprints.md`](../04-plan-ejecucion/roadmap-sprints.md)
- [`../04-plan-ejecucion/sprints/sprint-00-fundacion.md`](../04-plan-ejecucion/sprints/sprint-00-fundacion.md)

