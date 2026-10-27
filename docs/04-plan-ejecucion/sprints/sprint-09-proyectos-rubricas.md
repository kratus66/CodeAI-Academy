# Sprint 09 — Proyectos por etapa, rúbricas y portafolio público

> **Estado:** 🔄 en curso (2026-10-27) · **Inicio:** 2026-10-27 · **Depende de:** S2 ✅ (etapas, unidades y publicaciones), S3 ✅ (identidad con rol en el token) y S6/S7 ✅ (envío propio y panel de repaso).
> **Avance:** 0/18 tareas · 0/18 criterios de aceptación.
> **Sesión por tarea:** cada tarea se implementa y verifica en una invocación aislada de comandos; su salida real queda en la bitácora §9.
> **Desvío declarado:** el sprint se ejecuta **sin S8** (capa de IA). La retroalimentación automática de la entrega queda como deuda (§8) y la revisión de S9 es humana, con rúbrica.

---

## 1. Objetivo

Cada etapa termina en un proyecto evaluable, no en un vídeo visto (`roadmap-sprints.md` §S9). Al cerrar el sprint:

1. Existe un catálogo de proyectos publicados por etapa (`GET /api/projects`) con su enunciado, requisitos y rúbrica de cinco criterios con pesos que suman 100.
2. El estudiante entrega su proyecto (`POST /api/projects/:slug/submissions`) con repositorio, despliegue y explicación propia; cada entrega es acumulable y sólo la ve su autor.
3. Un instructor o administrador revisa una entrega (`POST /api/projects/submissions/:id/review`) con la rúbrica completa y obtiene una nota de 0 a 100 calculada con los pesos del proyecto.
4. La nota respeta las dos reglas duras de `rubricas-evaluacion.md` §1: **correctitud 0 invalida el entregable** (no se compensa) y **justificación vacía resta el 15 % completo**.
5. Una revisión con nota ≥ 80 deja **evidencia de competencia** en `CompetencyProgress` para las competencias del proyecto; por debajo de 80 no escribe nada.
6. Toda entrega es **privada por defecto**: el portafolio público (`GET /api/portfolio/:userId`) sólo muestra lo que el autor publicó explícitamente, sin correo ni entregas privadas, y la publicación se puede retirar.
7. La web cubre el ciclo completo: catálogo por etapa, espacio de trabajo con formulario y estado de la entrega, y portafolio público compartible.

---

## 2. Alcance

| Incluye | No incluye (queda para otro sprint) |
|---------|-------------------------------------|
| Contrato compartido de proyecto, rúbrica, entrega y portafolio (`project.ts`) | Retroalimentación automática de la entrega: era S8, sigue pendiente (§8) |
| `@Roles` + `RolesGuard` con el rol del token | Administración de roles y de instructores desde la API |
| Modelos `Project` y `ProjectSubmission` + migración `projects_rubrics` | Entrevistas, `InterviewSession` y su rúbrica (S10) |
| Semilla de proyectos por etapa con la rúbrica base | Editor de rúbricas o de proyectos en la web |
| Motor puro `scoreSubmission` (pesos, niveles, puerta de correctitud) | Cálculo de nota por pares o revisión ciega entre estudiantes |
| Puerto `ProjectRepository` + adaptador Prisma + memoria | Edición de una revisión ya emitida o historial de notas |
| `GET /api/projects`, `GET /api/projects/:slug`, `POST …/submissions` | Notificaciones al estudiante cuando su entrega se revisa |
| `POST …/review` con `RolesGuard` y evidencia de competencia | Desbloqueo automático de la siguiente etapa por nota de proyecto (§8) |
| `POST …/publish`, `POST …/unpublish`, `GET /api/portfolio/me`, `GET /api/portfolio/:userId` | Subida de capturas o de artefactos: el portafolio enlaza repositorio y despliegue |
| Web: `projectsApi`/`portfolioApi`, catálogo, espacio de trabajo y portafolio público | Búsqueda y filtros por competencia en el catálogo |

