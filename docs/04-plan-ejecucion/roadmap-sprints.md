# Roadmap de sprints

> **Plan vivo de construcción.** Define qué se construye, en qué orden y con qué criterio se considera terminado. La numeración coincide con la tabla de módulos de [`arquitectura-general.md`](../03-arquitectura/arquitectura-general.md) §5.

---

## 1. Reglas del plan

1. Un sprint tiene **un objetivo demostrable**, no una lista de deseos.
2. Nada se implementa sin una **ficha de tarea atómica** ([plantilla](../05-orquestacion/plantilla-tarea.md)) dentro de un sprint.
3. Un sprint cierra cuando `typecheck`, `lint`, `test` y `build` pasan en **todos** los workspaces.
4. El trabajo descubierto y no planificado se convierte en tarea del sprint siguiente, salvo que bloquee el objetivo actual.
5. La documentación afectada se actualiza en el mismo commit que el código.
6. El orden se respeta porque cada sprint consume contratos del anterior. No se adelanta UI sobre APIs inexistentes.

**Estados:** ✅ completado · 🔄 en curso · ⏳ siguiente · ⬜ pendiente

---

## 2. Vista general

| Sprint | Objetivo | Etapas | Módulos backend | Estado |
|--------|----------|--------|-----------------|--------|
| **S0** | Fundación técnica y landing pública | E0 | `health` | ✅ |
| **S1** | Identidad y acceso (registro, login, roles, sesión) | E0–E1 | `auth` (`users` y guard de roles entregados el 2026-10-28) | ✅ |
| **S2** | Modelo de datos y API de contenido | E1 | `content` | ✅ |
| **S3** | Plataforma de aprendizaje (catálogo y lección) | E1–E3 | `content` (lectura) | 🔄 |
| **S4** | Progreso, desbloqueos y competencias | E1–E4 | `progress` | ✅ |
| **S5** | Laboratorio de código (ejercicios + sandbox mock) | E2–E5 | `exercises`, `sandbox` | ✅ |
| **S6** | Corrección automática y pistas graduadas | E2–E7 | `exercises` | ✅ |
| **S7** | Repaso espaciado (SM-2) | E2–E7 | `review` | ✅ |
| **S8** | Capa de IA intercambiable y tutor socrático | E8–E9 | `ai` | ✅ implementado y verificado (2026-10-28); desbloquea S10 |
| **S9** | Proyectos, rúbricas y portafolio | E9–E11 | `projects` | ✅ completado (18/18 tareas; 18/18 criterios; HTTP 16/16) |
| **S10** | Simulaciones de entrevista | E11 | `interviews` | ✅ completado (17/17 tareas; 16/16 criterios; HTTP 16/16) |
| **S11** | Analítica, rendimiento y lanzamiento | E11 | `analytics` | ⬜ ficha |

> Son **12 sprints (S0–S11)**. Las etapas curriculares indicadas son el contenido que cada sprint hace *posible*, no lo que el sprint enseña.
>
> **Verificación (2026-10-28):** `typecheck`, `lint` y `build` en verde; suite `shared 241 · API 739 · web 220 = 1 200 pruebas`. Contenido sembrado: 12 etapas, 48 módulos, 207 unidades con 207 lecciones publicadas, 34 recursos y el banco de ejercicios. Existen los módulos `users` (con `RolesGuard`), `ai`, `projects` e `interviews`; falta `analytics` (S11).
>
> **Cierre acumulado (2026-10-28):** S0 ✅ 7/7 tareas · S1 ✅ 16/16 tareas y 12/12 criterios · S2 ✅ 10/10 tareas y 12/12 criterios · **S3 🔄 10/11 tareas y 10/10 criterios** (los cinco de navegador se comprobaron el 2026-10-28; queda S3-T11, el visto bueno pedagógico humano de las lecciones) · **S4 ✅ 10/10 tareas y 10/10 criterios** · **S5 ✅ 14/14 tareas y 13/13 criterios** · **S6 ✅ 16/16 tareas y 15/15 criterios** · **S7 ✅ 14/14 tareas y 12/12 criterios** · **S8 ✅ 14/14 tareas y 15/15 criterios** · **S9 ✅ 18/18 tareas y 18/18 criterios** · **S10 ✅ 17/17 tareas y 16/16 criterios**.

