# Revisión pedagógica de las lecciones

> Registro de la revisión de las 207 lecciones sembradas (E0–E11) contra [`fundamentos-pedagogicos.md`](../00-vision/fundamentos-pedagogicos.md) §5 y §7 y [`plantilla-leccion.md`](../06-plantillas/plantilla-leccion.md).
> **Fecha:** 2026-10-28 · **Responsable de esta pasada:** Claude (revisión asistida por IA).

---

## 1. Qué es y qué no es este documento

| Es | No es |
|----|-------|
| Una auditoría **completa y repetible** de las 207 lecciones contra las reglas comprobables del método. | Una **validación pedagógica humana**. S3-T11 exige revisión humana y **sigue abierta** hasta que alguien firme §7. |
| Una lectura **cualitativa en profundidad de una muestra** (§3.3), con exactitud técnica incluida. | Una lectura de las 207 lecciones palabra por palabra: eso no ocurrió. |
| Un listado de defectos corregidos y de hallazgos que **siguen abiertos**. | Una certificación de que el material funciona con estudiantes reales: no hay datos de cohortes. |

Una regla puede cumplirse en la forma y fallar en el fondo (una práctica «sin pistas» que sigue siendo una variación superficial del ejemplo, por ejemplo). Eso solo lo detecta una persona que resuelva las prácticas; por eso §7 deja el visto bueno humano como condición de cierre.

---

## 2. Método

| Capa | Qué hace | Cobertura | Dónde vive |
|------|----------|-----------|------------|
| **A. Guardas automáticas** | Reglas objetivas que fallan si la semilla se degrada | 207/207 | `apps/api/src/modules/content/seed-lesson-quality.spec.ts` |
| **B. Auditoría heurística** | Búsqueda de patrones de texto para localizar candidatos a defecto | 207/207 | Resultados en §3.2 (no se versiona; produce falsos positivos) |
| **C. Lectura cualitativa** | Lectura del contenido completo con ojo pedagógico y técnico | Muestra (§3.3) | Hallazgos en §4 |

Las guardas (A) se comprobaron en rojo contra la semilla anterior a esta revisión (fallaban «sin pistas en la práctica independiente» y «material visual por familia») y en verde tras las correcciones.

---

## 3. Resultados

### 3.1 Lista de verificación de `fundamentos-pedagogicos.md` §7

| Verificación | Estado | Evidencia |
|--------------|--------|-----------|
| Objetivo como capacidad observable | ✅ con reservas | Las 207 abren con «Al terminar podrás…» (o «serás capaz de…») + verbo de acción (escribir, implementar, diseñar, explicar, identificar…); ningún objetivo abre con «entender/conocer/comprender». Falta confirmar con una persona que cada verbo sea **medible** con la práctica asociada. |
| Un ejercicio por nivel de dominio declarado | ⚠️ parcial | Cada lección trae práctica guiada (N2) e independiente (N3) **como enunciado de texto**. El seed **no incluye ejercicios**: la plataforma no puede registrar ni corregir esos intentos (hallazgo H1). |
| Versión de la práctica sin pistas (Nivel 3) | ✅ tras corregir | 2 lecciones llevaban `(pista: …)` en la independiente; retiradas. Guarda A lo impide en adelante. |
| Errores esperados enumerados y explicados | ✅ | 205 lecciones con 2 bloques «Error común» y 2 con 3; todos con causa y solución (guarda A). |
| Actividad de recuperación programable | ⚠️ parcial | Las 207 tienen paso 6 «sin apuntes» con criterio de paso, pero las preguntas **no declaran `concept`** para SM-2 (H1). |
| Ítem de transferencia ligado a tarea real o entrevista | ✅ | Las 207 traen variante con restricción y «Pregunta de cierre» (guarda A). La pregunta de cierre explora límites («¿cuándo no…?») en la inmensa mayoría; 1 no lo hacía y se corrigió. |
| Material visual de la familia de concepto | ✅ tras corregir | Había 2 diagramas en 207 lecciones. Se añadieron 13 (ver §5); cubren asincronía, HTTP/API, arquitectura, base de datos, RAG/embeddings y agentes. |
| Justificación del estudiante obligatoria y evaluable | ⚠️ no verificable aún | Los pasos 5–7 piden «anota/explica/justifica», pero no existe un campo estructurado ni rúbrica que lo evalúe hasta S9 (H3). |

