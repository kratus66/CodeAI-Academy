# Sprint 15 — Simulador de examen y preparación por certificación

> **Estado:** ⬜ pendiente · **Duración prevista:** 12–14 sesiones · **Depende de:** S14 (metadatos y banco reservado), S7 (repaso SM-2), S4 (competencias).
> **Ámbito:** módulo nuevo `exams` en `apps/api`, contratos en `packages/shared` y vistas en `apps/web`. Fichas detalladas al abrir el sprint.
> **Por qué existe:** practicar preguntas sueltas no entrena la resistencia de 130–180 minutos ni la gestión del tiempo, y sin simulacros la plataforma no puede decir con honestidad si alguien está listo para presentar.

---

## 1. Objetivo

Al cerrar el sprint, una persona puede:

- hacer un **simulacro completo** (forma A, B o C) o **aleatorio** de una certificación, con el número de preguntas y minutos oficiales, cronómetro en servidor, marcar para revisar y pantalla de revisión;
- hacer un **bloque por dominio** (`CHALLENGE`, 15–20 preguntas cronometradas);
- ver al entregar su resultado **por dominio**, cada pregunta con la explicación de cada opción y el enlace a la unidad del concepto;
- encontrar las preguntas falladas en su cola de repaso con prioridad alta;
- consultar su **panel de preparación** por certificación con el criterio «listo para presentar» desglosado;
- registrar, si quiere, el **resultado real** de su examen para calibrar la regla.

## 2. Decisiones de diseño

**2.1 Condiciones de examen reales.** Sin retroalimentación hasta entregar; el plazo lo fija y lo hace cumplir el servidor (entrega automática al vencer); opción de +30 minutos que imita la adaptación de AWS por idioma (🔎 condiciones a confirmar en T0 de S14).

**2.2 Puntuación honesta.** Porcentaje de aciertos global y por dominio. No se calcula ni se muestra una «puntuación escalada» que AWS no publica cómo obtiene.

**2.3 Formas fijas y exposición controlada.** Las formas A/B/C se definen en la semilla (lista ordenada de slugs del banco reservado). El aleatorio reparte por peso de dominio con redondeo por mayor resto y evita preguntas vistas en los últimos tres intentos de la persona.

**2.4 Reglas puras.** Armado, puntuación, reparto por dominio y evaluación de «listo para presentar» son funciones puras con sus pruebas, como `progress.rules.ts` y el motor SM-2.

**2.5 Lo no revisado es orientativo.** Si alguna pregunta de una forma no tiene `reviewedByHuman`, el resultado se marca «orientativo» y no cuenta para el criterio 2 de «listo para presentar».

## 3. Contratos previstos

```
POST /api/exams/:certification/attempts          { mode: "form-a" | "form-b" | "form-c" | "random" | "domain", domain?: number, extraTime?: boolean }
GET  /api/exams/attempts/:id                      // preguntas sin respuestas ni explicaciones, tiempo restante del servidor
PUT  /api/exams/attempts/:id/items/:position      { answer, flagged }
POST /api/exams/attempts/:id/submit
GET  /api/exams/attempts/:id/result               // sólo tras entregar: global, por dominio, revisión ítem a ítem
GET  /api/exams/:certification/history
GET  /api/exams/:certification/readiness          // criterio de curriculo-aws.md §6 desglosado
POST /api/exams/:certification/real-results       { passed: boolean, scaledScore?: number, takenOn: string } // opcional, privado
```

## 4. Tareas

| ID | Tarea | Responsable |
|----|-------|-------------|
| T1 | Contratos de `shared` (`exam.ts`): intento, ítem sin solución, resultado por dominio, preparación, resultado real | Constructor |
| T2 | Modelos `ExamAttempt`, `ExamAttemptItem`, `ExamForm`, `RealExamResult` y migración `exams` | Constructor |
| T3 | Semilla de formas (`aws/exam-forms/<CERT>.json`) y su validación: número de preguntas oficial, reparto por dominio dentro de ±1 del peso, sólo slugs `RESERVED` de la misma certificación | Constructor |
| T4 | Reglas puras: armado aleatorio por mayor resto, exclusión de vistas recientes, puntuación todo o nada, porcentajes por dominio | Constructor |
| T5 | Regla pura de «listo para presentar» (cuatro criterios, cada uno con su estado y lo que falta) | Constructor |
| T6 | Puerto `ExamRepository` con adaptadores Prisma y en memoria | Constructor |
| T7 | Servicio: ciclo de vida, plazo en servidor y entrega automática, aislamiento entre usuarios, ítems fallados → `ReviewItem` con prioridad | Constructor |
| T8 | Controlador con `JwtAuthGuard` y límites de frecuencia | Constructor |
| T9 | Web: sala de examen (cronómetro accesible, cuadrícula de navegación, marcar para revisar, revisión previa, aviso antes de salir) | Constructor |
| T10 | Web: informe por dominio y revisión ítem a ítem con plan de refuerzo (enlaces a unidades por concepto) | Constructor |
| T11 | Web: panel de preparación por certificación y registro opcional del resultado real | Constructor |
| T12 | Analítica para instructor: dominios débiles por cohorte y relación entre «listo para presentar» y resultados reales registrados | Constructor |
| T13 | Documentación: `contratos-api.md`, `modelo-datos.md`, `metodo-aws.md` §8–§9 | Orquestador |

## 5. Criterios de cierre

- [ ] Un intento no devuelve nunca respuestas ni explicaciones antes de entregar (prueba por endpoint).
- [ ] El servidor rechaza respuestas fuera de plazo y entrega solo el intento vencido.
- [ ] Un usuario no puede leer ni responder intentos de otro (`404` indistinguible).
- [ ] El aleatorio respeta los pesos (±1 pregunta por dominio) y no repite preguntas de los tres últimos intentos cuando el banco alcanza.
- [ ] La regla de preparación tiene pruebas de los cuatro criterios por separado y combinados.
- [ ] Suite completa, typecheck, lint y build en verde; verificación HTTP con dos usuarios.

## 6. Documentos relacionados

- [`../../01-curriculo/curriculo-aws.md`](../../01-curriculo/curriculo-aws.md) §6
- [`../../02-contenido/metodo-aws.md`](../../02-contenido/metodo-aws.md) §8–§9
- [`sprint-14-preguntas-examen.md`](sprint-14-preguntas-examen.md)