---

## 3. Detalle por sprint

### S0 — Fundación técnica y landing pública ✅

- **Objetivo:** monorepo verde (shared + API + web) con landing pública que comunica la ruta completa.
- **Entregables:** workspaces npm, `packages/shared` con contratos Zod, bootstrap NestJS con `/api/health`, trazabilidad y formato único de error, landing con 12 etapas / 4 niveles / C1–C14.
- **Criterio de salida:** `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` verdes; landing renderizada en producción local.
- **Cierre:** 7/7 tareas ✅ · suite completa verde · landing verificada con `next start`.
- **Ficha:** [`sprints/sprint-00-fundacion.md`](sprints/sprint-00-fundacion.md).

### S1 — Identidad y acceso ✅

- **Objetivo:** una persona puede registrarse, iniciar sesión y mantener sesión con roles.
- **Entregables:** Prisma + PostgreSQL y migración de identidad (`User`, `RefreshToken`), `auth` (registro, login, refresh, logout, `me`), guard JWT, cookies httpOnly, rate limiting de auth, pantallas de registro/login. Guard de roles y `@Public` se difieren a S3.
- **Criterio de salida:** pruebas de registro/login/refresh y de aislamiento entre usuarios; contraseñas hasheadas; ningún dato sensible en respuestas.
- **Estado (2026-10-26):** completo. Backend verificado por HTTP (S1-T1…S1-T13) y web con cliente de API, pantallas de acceso y sesión en cabecera (S1-T14…S1-T16). Diferidos a S3: guard de roles, `@Public` y módulo `users`.
- **Cierre:** 16/16 tareas ✅ · 12/12 criterios de aceptación ✅ · suite completa verde.
- **Ficha:** [`sprints/sprint-01-auth.md`](sprints/sprint-01-auth.md).

### S2 — Modelo de datos y API de contenido ✅

- **Objetivo:** el currículo vive en base de datos y se sirve por API paginada.
- **Entregables:** modelos de contenido en Prisma (Stage → Module → Unit → Lesson → Exercise) y su migración, seed idempotente desde JSON validado, `content` con etapas, módulos, unidades, lecciones y recursos.
- **Criterio de salida:** seed reproducible desde cero; listados `{ data, meta }`; esquemas Zod de contenido probados.
- **Cierre:** 10/10 tareas ✅ · 12/12 criterios de aceptación ✅ · 12 etapas / 48 módulos / 63 unidades sembradas de forma idempotente · suite completa verde.
- **Ficha:** [`sprints/sprint-02-contenido.md`](sprints/sprint-02-contenido.md).

### S3 — Plataforma de aprendizaje 🔄

- **Objetivo:** el estudiante navega la ruta y lee lecciones dentro de la app.
- **Entregables:** shell autenticado, catálogo de etapas/módulos, vista de unidad con navegación anterior/siguiente, lector de lección (bloques, 7 pasos y recursos) y estados de carga y error.
- **Criterio de salida:** recorrido completo etapa → módulo → unidad con datos reales de la API; sin contenido hardcodeado.
- **Estado (2026-10-27):** cierre técnico. Contrato ampliado (`units` en el módulo y `stageId` en la unidad), cliente `contentApi` con validación Zod, shell autenticado, catálogo, vista de etapa, vista de unidad y lector de lección implementados con 81 pruebas de web; verificado por HTTP contra PostgreSQL local y con `npm run build` en 0 (cuatro rutas nuevas).
- **Cierre:** 10/11 tareas ✅ · **10/10 criterios de aceptación ✅** (navegador comprobado el 2026-10-28) · S3-T11: la semilla trae 207 lecciones; la revisión pedagógica asistida está en [`../02-contenido/revision-pedagogica.md`](../02-contenido/revision-pedagogica.md) y **falta la firma humana** para cerrar el sprint.
- **Ficha:** [`sprints/sprint-03-aprendizaje.md`](sprints/sprint-03-aprendizaje.md).