### 3.2 Auditoría heurística (capa B)

Cifras sobre las 207 lecciones, **antes** de las correcciones. Las reglas de texto sobreestiman: sirvieron para localizar candidatos que luego se leyeron.

| Señal | Lecciones | Lectura |
|-------|-----------|---------|
| Pasos en orden canónico, 7 de 7 | 207 | Sin hallazgo |
| Duración 45–90 min | 207 (18×45 · 120×60 · 64×75 · 5×90) | Sin hallazgo |
| Paso 6 con 4–5 preguntas numeradas | 202 (198×4 · 4×5) | Las 5 lecciones restantes («preguntas de entrevista») plantean 5 preguntas conceptuales en prosa; aceptable |
| Práctica independiente con `(pista:` | 2 | **Defecto real** → corregido |
| Pregunta de cierre sin explorar límites | 1 | **Defecto real** → corregido |
| Familia que exige diagrama sin bloque `diagram` | 19 candidatas por palabra clave | **Defecto real** en 13 → diagramas añadidos. Las otras 6 se dejaron fuera a propósito (p. ej. `pull-requests-y-revision-de-codigo` no es la familia HTTP). `modelo-entidad-relacion` ya tenía el suyo. Que sea una lista por criterio del revisor, no exhaustiva, queda como H6 |
| Paso de depuración sin acción de verificación ejecutable | 13 | Revisadas a mano: 6 son de juicio sin evidencia exigida (H2) y 7 sí piden comprobar con casos o fuentes (falso positivo) |
| Lecciones sin recurso externo | 175 | No es defecto: el catálogo es complementario y solo hay 34 recursos verificados |

### 3.3 Lectura cualitativa (capa C)

Leídas completas: `event-loop-stack-microtasks-macrotasks`, `transacciones-y-propiedades-acid`, `cabeceras-de-seguridad-y-https`, `del-requisito-al-despliegue`, `roles-en-un-equipo-tecnico`, `promesas-estados-encadenamiento-y-errores`, `preguntas-de-entrevista-sql-y-modelado`, `generacion-probabilistica-y-alucinaciones`.
Leídas en idea central y ejemplo resuelto (para ubicar el diagrama): las 13 de §5.
Leídos los pasos de depuración de: las 13 señaladas por la heurística y 5 de la muestra restante.

**Lo que está bien hecho** (conviene conservarlo al ampliar el currículo):
- Los ejemplos resueltos **muestran el razonamiento**, no solo la solución (p. ej. la traza del event loop explica *por qué* `then B` corre antes que el `setTimeout`).
- Los errores comunes se escriben como *causa → cómo detectarlo → solución*, que es lo que permite autodiagnosticar.
- La evaluación abre con «Sin mirar…» y fija un umbral de paso: recuperación activa real.
- 78 lecciones anclan el concepto en código real de este proyecto (ejemplo concreto), y varias prácticas independientes piden analizar ese código en lugar de repetir el ejemplo: es transferencia genuina.
- El tono es consistente y el código está en inglés con texto en español.

---

## 4. Hallazgos abiertos