**Traspaso desde S6/S7.** El envío de ejercicios (`Submission`) y la cola de repaso (`ReviewItem`) **no se tocan**: un proyecto es otro objeto, con su propia tabla, porque su rúbrica, su privacidad y su portafolio no existen en el envío de ejercicio. La única pieza compartida es `CompetencyProgress`, que S5 ya usa para el avance: S9 **añade evidencia** y nunca baja un nivel.

**Traspaso a S10–S11.** `InterviewSession` y la rúbrica de entrevista reutilizan `RolesGuard`, el patrón de puerto/repositorio y `CompetencyProgress`. La analítica de notas por etapa y la tasa de aprobación necesitan una consulta agregada que no se escribe aquí.

---

## 3. Decisiones de diseño

| Decisión | Motivo | Alternativa descartada |
|----------|--------|------------------------|
| `Project.rubric` sigue siendo `Json` y se valida con `projectRubricSchema` al sembrar y al revisar | `modelo-datos.md` §6 ya publica `Json`; normalizar cinco criterios en dos tablas más no aporta a este sprint | Tablas `RubricCriterion`/`RubricLevel`: migración grande y consultas más lentas para un dato que se lee entero |
| Los pesos viven en la rúbrica del proyecto y deben sumar **100**; la base sembrada es 30/20/20/15/15 | Un proyecto puede ponderar distinto (p. ej. más pruebas), pero la nota siempre es comparable en escala 0–100 | Pesos globales en código: impediría rúbricas por tipo de actividad (`rubricas-evaluacion.md` §2) |
| Los anclajes se publican para los niveles **1–4** y la revisión acepta **0** como «no cumple» | La regla dura es «correctitud 0 invalida»; 0 no es un nivel descriptivo, es la ausencia de logro | Escala 1–4 sin 0: haría inexpresable la regla de invalidación |
| `score = Σ peso × nivel / 4`, redondeado a dos decimales | Nota 0–100 directamente comparable con la escala de conversión de `rubricas-evaluacion.md` §3 | Porcentaje sobre el máximo logrado: una entrega con todo en nivel 3 daría 100 |
| `correctitud = 0` responde `422 RULE_VIOLATION` y **no persiste** la revisión | La entrega inválida no debe quedar con nota; el estudiante corrige y vuelve a entregar | Persistir `score = 0`: confunde «no revisado» con «revisado y reprobado» |
| Justificación vacía fuerza el criterio `justificacion` a 0 aunque el instructor lo puntúe | `rubricas-evaluacion.md` §1: resta el 15 % completo, no una fracción | Restar la mitad: contradice la regla anti-fraude |
| `ProjectSubmission` se amplía con `status`, `feedback`, `reviewedById`, `isPublic` y `publishedAt` | La privacidad es un estado explícito y reversible, no la ausencia de una fila | Tabla `PortfolioItem` aparte: duplicaría la entrega y su nota |
| `Project.competencies String[]` nuevo en el modelo | Sin competencias declaradas no se puede escribir evidencia al aprobar; `modelo-datos.md` §6 se actualiza en T16 | Deducirlas del `stageId`: una etapa cubre varias competencias |
| `RolesGuard` propio que lee `role` del **token** | Evita una consulta a la base por petición; el rol viaja firmado desde S3 | Consultar `User.role` en cada revisión: coste y acoplamiento innecesarios |
| El rol sólo cambia al renovar la sesión | El `accessToken` es la fuente de verdad durante su vigencia (15 min); se documenta en §7 y la verificación hace *re-login* tras cambiar el rol | Invalidar tokens al cambiar el rol: exigiría una lista de revocación que S3 no tiene |
| `GET /api/portfolio/:userId` es **público** (sin cookie) y `GET /api/portfolio/me` es autenticado | Un portafolio sirve para compartirlo con un reclutador; el dueño necesita ver también lo privado | Firmar enlaces: no hay caso de uso que lo pida y complicaría la vista pública |
| `repoUrl` es obligatorio (`String`, no `String?`) y debe ser `http(s)` | Una entrega sin repositorio no es evaluable; el contrato fija `400` | Mantenerlo opcional y validar en el servicio: deja un estado imposible en la tabla |
| La revisión y la publicación son **acciones explícitas** (`POST`), no efectos de `PATCH` | Cada acto deja un cambio auditable y una respuesta con el estado resultante | `PATCH` parcial: más superficie para escrituras accidentales |