### S4 — Progreso, desbloqueos y competencias ✅

- **Objetivo:** el avance se registra y desbloquea la siguiente unidad según prerequisitos.
- **Entregables:** `progress` (unidad completada, porcentaje, competencias trabajadas), reglas de desbloqueo, panel de avance.
- **Criterio de salida:** pruebas de reglas de desbloqueo y de aislamiento de progreso; reevaluación de fundamentos soportada por el modelo de datos.
- **Estado (2026-10-27):** completo. Contrato compartido, `UnitProgress` + `CompetencyProgress` con migración `progress_tracking`, reglas puras de desbloqueo y avance, puerto con adaptadores Prisma y en memoria, `ProgressService`, controlador `/api/progress` protegido por JWT, cliente `progressApi` con validación Zod y panel en `/learn/progress`.
- **Cierre:** 10/10 tareas ✅ · 10/10 criterios de aceptación ✅ · verificación HTTP real con dos usuarios (idempotencia `50 % → 50 %`, aislamiento, `404`, `409` y `401`) · suite completa verde (shared 83 · API 142 · web 93).
- **Ficha:** [`sprints/sprint-04-progreso.md`](sprints/sprint-04-progreso.md).

### S5 — Laboratorio de código

- **Objetivo:** el estudiante escribe y ejecuta código contra un sandbox en modo `mock`.
- **Entregables:** `exercises` (enunciado, casos de prueba), `sandbox` con interfaz y adaptador mock, editor Monaco cargado dinámicamente, envío y resultado.
- **Criterio de salida:** flujo escribir → ejecutar → enviar con pruebas; la app funciona sin sandbox real.
- **Cierre:** 14/14 tareas ✅ · 13/13 criterios de aceptación ✅ · verificación HTTP real con dos usuarios (aislamiento de envíos, `404` de unidad y ejercicio, `429` con `Retry-After`) · suite completa verde (shared 97 · API 179 · web 113).
- **Ficha:** [`sprints/sprint-05-laboratorio-codigo.md`](sprints/sprint-05-laboratorio-codigo.md).

### S6 — Corrección automática y pistas graduadas ✅

- **Objetivo:** el envío se evalúa y el estudiante recibe pistas sin la solución.
- **Entregables:** evaluador de casos, estados de envío, pistas por nivel (concepto → dirección → fragmento), historial de intentos.
- **Criterio de salida:** pruebas de evaluación y de que ninguna respuesta incluye la solución completa.
- **Estado (2026-10-27):** completo. Corrección automática con pruebas ocultas ponderadas, nivel alcanzado con su motivo, pistas graduadas 1→3 servidas del catálogo con registro de uso, tope de intentos, historial paginado y cuota de pistas por usuario; en la web, panel de pistas, nivel alcanzado en el resultado e historial de intentos con estados de carga, error y vacío.
- **Cierre:** 16/16 tareas ✅ · 15/15 criterios de aceptación ✅ · verificación HTTP real con dos usuarios (45 comprobaciones: `422` fuera de orden, `409` al superar `maxAttempts`, historial aislado sin pruebas ocultas y `429` con `Retry-After`) · suite completa verde (shared 112 · API 238 · web 131).
- **Ficha:** [`sprints/sprint-06-correccion-pistas.md`](sprints/sprint-06-correccion-pistas.md).

### S7 — Repaso espaciado ✅