| ID | Hallazgo | Impacto pedagógico | Propuesta | Dueño sugerido |
|----|----------|--------------------|-----------|----------------|
| **H1** | El seed no trae ejercicios (`exercises: []`). Las prácticas guiada e independiente son texto; ninguna se corrige ni se registra. Las preguntas del paso 6 no declaran `concept` para el repaso. | **Alto.** «Leer el texto no acredita nada» (§6 de fundamentos): hoy el Nivel 2–3 no es certificable por la plataforma. | Sembrar ejercicios `LAB`/`QUIZ` por lección, empezando por los conceptos críticos de E2, E5 y E6; añadir `concept` a cada pregunta. Usar `plantilla-ejercicio.md`. | Autoría de contenido + S5/S6 |
| **H2** | En 6 lecciones de dominios de juicio (`cuando-no-usar-ia`, `que-contexto-aportar-repositorio-convenciones-y-documentacion`, `ejercicios-cronometrados`, `analisis-de-vacantes-y-perfiles`, `repositorio-y-portafolio`, `streaming-de-respuestas`) el paso 5 pide «evaluar» la respuesta de la IA sin exigir evidencia ejecutada ni escrita. En `streaming-de-respuestas` además el estudiante *fabrica* el defecto que luego detecta. | Medio. Debilita el «Nivel B»: se puede aprobar aceptando la intuición. | Entregar un artefacto con el defecto plantado y pedir: qué falla, por qué, cómo lo comprobaste, qué cambiaste. | Revisor humano |
| **H3** | La justificación del estudiante (qué decidiste / qué descartaste / qué consecuencia) no tiene campo estructurado ni evaluación. | Medio. La elaboración queda como buena intención. | Resolver en S9 con la rúbrica de justificación (15 %); mientras tanto, no declarar «elaboración evaluada». | S9 |
| **H4** | 78 lecciones citan código del repositorio y 15 usan nomenclatura interna (`S3`, `S2-T9`, rutas `apps/…`). Un estudiante que no tenga este repositorio no puede seguirlas, y el contenido envejece con el código. | Medio. Rompe el ejemplo concreto si el código cambia. | Fijar un commit de referencia en cada cita o extraer el fragmento al cuerpo de la lección; sustituir `S3` por una descripción («cuando se añadió `units`»). | Revisor humano |
| **H5** | 52 lecciones tienen menos de 700 palabras con 45–60 min declarados. | Bajo. El tiempo lo dominan las prácticas, pero conviene contrastar la duración con estudiantes reales. | Medir tiempo real en la primera cohorte (hay que instrumentarlo en S4/S11). | Producto |
| **H6** | La práctica independiente suele ser un problema nuevo, pero ninguna regla comprueba que **no sea una variación superficial** del ejemplo. | Medio. Es el riesgo central que el método declara (§2 de fundamentos). | Que el revisor humano resuelva la práctica independiente de la muestra de §6 antes de firmar. | Revisor humano |

---

## 5. Correcciones aplicadas en esta pasada (17 cambios en `content.seed.json`; la segunda pasada añade 20 más, ver §5.1)

| Cambio | Lecciones | Motivo (fundamentos §) |
|--------|-----------|------------------------|
| Bloque `diagram` en ASCII + frase en el paso 2 que pide explicarlo sin mirar el texto | `event-loop-stack-microtasks-macrotasks` (traza de pila/colas), `promesas-estados-encadenamiento-y-errores`, `async-await`, `http-metodos-cabeceras-y-codigos-de-estado`, `autenticacion-sesiones-jwt-y-refresh-tokens`, `arquitectura-por-capas-y-separacion-de-responsabilidades`, `arquitectura-por-capas-y-limites-de-modulos`, `relaciones-1-1-1-n-y-n-m`, `embeddings-y-busqueda-semantica`, `rag-arquitectura-de-recuperacion-aumentada`, `ciclos-de-decision-y-ejecucion`, `chatbot-flujo-automatizado-y-agente-diferencias-reales`, `uso-de-herramientas-por-modelos-en-un-agente` | §3.5 representación dual; la frase añade autoexplicación (elaboración) |
| Retirar `(pista: …)` de la práctica independiente | `pruebas-extremo-a-extremo`, `fallos-parciales-reintentos-e-idempotencia` | §7: Nivel 3 sin pistas |
| Pregunta de cierre sobre límites («¿cuándo no usarías un Worker…?») | `event-loop-stack-microtasks-macrotasks` | `plantilla-leccion.md` §7 |
| Sustituir «transacción de dos fases» por compensación (saga) + idempotencia | `transacciones-y-propiedades-acid` | Exactitud técnica: una API de pago externa no participa en el `ROLLBACK` ni en un commit de dos fases |

Los diagramas son texto preformateado porque el lector renderiza `diagram` como bloque monoespaciado. Si en S11 se adopta un renderizador de grafos, deben migrarse.

---

## 5.1 Segunda pasada: resolución de hallazgos (2026-10-28)

