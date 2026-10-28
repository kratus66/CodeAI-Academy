# Arquitectura general

> Cómo se estructura la plataforma. Decisiones de alto nivel; el detalle de stack, datos y contratos en los documentos hermanos.

---

## 1. Diagrama de contexto (C4 nivel 1)

```
                        ┌─────────────────────────┐
                        │      ESTUDIANTE         │
                        │  (navegador web)        │
                        └───────────┬─────────────┘
                                    │ HTTPS
                                    ▼
        ┌───────────────────────────────────────────────┐
        │            CodeAI ACADEMY (sistema)           │
        │                                               │
        │   ┌─────────────┐        ┌──────────────┐     │
        │   │  apps/web   │        │   apps/api   │     │
        │   │  Next.js    │───────►│   NestJS     │     │
        │   └─────────────┘  REST  └───────┬──────┘     │
        │                                  │            │
        └──────────────────────────────────┼────────────┘
                                           │
          ┌──────────────┬─────────────────┼──────────────┐
          ▼              ▼                 ▼              ▼
   ┌────────────┐ ┌────────────┐  ┌──────────────┐ ┌─────────────┐
   │ PostgreSQL │ │  Sandbox   │  │ Proveedor IA │ │  Almacén    │
   │  (datos)   │ │ (código)   │  │ (LLM API)    │ │ multimedia  │
   └────────────┘ └────────────┘  └──────────────┘ └─────────────┘
```

### Sistemas externos
| Sistema | Propósito | Riesgo gestionado |
|---------|-----------|-------------------|
| Proveedor de IA | Tutor, evaluación asistida, generación de pistas | Costos, latencia, privacidad, intercambiabilidad |
| Sandbox de ejecución | Correr código de estudiantes | Ejecución arbitraria, agotamiento de recursos |
| Almacén multimedia | Videos, diagramas | Peso, licencias |
| Recursos externos | MDN, freeCodeCamp, etc. | Enlaces caídos, licencias |

---

## 2. Diagrama de contenedores (C4 nivel 2)

### `apps/web` — Next.js 14 (App Router)

| Aspecto | Decisión |
|---------|----------|
| Renderizado | SSR para landing y lecciones públicas; CSR para el laboratorio |
| Autenticación | Token JWT en cookie httpOnly; refresh silencioso |
| Estado servidor | TanStack Query |
| Estado cliente | Zustand (UI, editor, preferencias) |
| Editor | Monaco Editor cargado dinámicamente |
| Estilos | Tailwind CSS + componentes propios |

**Responsabilidad:** toda la interfaz. No contiene lógica de negocio ni accede a la base de datos.

### `apps/api` — NestJS

| Aspecto | Decisión |
|---------|----------|
| Organización | Módulos por dominio (`auth`, `content`, `progress`, `exercises`, `sandbox`, `ai`, `analytics`, `interviews`) |
| Persistencia | Prisma + PostgreSQL |
| Validación | DTOs con `class-validator` + esquemas Zod en `shared` |
| Documentación | Swagger/OpenAPI en `/api/docs` |
| Autorización | Guards por rol y por recurso |
| Tareas asíncronas | Cola (BullMQ) para evaluaciones y repaso |

**Responsabilidad:** toda la lógica de negocio, la persistencia y la orquestación de servicios externos.

### `packages/shared`

Contiene **una sola fuente de verdad** para:
- Tipos TypeScript de dominio
- Esquemas Zod de validación
- Enums (roles, tipos de ejercicio, estados de progreso)
- Constantes (códigos de error, límites)

> Regla: si un tipo cruza la frontera web↔api, **vive en `shared`**. Nunca se duplica.

---

## 3. Flujo de una petición típica

```
Usuario hace clic en "Verificar solución"
   │
   ▼
[web] Envía POST /api/exercises/:id/submissions  (JWT en cookie)
   │
   ▼
[api] AuthGuard valida JWT → RolesGuard valida permiso
   │
   ▼
[api] ExercisesService:
   1. Recupera ejercicio + tests ocultos
   2. Encola ejecución en SandboxService
   3. Espera resultado (con timeout)
   4. Calcula puntuación y nivel alcanzado
   5. Registra Submission
   6. Actualiza ProgressService (unidad, competencia)
   7. Si corresponde, programa ReviewItem (SM-2)
   │
   ▼
[web] Recibe resultado → muestra retroalimentación → invalida caché de progreso
```

---

## 4. Principios arquitectónicos

