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

> **Estado del contrato (2026-10-26):** implementados `GET /api/health` (S0), `/api/auth/*` (S1) y `/api/content/*` (S2). El resto de endpoints describe el **contrato objetivo** y se implementa en los sprints S3–S11 según el [`roadmap`](../04-plan-ejecucion/roadmap-sprints.md).

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

### 4.3 Ejercicios (`/api/exercises`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/units/:unitCode` | ✅ | Ejercicios de la unidad (sin `solution`, sin tests ocultos) |
| GET | `/:id` | ✅ | Detalle del ejercicio |
| POST | `/:id/hints` | ✅ | Solicita pista. Body: `{ level }` |
| POST | `/:id/submissions` | ✅ | Envía solución |
| GET | `/:id/submissions` | ✅ | Historial propio |

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

### 4.4 Progreso (`/api/progress`)

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

### 4.5 Repaso (`/api/review`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/queue` | ✅ | Ítems vencidos (máx. 30) |
| POST | `/items/:id/answer` | ✅ | Registra calidad y recalcula SM-2 |

```json
// POST /api/review/items/:id/answer
{ "quality": 4, "durationMs": 42000 }

// 200 Response
{
  "nextDueAt": "2026-11-01T14:30:00.000Z",
  "intervalDays": 6,
  "easeFactor": 2.6,
  "repetitions": 2
}
```

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
  "budgetRemainingUsd": 48.2
}
```

> El tutor **no entrega la solución completa**. El prompt del sistema lo prohíbe explícitamente (ver [`capa-ia.md`](capa-ia.md)).

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

## 5. Reglas de autorización

| Recurso | Regla |
|---------|-------|
| Lecciones y etapas publicadas | Públicas |
| Ejercicios y soluciones | Requiere autenticación; `solution` solo para `INSTRUCTOR`/`ADMIN` |
| `Submission` | Solo el propietario o un `INSTRUCTOR` |
| `Progress` | Solo el propietario |
| Contenido (mutaciones) | `INSTRUCTOR` o `ADMIN` |
| Usuarios (listado) | `ADMIN` |

> Toda ruta protegida se cubre con **una prueba de aislamiento**: usuario A no puede leer datos de usuario B.

---

## 6. Rate limiting

| Endpoint | Límite |
|----------|--------|
| `/auth/login` | 5 / 15 min por IP + email |
| `/auth/register` | 3 / hora por IP |
| `/sandbox/run` | 20 / min por usuario |
| `/ai/tutor` | 30 / hora por usuario |
| Resto | 120 / min por usuario |

Al exceder: `429 RATE_LIMITED` con cabecera `Retry-After`.

---

## 7. Versionado y compatibilidad

- Cambio **compatible** (añadir campo opcional): sin cambio de versión.
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

**Uso en el backend:** el `ValidationPipe` valida contra el esquema Zod del `shared`.
**Uso en el frontend:** el mismo esquema valida el formulario antes de enviar.

> Esto es lo que impide que DeepSeek invente campos en un lado de la frontera.

---

## Documentos relacionados

- [`modelo-datos.md`](modelo-datos.md)
- [`../04-plan-ejecucion/convenciones-codigo.md`](../04-plan-ejecucion/convenciones-codigo.md)
- [`../04-plan-ejecucion/roadmap-sprints.md`](../04-plan-ejecucion/roadmap-sprints.md)
- [`../04-plan-ejecucion/sprints/sprint-00-fundacion.md`](../04-plan-ejecucion/sprints/sprint-00-fundacion.md)