| ID | Estado | Qué se hizo |
|----|--------|-------------|
| **H2** | ✅ resuelto | Las 6 lecciones de juicio ahora entregan un **artefacto con el defecto plantado** («Te damos…») y exigen anotar qué falla, por qué, cómo se comprobó y qué se cambió: respuesta de IA que minimiza el riesgo, prompt con contexto sobrante, plan de 45 min sin verificación, análisis de vacante con errores, README insuficiente y `JSON.parse` sobre fragmentos de un stream. Guarda automática en `seed-lesson-quality.spec.ts`. |
| **H4** | 🔄 parcial | Eliminadas las **14 citas a la nomenclatura interna** (`S1`…`S11`, `S2-T9`) en 13 lecciones, sustituidas por descripciones. Guarda automática para que no reaparezcan (excluye «S3» de Amazon). **Sigue abierto:** 78 lecciones usan código de este repositorio como ejemplo concreto y 22 citan rutas (`apps/…`); fijar un commit de referencia exige decidir qué commit y revisar cada fragmento. |
| **H1** | 🔄 parcial (E0–E2 poblados el 2026-10-28: 864 ejercicios publicados sin revisión humana, ver `plan-poblado-banco-e0-e2.md` §4.1; E3–E11 siguen sin ejercicios) | **Hecho:** la semilla ya soporta ejercicios (`contentSeedExerciseSchema`, reglas duras de `plantilla-ejercicio.md` validadas, carga idempotente en `seed.mts`) y hay un piloto de 3 ejercicios (`js-async-001` guiado, `js-async-002` autónomo sin pistas, `js-async-003` depuración) cuyas soluciones oficiales se **ejecutan** en una prueba. **Falta:** autoría del resto (cientos de ejercicios con revisión humana) y un sandbox real. Los 3 quedan **sin publicar**: el sandbox `mock` da `PASSED` a cualquier código sin `TODO`, así que publicarlos certificaría competencias sin comprobar (guarda en `seed-exercise-quality.spec.ts`). |
| **H3** | ⬜ abierto | Depende de la rúbrica de justificación de S9 y de un campo estructurado en las entregas; no hay dónde evaluarlo todavía. |
| **H5** | ⬜ abierto | Requiere tiempos reales de estudiantes; no se puede inferir leyendo el texto. |
| **H6** | ⬜ abierto | Requiere que una persona resuelva las prácticas independientes de la muestra; es parte del visto bueno de §6. |

---

## 6. Protocolo para el visto bueno humano (cierra S3-T11)

**Muestra mínima:** 24 lecciones (2 por etapa, una de la primera unidad y una de las de mayor riesgo técnico: seguridad, SQL, RAG, agentes), más las 13 con diagrama nuevo.

**Por cada lección, la persona revisora:**
1. Resuelve la práctica **independiente** sin mirar el ejemplo y anota el tiempo real.
2. Comprueba que ninguna afirmación técnica sea falsa o esté desactualizada (consultando la fuente oficial).
3. Contesta las preguntas del paso 6 sin apuntes: si no puede, o la pregunta es ambigua o la lección no la enseña.
4. Valora el diagrama (si lo hay): ¿se entiende sin el texto?

| Etapa | Lecciones revisadas | Defectos hallados | Revisor/a | Fecha | Aprobada |
|-------|---------------------|-------------------|-----------|-------|----------|
| E0 | | | | | ☐ |
| E1 | | | | | ☐ |
| E2 | | | | | ☐ |
| E3 | | | | | ☐ |
| E4 | | | | | ☐ |
| E5 | | | | | ☐ |
| E6 | | | | | ☐ |
| E7 | | | | | ☐ |
| E8 | | | | | ☐ |
| E9 | | | | | ☐ |
| E10 | | | | | ☐ |
| E11 | | | | | ☐ |

**S3-T11 se da por cerrada** cuando las 12 filas estén aprobadas y H4 (citas de código) y H6 estén resueltos o aceptados por escrito. H2 ya está resuelto. H1, H3 y H5 no bloquean S3: dependen de otros sprints o de datos de cohortes.

---

## Documentos relacionados

- [`../00-vision/fundamentos-pedagogicos.md`](../00-vision/fundamentos-pedagogicos.md)
- [`../06-plantillas/plantilla-leccion.md`](../06-plantillas/plantilla-leccion.md)
- [`../06-plantillas/plantilla-ejercicio.md`](../06-plantillas/plantilla-ejercicio.md)
- [`../04-plan-ejecucion/sprints/sprint-03-aprendizaje.md`](../04-plan-ejecucion/sprints/sprint-03-aprendizaje.md)