| # | Principio | Consecuencia práctica |
|---|-----------|----------------------|
| 1 | **El frontend no decide nada crítico** | Puntuación, niveles y desbloqueos se calculan siempre en el servidor |
| 2 | **Ningún código de estudiante corre en el proceso principal** | Toda ejecución pasa por el sandbox con límites |
| 3 | **Los proveedores de IA son intercambiables** | Interfaz `AIProvider`; ningún módulo importa un SDK concreto |
| 4 | **El contenido es dato, no código** | Lecciones y ejercicios se cargan desde BD/JSON validado, no desde archivos TS |
| 5 | **Todo es auditable** | Cada cambio de progreso y cada llamada a IA deja registro |
| 6 | **Fallar es seguro** | Si el sandbox o la IA fallan, el estudiante ve un mensaje claro, nunca un error 500 crudo |
| 7 | **Costo controlado por diseño** | Presupuesto por usuario y por sesión de IA desde el inicio |

---

## 5. Módulos del backend

| Módulo | Responsabilidad | Sprint |
|--------|----------------|--------|
| `auth` | Registro, login, JWT, refresh, roles | S1 ✅ |
| `users` | Perfil, preferencias, listado de administración | S3 ✅ |
| `content` | Etapas, módulos, unidades, lecciones, recursos | S2 ✅ |
| `exercises` | Ejercicios, envíos, pistas, corrección | S5, S6 |
| `progress` | Progreso, desbloqueos, competencias | S4 |
| `review` | SM-2, cola de repaso | S7 |
| `sandbox` | Ejecución aislada de código | S5 |
| `ai` | Abstracción de proveedor, tutor, evaluación | S8 |
| `projects` | Entregas, rúbricas, portafolio | S9 |
| `interviews` | Simulaciones, transcripciones, evaluación | S10 |
| `analytics` | Agregaciones de competencias y errores | S11 |
| `health` | Estado del servicio y observabilidad | S0 ✅ |

> **Estado (2026-10-28):** `health` (S0), `auth` (S1), `content` (S2, solo lectura), `progress` (S4), `exercises` + `sandbox` (S5–S6), `review` (S7) y `users` (perfil y listado de administración) implementados y verificados. `RolesGuard` y `@Roles` viven en `auth` y los consume `users`; los módulos `ai` (S8), `projects` (S9), `interviews` (S10) y `analytics` (S11) siguen sin código.

---

## 6. Estrategia de datos para el contenido

El contenido curricular se versiona como **datos**, siguiendo el pipeline:

```
docs/01-curriculo/curriculo-maestro.md   (fuente humana)
        │
        ▼
packages/shared/content/**/*.json         (JSON validado con Zod)
        │
        ▼
npm run db:seed                           (carga idempotente en PostgreSQL)
        │
        ▼
la app muestra lecciones y ejercicios
```

**Ventajas:** contenido revisable en PR, validado por esquema, reproducible, y migrable a otro formato sin tocar la app.

---

## 7. Entornos

| Entorno | Base de datos | IA | Sandbox | Uso |
|---------|---------------|----|---------|-----|
| `local` | PostgreSQL en Docker | Proveedor real con clave de desarrollo o mock | Docker local | Desarrollo |
| `test` | PostgreSQL efímero | Mock determinista | Mock | CI |
| `staging` | PostgreSQL gestionado | Real con límite de gasto | Contenedores efímeros | Validación |
| `production` | PostgreSQL gestionado + backups | Real con presupuesto y alertas | Contenedores efímeros aislados | Usuarios |

---

## 8. Riesgos arquitectónicos y mitigación

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| Ejecución arbitraria de código | Crítico | Sandbox con límites de CPU/memoria/tiempo, sin red por defecto |
| Costo descontrolado de IA | Alto | Presupuesto por usuario, caché de respuestas, modelos pequeños para tareas simples |
| Fuga de datos entre estudiantes | Alto | Autorización por recurso + pruebas de aislamiento |
| Alucinación del tutor | Medio | Prompts con contexto recuperado + verificación de citas + límite de confianza |
| Deriva de contenido | Medio | Validación por esquema + revisión en PR |
| Complejidad prematura | Medio | Sprints incrementales; nada se construye sin tarea en un sprint |

---

## Documentos relacionados

- [`stack-tecnologico.md`](stack-tecnologico.md)
- [`modelo-datos.md`](modelo-datos.md)
- [`contratos-api.md`](contratos-api.md)
- [`capa-ia.md`](capa-ia.md)
- [`sandbox-ejecucion.md`](sandbox-ejecucion.md)