- **Objetivo:** los fundamentos se reevalúan a lo largo del tiempo (regla permanente 4).
- **Entregables:** `review` con algoritmo SM-2, cola diaria, registro de aciertos/errores por competencia.
- **Criterio de salida:** pruebas del cálculo de intervalos y de la cola; el repaso aparece en la app.
- **Estado (2026-10-27):** completo. `ReviewItem`/`ReviewLog` con migración `spaced_repetition`, motor SM-2 puro (1 → 6 → ~16 días), calidad derivada del envío corregido con la penalización por pistas de nivel 3+, cola diaria de 30 intercalada por concepto, `dueReviews` real en el progreso y cola en `/learn/review` con las seis calidades.
- **Cierre:** 14/14 tareas ✅ · 12/12 criterios de aceptación ✅ · verificación HTTP real con dos usuarios (51 comprobaciones: cola, respuesta, aislamiento, validación, `404`, repaso programado por el envío y `dueReviews`) · suite completa verde (shared 132 · API 280 · web 144).
- **Ficha:** [`sprints/sprint-07-repaso-espaciado.md`](sprints/sprint-07-repaso-espaciado.md).

### S8 — Capa de IA intercambiable y tutor socrático

- **Objetivo:** la IA asiste sin entregar soluciones y con costo acotado.
- **Entregables:** `AIProvider` (mock + proveedor real), tutor con contexto de lección, explicación de errores, presupuesto por usuario, auditoría de llamadas.
- **Criterio de salida:** pruebas con proveedor mock determinista; límites de gasto verificados; ningún módulo importa un SDK concreto.
- **Orden:** se ejecutó **después de S9** (decisión del 2026-10-28). Ver `sprint-08-capa-ia.md` §2, «Relación con S9».
- **Estado:** ✅ 14/14 tareas. Entrega `AiService`, puerto `AiProvider` (`mock` y `openai`), presupuesto 70/90/100 %, auditoría `AiInteraction`, guardas contra fuga y `aiApi` en la web. Es el requisito que S10 declaraba pendiente.
- **Ficha:** [`sprints/sprint-08-capa-ia.md`](sprints/sprint-08-capa-ia.md).

### S9 — Proyectos, rúbricas y portafolio

- **Objetivo:** cada etapa produce un entregable evaluable y acumulable.
- **Entregables:** `projects` (entrega, rúbrica, feedback), portafolio público del estudiante.
- **Criterio de salida:** rúbricas aplicables por competencia; entregas privadas salvo publicación explícita.
- **Estado (2026-10-28):** completo. Ficha cerrada con **18/18 tareas y 18/18 criterios**: contrato compartido (`project.ts`), `@Roles`/`RolesGuard`, modelos `Project`/`ProjectSubmission` con la migración `projects_rubrics` aplicada, semilla de cuatro proyectos (E0–E3), motor puro de nota, puerto `ProjectsRepository` con adaptadores Prisma y en memoria, servicio de catálogo/entrega/revisión/publicación/portafolio, controladores con límites de 120/min, `projectsApi`/`portfolioApi` en la web y las tres vistas (catálogo, espacio de trabajo, portafolio público).
- **Cierre:** verificación HTTP real con tres usuarios, **16/16 comprobaciones** (notas 75 y 100, `422` sin persistir, `CompetencyProgress` en nivel 3, portafolio que pasa de 0 a 1 y vuelve a 0) · suite completa verde (**shared 205 · API 384 · web 172 = 761 pruebas**), typecheck, lint y build en 0.
- **Ficha:** [`sprints/sprint-09-proyectos-rubricas.md`](sprints/sprint-09-proyectos-rubricas.md).

### S10 — Simulaciones de entrevista