**Deudas declaradas.**

- **S8 no ejecutado.** La capa de IA no existe: no hay proveedor, ni presupuesto, ni `AiInteraction`. La entrega de S9 se revisa con rúbrica humana; el campo `feedback` lo escribe el instructor. Cuando se retome S8, `POST /api/ai/review` podrá **sugerir** una nota, nunca persistirla.
- **Desbloqueo de etapa.** `progress.rules.ts` sigue desbloqueando por unidades; que un proyecto con nota ≥ 80 desbloquee la etapa siguiente exige tocar las reglas de S4 y su contrato, y no cabe aquí. S9 deja la evidencia (`CompetencyProgress`) y la nota, que es la entrada de esa regla.
- **Edición y auditoría de la revisión.** No se guarda quién cambió una nota ni la versión anterior: `reviewedAt`/`reviewedById` registran la última. Un historial de revisiones es trabajo de S11.
- **Semilla separada del contenido.** `content.seed.json` está en revisión por otro cambio (lecciones), así que los proyectos se siembran con `prisma/seed/projects.seed.json` y `seed-projects.mts`. Evita mezclar dos trabajos en el mismo archivo y mantiene la semilla idempotente por `slug`.

---

## 4. Contrato

> **Contratos nuevos.** `contratos-api.md` no tiene sección de proyectos: T16 añade §4.10 con esta tabla y estos tipos. `GET /api/portfolio/:userId` es la **primera ruta pública de la API** fuera de autenticación y contenido; su límite de peticiones es por IP (§6).

| Método | Ruta | Auth | Respuesta |
|--------|------|------|-----------|
| GET | `/api/projects` | ✅ | `200 { data: ProjectSummary[], meta }` |
| GET | `/api/projects/:slug` | ✅ | `200 ProjectDetail` · `404` |
| POST | `/api/projects/:slug/submissions` | ✅ | `201 ProjectSubmission` · `400` · `404` |
| POST | `/api/projects/submissions/:id/review` | 🎓 `INSTRUCTOR`/`ADMIN` | `200 ProjectSubmission` · `403` · `404` · `422` |
| POST | `/api/projects/submissions/:id/publish` | ✅ autor | `200 ProjectSubmission` · `404` |
| POST | `/api/projects/submissions/:id/unpublish` | ✅ autor | `200 ProjectSubmission` · `404` |
| GET | `/api/portfolio/me` | ✅ | `200 PortfolioResponse` |
| GET | `/api/portfolio/:userId` | — público | `200 PortfolioResponse` · `404` |



