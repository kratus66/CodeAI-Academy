# CodeAI Academy

> Formación profesional para **comprender, diseñar, construir, probar, desplegar y mantener software con inteligencia artificial**, sin depender ciegamente de ella.

CodeAI Academy es a la vez:

1. **Un currículo** de 12 etapas que lleva a una persona desde los fundamentos hasta un perfil profesional de desarrollo de software asistido por IA.
2. **Una plataforma educativa** propia donde ese currículo se vive: lecciones, laboratorios de código, ejercicios interactivos, repaso espaciado, proyectos y simulaciones de entrevista.

---

## Estado del proyecto

| Fase | Descripción | Estado |
|------|-------------|--------|
| **A** | Documentación fuente de verdad (`docs/`) | ✅ completada |
| **B** | Roadmap de sprints y fichas de tareas atómicas | ✅ completada |
| **C** | Construcción de la plataforma (S0 → S11) | 🔄 en curso — **S0 ✅ · S1 ✅ · S2 ✅ · S3 ⏳ siguiente** |

### Estado de construcción

| Sprint | Foco | Estado |
|--------|------|--------|
| **S0** | Monorepo, contratos compartidos, API base y landing pública | ✅ completado |
| **S1** | Identidad y acceso (registro, login, roles) | ✅ completado |
| **S2** | Modelo de datos y API de contenido | ✅ completado |
| **S3–S11** | Plataforma de aprendizaje, progreso, laboratorio, IA, proyectos, analítica | ⬜ pendiente |

Detalle y criterios de cierre en [`docs/04-plan-ejecucion/roadmap-sprints.md`](docs/04-plan-ejecucion/roadmap-sprints.md).

---

## Cómo navegar la documentación

La documentación en `docs/` es la **fuente de verdad** del proyecto. Antes de escribir código, se lee y se actualiza aquí.

| Carpeta | Contenido | Cuándo consultarla |
|---------|-----------|--------------------|
| [`docs/00-vision/`](docs/00-vision/) | Filosofía, fundamentos pedagógicos, perfil profesional de egreso | Para entender el *porqué* de cualquier decisión |
| [`docs/01-curriculo/`](docs/01-curriculo/) | Currículo maestro, mapa de competencias, prerequisitos, rúbricas | Para saber *qué se enseña* y *cómo se evalúa* |
| [`docs/02-contenido/`](docs/02-contenido/) | Banco de ejercicios, catálogo de recursos, plantilla de lección | Para producir *material didáctico* |
| [`docs/03-arquitectura/`](docs/03-arquitectura/) | Stack, modelo de datos, contratos de API, capa IA, sandbox | Para tomar decisiones *técnicas* |
| [`docs/04-plan-ejecucion/`](docs/04-plan-ejecucion/) | Roadmap de sprints y fichas de tareas atómicas | Para saber *qué se construye ahora* |
| [`docs/05-orquestacion/`](docs/05-orquestacion/) | Guía Claude-Orquestador, guía DeepSeek-Constructor, plantilla de tarea | Para saber *cómo se trabaja* |
| [`docs/06-plantillas/`](docs/06-plantillas/) | Plantillas de contenido (lección, ejercicio, ADR) — previstas | Para producir material didáctico |
| [`docs/07-flujo-operativo.md`](docs/07-flujo-operativo.md) | **Empieza aquí si eres un agente.** Flujo paso a paso por tarea | Al inicio de **cada** tarea |

> 🔎 **Ruta recomendada para una IA nueva en el proyecto:**
> `README.md` → `docs/07-flujo-operativo.md` → `docs/04-plan-ejecucion/roadmap-sprints.md` → la ficha del sprint actual → la tarea asignada.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript |
| Base de datos | PostgreSQL + Prisma ORM |
| Contratos compartidos | `packages/shared` (tipos + esquemas Zod) |
| Autenticación | JWT + roles (student / instructor / admin) |
| Editor de código | Monaco Editor |
| Ejecución de código | Sandbox aislado y limitado en recursos |
| Capa de IA | Interfaz `AIProvider` intercambiable |
| Pruebas | Vitest + Testing Library + Supertest |
| Contenedores | Docker + docker-compose |
| Monorepo | npm workspaces |

Detalle y justificación en [`docs/03-arquitectura/stack-tecnologico.md`](docs/03-arquitectura/stack-tecnologico.md).

---

## Estructura del repositorio

```
CodeAI Academy/
├── apps/
│   ├── web/            # Next.js 14 — landing pública + app de estudiante
│   └── api/            # NestJS — REST API + Prisma
├── packages/
│   └── shared/         # Tipos, DTOs y esquemas Zod compartidos
├── docs/               # Documentación fuente de verdad
├── docker-compose.yml
└── package.json        # npm workspaces
```

---

## Modelo de trabajo: Orquestador + Constructor

El proyecto se desarrolla con **dos roles de IA** y un humano supervisor:

- **Claude — Orquestador:** planifica sprints, redacta fichas de tarea atómicas, revisa entregables, actualiza documentación y cierra tareas con commits atómicos. Nunca implementa código de producto directamente.
- **DeepSeek — Constructor:** implementa **una sola tarea atómica** por sesión, con contexto mínimo auto-contenido.
- **Humano:** supervisa, aprueba decisiones de producto y valida resultados finales.

El objetivo del diseño es que **cada sesión del Constructor reciba un contexto pequeño y cerrado**, de modo que no agote la ventana de contexto ni genere código inconsistente.

Detalle completo en [`docs/05-orquestacion/`](docs/05-orquestacion/).

---

## Reglas permanentes del proyecto

1. Ningún concepto del currículo sin ejercicios prácticos asociados.
2. Ningún módulo del currículo sin un entregable o proyecto.
3. La IA es herramienta **y** objeto de estudio: se usa y se audita.
4. Habrá pruebas acumulativas: los fundamentos se reevalúan después.
5. El curso termina con demostración defendible de competencias.
6. La documentación se actualiza **en el mismo commit** que el código que la afecta.

---

## Comandos

```bash
npm install            # instalar dependencias del monorepo
npm run dev            # levantar web + api en desarrollo
npm run dev:web        # solo Next.js
npm run dev:api        # solo NestJS
npm run db:up          # PostgreSQL vía docker-compose (localhost:5433)
npm run db:migrate     # aplicar migraciones Prisma (desde S1)
npm run db:seed        # cargar el currículo de forma idempotente (desde S2)
npm run test           # pruebas de todos los workspaces
npm run lint           # análisis estático
npm run typecheck      # verificación de tipos
```

> **Base de datos local (S1–S2):** copia `.env.example` a `apps/api/.env`, ejecuta `npm run db:up`, después `npm run db:migrate` y por último `npm run db:seed`. El puerto del host es **5433** porque el 5432 suele estar ocupado por otras bases locales. La semilla carga las 12 etapas del currículo con 48 módulos y 63 unidades (E0–E3 publicadas), y puede ejecutarse varias veces sin duplicar filas.

> **Acceso (S1):** la web expone `/register` y `/login`; la sesión se restaura con `GET /api/auth/me` y los tokens solo viven en cookies httpOnly. Si la API no está en `http://localhost:3001/api`, define `NEXT_PUBLIC_API_URL` en `apps/web/.env.local`.

---

## Licencia y uso de recursos externos

Cada recurso multimedia externo (MDN, freeCodeCamp, Full Stack Open, documentación oficial) se incorpora mediante **enlace verificado con metadatos**, nunca copiando contenido con licencia incompatible. Ver [`docs/02-contenido/catalogo-recursos.md`](docs/02-contenido/catalogo-recursos.md).