- **Objetivo:** el egreso se defiende con práctica de entrevista técnica.
- **Entregables:** `interviews` (guiones, sesión, transcripción, evaluación), banco de preguntas por competencia.
- **Criterio de salida:** simulación completa registrada y evaluada; permite repetir y comparar.
- **Estado (2026-10-28):** completo. **17/17 tareas y 16/16 criterios.** Entrega contrato compartido (`interview.ts`), modelos `InterviewScenario`/`InterviewSession` con la migración `interviews` aplicada, semilla de **9 escenarios** (3 roles × 3 niveles), lectores de `Json` con `422` de dominio, puerto `InterviewRepository` con adaptadores Prisma y en memoria, servicio con el ciclo completo (inicio → turnos → cierre → autoevaluación → revisión → historial), 9 rutas con `RolesGuard` en la revisión, `interviewsApi` y las tres vistas (catálogo, sala, informe), más la revisión para instructores.
- **Cierre:** verificación HTTP real con tres usuarios, **16/16 comprobaciones** (turno degradado con `AI_PROVIDER=mock`, `409` de sesión abierta, `404` indistinguible, nota 85 con evidencia C10 nivel 3 y 76.25 sin evidencia, historial `best`/`average`) · suite completa verde (**shared 241 · API 739 · web 220 = 1 200 pruebas**), typecheck, lint y builds en 0.
- **Ficha:** [`sprints/sprint-10-entrevistas.md`](sprints/sprint-10-entrevistas.md).

### S11 — Analítica, rendimiento y lanzamiento

- **Objetivo:** operar la plataforma con datos y sin sorpresas.
- **Entregables:** `analytics` (progreso, errores frecuentes, cohortes), caché, observabilidad, despliegue y respaldos.
- **Criterio de salida:** métricas visibles para instructor/admin; checklist de producción cumplido.
- **Deuda heredada que se paga aquí:** actualización de `next` (crítico de producción) y de la cadena `vitest`/`vite` (solo desarrollo), documentadas en [`seguridad-dependencias.md`](../03-arquitectura/seguridad-dependencias.md).
- **Ficha:** [`sprints/sprint-11-analitica-lanzamiento.md`](sprints/sprint-11-analitica-lanzamiento.md).

---

## 4. Dependencias

```
S0 ──► S1 ──► S2 ──► S3 ──► S4 ──► S5 ──► S6 ──► S7 ──► S9 ──► S8 ──► S10 ──► S11
```

- **S3** requiere S1 (sesión ✅) y S2 (contenido).
- **S6** requiere S5 (envíos); S7 puede solaparse con S6.
- **S8** requiere S7: no se automatiza docencia sin reglas de evaluación probadas. **Se ejecuta después de S9** (2026-10-28): la dependencia es unidireccional —S8 no toca tablas de proyectos— y así S9 se cierra con revisión humana sin esperar a la IA.
- **S9–S11** requieren el dominio completo de fundamentos y calidad (E7).
- **S10** requiere S8 (entrevistador por turnos, presupuesto y filtro de fuga) y S9 (motor de rúbricas y `RolesGuard`); **cumplido**: ambos cerrados antes de S10 y la verificación HTTP de S10 pasó 16/16.
- **S11** cierra la deuda técnica: actualización de dependencias con avisos críticos, `ready`, respaldos y despliegue. Requiere Docker para sus dos últimas tareas.

---

## 5. Cómo se actualiza

Al cerrar un sprint, el Orquestador:

1. Ejecuta la suite completa.
2. Marca las casillas de la ficha del sprint.
3. Cambia el estado en este documento.
4. Escribe el resumen (construido / desviado / pendiente).
5. Redacta la primera ficha del sprint siguiente.

---

## Documentos relacionados

- [`sprints/sprint-00-fundacion.md`](sprints/sprint-00-fundacion.md)
- [`convenciones-codigo.md`](convenciones-codigo.md)
- [`../05-orquestacion/guia-orquestador-claude.md`](../05-orquestacion/guia-orquestador-claude.md)
- [`../07-flujo-operativo.md`](../07-flujo-operativo.md)