```ts
type ProjectCriterion =
  | "correctitud" | "calidad" | "pruebas" | "seguridad" | "justificacion";
type ProjectSubmissionStatus = "SUBMITTED" | "REVIEWED";

interface ProjectRubricLevel {
  level: 1 | 2 | 3 | 4;
  anchor: string;               // 1..280 caracteres
}

interface ProjectRubricCriterion {
  criterion: ProjectCriterion;
  weight: number;               // entero 1..100; la suma de los cinco es 100
  levels: ProjectRubricLevel[]; // exactamente 4, niveles 1..4 en orden
}

interface ProjectRubric {
  criteria: ProjectRubricCriterion[]; // exactamente 5, sin repetir criterio
  correctitudGate: true;              // la puerta se declara, no se asume
}

interface ProjectSummary {
  id: string;
  slug: string;
  stageId: number;              // 0..11
  title: string;
  brief: string;
  requirements: string[];       // ≥ 1 requisito
  isPublished: boolean;
  submitted: boolean;           // el usuario autenticado ya entregó este proyecto
}

interface ProjectDetail extends ProjectSummary {
  rubric: ProjectRubric;
  competencies: string[];       // códigos C1..C8
  bestScore: number | null;     // mejor nota propia, dos decimales
  mySubmissions: ProjectSubmission[]; // sólo del autor, más reciente primero
}

interface ProjectSubmission {
  id: string;
  projectId: string;
  projectSlug: string;
  projectTitle: string;
  stageId: number;
  userId: string;
  status: ProjectSubmissionStatus;
  repoUrl: string;
  deployUrl: string | null;
  notes: string | null;         // explicación propia; vacía resta el 15 %
  score: number | null;         // null mientras no hay revisión
  rubricScores: Record<ProjectCriterion, number> | null; // niveles 0..4
  feedback: string | null;
  reviewedAt: string | null;    // ISO 8601
  isPublic: boolean;
  publishedAt: string | null;
  createdAt: string;
}

interface CreateProjectSubmissionInput {
  repoUrl: string;              // URL http/https, ≤ 500 caracteres
  deployUrl?: string | null;    // URL http/https, ≤ 500 caracteres
  notes?: string | null;        // ≤ 2000 caracteres
}

interface ReviewProjectSubmissionInput {
  // los cinco criterios de la rúbrica del proyecto, con nivel entero 0..4
  rubricScores: Record<ProjectCriterion, number>;
  feedback?: string | null;     // ≤ 2000 caracteres
}

interface PortfolioResponse {
  user: { id: string; name: string; avatarUrl: string | null }; // nunca `email`
  entries: ProjectSubmission[];
  publicCount: number;          // entradas públicas incluidas en `entries`
}
```


**Reglas del contrato.**

| Caso | Respuesta |
|------|-----------|
| Proyecto inexistente o no publicado | `404 NOT_FOUND` |
| Entrega sin `repoUrl`, con URL no `http(s)` o `notes` > 2000 caracteres | `400 VALIDATION_ERROR` con `details[].field` |
| Revisión con criterios faltantes, sobrantes o nivel fuera de 0..4 | `422 RULE_VIOLATION` (rúbrica incompleta) |
| Revisión con `correctitud = 0` | `422 RULE_VIOLATION`; no se persiste y la entrega sigue `SUBMITTED` |
| Revisión por un `STUDENT` | `403 FORBIDDEN` |
| Publicar o despublicar una entrega ajena | `404 NOT_FOUND` (no se confirma que exista) |
| Portafolio de un `userId` inexistente | `404 NOT_FOUND` |
| Portafolio público de un usuario sin entregas públicas | `200` con `entries: []` y `publicCount: 0` |
| Más de 120 peticiones por minuto en `/projects/*` (por usuario) o en `/portfolio/:userId` (por IP) | `429 RATE_LIMITED` con `Retry-After` |

**Cálculo de la nota (contrato del motor puro).**

```
nota(criterio) = peso(criterio) × nivel(criterio) / 4
score          = round(Σ nota, 2)
```

- `correctitud = 0` ⇒ `valid: false` y la revisión no se guarda.
- `notes` vacío ⇒ `nivel(justificacion) = 0` antes de sumar, aunque el instructor envíe otro nivel.
- Todos los criterios en nivel 3 ⇒ `75`; todos en nivel 4 ⇒ `100`; `100 − 15 = 85` si sólo falta la justificación.

---

## 5. Tareas

| # | Tarea | Archivos (≤ 4 por tarea) | Verificación |
|---|-------|--------------------------|--------------|
| **T1** | Contrato compartido: criterios, estados, niveles, `projectRubricSchema` (5 criterios, pesos suman 100, niveles 1–4), `DEFAULT_PROJECT_RUBRIC` 30/20/20/15/15, esquemas de listado, detalle, entrega, revisión, portafolio y constantes | `packages/shared/src/schemas/project.ts`, `packages/shared/src/index.ts`, `packages/shared/src/schemas/project.spec.ts` | `npm run test -w @codeai/shared` |
| **T2** | `@Roles` y `RolesGuard`: metadatos de clase/método, `401` sin usuario, `403` con rol insuficiente, paso libre sin metadatos | `apps/api/src/modules/auth/decorators/roles.decorator.ts`, `…/auth/guards/roles.guard.ts`, `…/auth/guards/roles.guard.spec.ts` | `npm run test -w @codeai/api` |
| **T3** | Modelos `Project`, `ProjectSubmission`, enum `ProjectSubmissionStatus`, competencias del proyecto, relaciones en `User` y migración `projects_rubrics` aplicada a la base de desarrollo | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_projects_rubrics/migration.sql` | `prisma migrate diff` + `psql \d "ProjectSubmission"` |
| **T4** | Semilla de un proyecto por etapa (E0–E3) idempotente por `slug`, con la rúbrica base y sus competencias; script `db:seed:projects` | `apps/api/prisma/seed/projects.seed.json`, `apps/api/prisma/seed/seed-projects.mts`, `apps/api/package.json`, `package.json` | `npm run db:seed:projects` + `psql select count(*)` |
| **T5** | Motor puro: `readRubric` (valida el `Json` guardado) y `scoreSubmission` (pesos, niveles 0–4, puerta de correctitud, justificación vacía, dos decimales) | `apps/api/src/modules/projects/rubric.ts`, `…/rubric.spec.ts` | `npm run test -w @codeai/api` |
| **T6** | Puerto `ProjectRepository` con adaptador Prisma y uno en memoria (catálogo, detalle, entregas, revisión, publicación, portafolio, evidencia de competencia) | `apps/api/src/modules/projects/project.repository.ts`, `…/prisma-project.repository.ts`, `…/in-memory-project.repository.ts` | `npm run test -w @codeai/api` |
| **T7** | `ProjectsService.listProjects` y `getProject`: sólo publicados, filtro por etapa, paginación, `submitted` por usuario, mejor nota y entregas propias | `apps/api/src/modules/projects/projects.service.ts`, `…/projects.service.spec.ts` | `npm run test -w @codeai/api` |
| **T8** | `ProjectsService.submit`: proyecto publicado, `repoUrl` http(s), topes de longitud, `userId` del token y entregas acumulables | `…/projects.service.ts`, `…/projects.service.spec.ts` | `npm run test -w @codeai/api` |
| **T9** | `ProjectsService.review`: rúbrica completa, `422` con criterios faltantes o correctitud 0, nota persistida, `reviewedById` y evidencia `CompetencyProgress` con nota ≥ 80 | `…/projects.service.ts`, `…/projects.service.spec.ts` | `npm run test -w @codeai/api` |
| **T10** | `ProjectsService.publish`/`unpublish` (sólo el autor) y `getPortfolio`/`getMyPortfolio` (público vs. propio, sin correo) | `…/projects.service.ts`, `…/projects.service.spec.ts` | `npm run test -w @codeai/api` |
| **T11** | `ProjectsController` (6 rutas con `JwtAuthGuard` y `RolesGuard` en la revisión), `PortfolioController` (2 rutas), `ProjectsModule` y registro en `AppModule` | `apps/api/src/modules/projects/projects.controller.ts`, `…/portfolio.controller.ts`, `…/projects.module.ts`, `apps/api/src/app.module.ts` | `npm run test -w @codeai/api` + `npm run build -w @codeai/api` |
| **T12** | `projectsApi` y `portfolioApi` en el cliente web (catálogo, detalle, entrega, publicación, portafolio) con `401`/`403`/`422` tipados | `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/api-client.spec.ts` | `npm run test -w @codeai/web` |
| **T13** | `ProjectCatalog` con estados de carga, error, vacío y `submitted`, y página `/learn/projects` | `apps/web/src/features/projects/components/ProjectCatalog.tsx`, `…/ProjectCatalog.spec.tsx`, `apps/web/src/app/(learning)/learn/projects/page.tsx` | `npm run test -w @codeai/web` |
| **T14** | `ProjectWorkspace`: rúbrica legible, formulario de entrega, historial con nota y retroalimentación, publicar/despublicar y página `/learn/projects/[slug]` | `…/components/ProjectWorkspace.tsx`, `…/ProjectWorkspace.spec.tsx`, `apps/web/src/app/(learning)/learn/projects/[slug]/page.tsx` | `npm run test -w @codeai/web` |
| **T15** | `PublicPortfolio` (modo público y propio) y páginas `/u/[userId]` y `/learn/portfolio` | `…/components/PublicPortfolio.tsx`, `…/PublicPortfolio.spec.tsx`, `apps/web/src/app/(public)/u/[userId]/page.tsx`, `apps/web/src/app/(learning)/learn/portfolio/page.tsx` | `npm run test -w @codeai/web` |
| **T16** | Enlace a Proyectos y Mi portafolio en la navegación; `contratos-api.md` §4.10 y `modelo-datos.md` §6 con el contrato real | `apps/web/src/app/(learning)/learn/layout.tsx`, `docs/03-arquitectura/contratos-api.md`, `docs/03-arquitectura/modelo-datos.md` | `npm run typecheck -w @codeai/web` + revisión de docs |
| **T17** | `roadmap-sprints.md` §S9 al día y esta ficha con avance, bitácora y deudas reales | `docs/04-plan-ejecucion/roadmap-sprints.md`, `docs/04-plan-ejecucion/sprints/sprint-09-proyectos-rubricas.md` | lectura de ambos documentos |
| **T18** | Verificación HTTP de cierre (§10) con tres usuarios y cierre del sprint | `%TEMP%\codeai-s9\verify-s9.ps1` (fuera del repositorio) + esta ficha | `typecheck && lint && test && build` en la raíz |

**Orden de ejecución.** T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17 → T18. T2 no depende de T1 y T3 no depende de T2, pero se respeta el orden para que cada commit deje el árbol verde.

---

## 6. Criterios de aceptación

| # | Criterio (binario: se cumple o no) | Tarea |
|---|------------------------------------|-------|
| 1 | `project.spec.ts` acepta la rúbrica base y rechaza pesos que no suman 100, criterios repetidos o faltantes, niveles fuera de 1–4 y `correctitudGate` distinto de `true` | T1 |
| 2 | `npm run test -w @codeai/shared` termina en 0 y `DEFAULT_PROJECT_RUBRIC` pesa 30/20/20/15/15 | T1 |
| 3 | `RolesGuard` devuelve `401` sin usuario, `403` con `STUDENT` en una ruta de instructor, deja pasar `INSTRUCTOR`/`ADMIN` y permite rutas sin `@Roles` | T2 |
| 4 | `prisma migrate diff` genera el SQL de `Project`, `ProjectSubmission` y el enum, y `psql \d "ProjectSubmission"` muestra `status`, `feedback`, `reviewedById`, `isPublic` y `publishedAt` | T3 |
| 5 | `npm run db:seed:projects` dos veces deja exactamente 4 proyectos publicados, uno por etapa 0–3, sin duplicar `slug` | T4 |
| 6 | `scoreSubmission` da `100` con todos los criterios en 4, `75` con todos en 3 y `85` con 4/4/4/4 y notas vacías; correctitud 0 devuelve `valid: false` | T5 |
| 7 | `readRubric` rechaza una rúbrica almacenada inválida con error de dominio y no produce notas | T5 |
| 8 | `GET /api/projects` sólo lista publicados, respeta `stage` y la paginación, y marca `submitted` sólo para las entregas del usuario del token | T7 |
| 9 | `POST /api/projects/:slug/submissions` exige `repoUrl` http(s) (`400`), rechaza proyectos no publicados (`404`) y guarda el `userId` del token | T8 |
| 10 | Dos entregas del mismo usuario al mismo proyecto crean dos filas y `mySubmissions` las devuelve de la más reciente a la más antigua | T8 |
| 11 | `POST …/review` con `STUDENT` responde `403`; con `INSTRUCTOR` responde `200` con `score` de dos decimales, `status: REVIEWED`, `feedback` y `reviewedById` | T9 |
| 12 | Una revisión con criterios incompletos o correctitud 0 responde `422` y deja la entrega en `SUBMITTED` con `score` anterior intacto | T9 |
| 13 | Una revisión con nota ≥ 80 escribe `CompetencyProgress` (nivel ≥ 3 y `evidenceCount` +1) para cada competencia del proyecto; con nota < 80 no escribe ninguna fila | T9 |
| 14 | `publish`/`unpublish` sólo funcionan para el autor (`404` para terceros) y actualizan `isPublic` y `publishedAt` | T10 |
| 15 | `GET /api/portfolio/:userId` responde sin cookie, sólo con entregas públicas, sin `email` y con `404` si el usuario no existe; `GET /api/portfolio/me` incluye las privadas | T10 |
| 16 | La web muestra catálogo, espacio de trabajo y portafolio con estados de carga, error, vacío y éxito, y las tres specs nuevas pasan | T13–T15 |
| 17 | `npm run typecheck && npm run lint && npm run test && npm run build` en la raíz termina en 0, con la base de 556 pruebas ampliada y sin dependencias nuevas | T18 |
| 18 | La verificación HTTP de §10 completa sus 16 comprobaciones sin procesos vivos, y `contratos-api.md` §4.10 y `modelo-datos.md` §6 describen lo implementado | T16–T18 |

---

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| El rol viaja en el token y un `STUDENT` promovido a `INSTRUCTOR` sigue sin poder revisar hasta renovar sesión | Medio | Documentado en §3; la verificación hace *re-login* tras el `UPDATE` de rol. Renovar el token es el comportamiento esperado de S3 |
| `Project.competencies` no existe en `modelo-datos.md` §6 | Medio | T3 lo añade al esquema y T16 actualiza el documento; sin competencias no hay evidencia que escribir |
| La semilla de proyectos y la de contenido quedan en dos comandos | Bajo | `db:seed:projects` es idempotente por `slug`; T4 lo documenta y la deuda queda en §3 |
| Una rúbrica guardada con pesos ≠ 100 rompería la escala de la nota | Alto | `readRubric` la rechaza con error de dominio antes de calcular, y la semilla pasa por `projectRubricSchema` |
| El portafolio público expone datos de más | Alto | Sólo `id`, `name` y `avatarUrl` del usuario; ninguna entrega privada; las comprobaciones 12–15 de §10 lo verifican sin cookie |
| `GET /api/portfolio/:userId` sin autenticación facilita enumerar usuarios | Bajo | Sólo devuelve lo publicado explícitamente y su límite de 120/min por IP; los `id` son `cuid`, no secuenciales |
| La revisión con nota ≥ 80 escribe en `CompetencyProgress` de S5 y podría pisar un nivel mayor | Medio | El adaptador sólo sube el nivel (`updateMany … level < 3`) y siempre incrementa `evidenceCount`; el test de T9 compara el nivel 4 previo |
| Las pruebas de API usan repositorio en memoria y no el SQL real | Medio | T3 valida la migración con `psql` y T18 recorre HTTP contra PostgreSQL con tres usuarios |
| Un proyecto sin competencias aprobaría sin dejar evidencia | Bajo | `competencies` es obligatorio en la semilla y T9 trata la lista vacía como no-op; T4 siembra siempre al menos dos códigos |

---

## 8. Fuera de alcance (aplazado con motivo)

- **Retroalimentación con IA (S8 completo).** Sin proveedor, sin presupuesto y sin `AiInteraction`; la revisión de S9 es humana y `feedback` es texto del instructor. Deuda registrada en §3.
- **Desbloqueo de la etapa siguiente por proyecto aprobado.** Requiere cambiar `progress.rules.ts` y su contrato (§4 de `prerequisitos-y-progreso.md`): S9 deja la nota y la evidencia, no la regla.
- **Edición de una revisión y su historial.** `reviewedAt`/`reviewedById` guardan la última revisión; no hay tabla de auditoría de notas.
- **Notificaciones y correo al estudiante aprobado.** No hay cola de correo en el proyecto; S3 sólo emite tokens.
- **Subida de artefactos, capturas o vídeo de defensa.** El portafolio enlaza repositorio y despliegue; el almacenamiento de objetos no se usa aquí.
- **Revisión por pares y rúbricas por tipo de actividad.** `rubricas-evaluacion.md` §2 define seis rúbricas específicas; S9 implementa la base y deja las demás para cuando existan esos flujos.

---


## 9. Bitácora

| Tarea | Commit | Verificación ejecutada | Resultado real |
|-------|--------|------------------------|----------------|
| T1 | — | — | — |
| T2 | — | — | — |
| T3 | — | — | — |
| T4 | — | — | — |
| T5 | — | — | — |
| T6 | — | — | — |
| T7 | — | — | — |
| T8 | — | — | — |
| T9 | — | — | — |
| T10 | — | — | — |
| T11 | — | — | — |
| T12 | — | — | — |
| T13 | — | — | — |
| T14 | — | — | — |
| T15 | — | — | — |
| T16 | — | — | — |
| T17 | — | — | — |
| T18 | — | — | — |

---

## 10. Verificación HTTP de cierre

**Precondiciones.** `docker compose up -d` con PostgreSQL en `5433`, migración `projects_rubrics` aplicada, `npm run db:seed:projects` ejecutado, API en `3001` y web en `3000`. Tres usuarios: A y B estudiantes recién registrados, C instructor (se cambia `User.role` por SQL y se vuelve a iniciar sesión para renovar el token). Script en `%TEMP%\codeai-s9\verify-s9.ps1` (fuera del repositorio).

| # | Comprobación | Esperado |
|---|--------------|----------|
| 1 | `POST /api/projects/<slug>/submissions` sin cookie | `401` + `x-trace-id` |
| 2 | Entrega con `repoUrl: "ftp://…"` | `400` con `details[].field = "repoUrl"` |
| 3 | Entrega a un `slug` inexistente | `404` |
| 4 | Entrega válida de A | `201`, `status: "SUBMITTED"`, `score: null`, `isPublic: false` |
| 5 | Segunda entrega de A al mismo proyecto | `201`; `GET /api/projects/<slug>` devuelve 2 en `mySubmissions` |
| 6 | `GET /api/projects?stage=0` | sólo proyectos publicados de E0; `meta.total` coincide |
| 7 | `POST …/review` con A (`STUDENT`) | `403` |
| 8 | C revisa 3/3/3/3/3 | `200`, `score: 75`, `status: "REVIEWED"`, `reviewedAt` no nulo |
| 9 | C revisa con `correctitud: 0` | `422 RULE_VIOLATION`; la entrega conserva `score: 75` |
| 10 | C revisa con 4 de 5 criterios | `422 RULE_VIOLATION` |
| 11 | C revisa 4/4/4/4/4 | `200`, `score: 100`; `CompetencyProgress` de A sube (`level ≥ 3`, `evidenceCount` +1) |
| 12 | `GET /api/portfolio/<A>` sin cookie antes de publicar | `200`, `entries: []`, `publicCount: 0`, sin `email` |
| 13 | A publica su entrega y se repite el portafolio | `isPublic: true`; el público devuelve 1 entrada |
| 14 | B intenta publicar la entrega de A; después A despublica | `404` para B; tras despublicar, el público vuelve a `0` |
| 15 | `GET /api/portfolio/me` de A vs. `/api/portfolio/<A>` | `/me` incluye las privadas; el público no |
| 16 | `GET /api/portfolio/<cuid inexistente>` y procesos al terminar | `404`; sin `node` vivo ni contenedores nuevos |

**RESUMEN:** pendiente (se completa en T18 con los números reales de cada comprobación).

---

## Documentos relacionados

- `docs/01-curriculo/rubricas-evaluacion.md` §1 y §3 — criterios, pesos, reglas duras y escala de conversión.
- `docs/03-arquitectura/contratos-api.md` §4.10 y §6 — contrato de proyectos y límites de peticiones.
- `docs/03-arquitectura/modelo-datos.md` §6 — `Project` y `ProjectSubmission`.
- `docs/04-plan-ejecucion/roadmap-sprints.md` §S9 — objetivo y criterio de cierre del sprint.
- `docs/04-plan-ejecucion/sprints/sprint-08-capa-ia.md` — sprint declarado como deuda, mismo formato de ficha.

