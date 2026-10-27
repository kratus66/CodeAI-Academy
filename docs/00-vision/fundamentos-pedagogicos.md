# Fundamentos pedagógicos

> Base investigativa del método de CodeAI Academy. La metodología no se elige por moda: se elige por evidencia sobre memoria, práctica y aprendizaje.

---

## 1. Las seis estrategias respaldadas por la investigación

La literatura sobre aprendizaje (en particular la síntesis de estrategias cognitivas publicada en *Cognitive Research: Principles and Implications*) identifica seis estrategias con respaldo empírico. CodeAI Academy las adopta íntegramente y las traduce a mecánicas concretas de software.

| Estrategia | Definición breve | Traducción a CodeAI Academy | Mecanismo en la plataforma |
|-----------|------------------|---------------------------|---------------------------|
| **Práctica espaciada** | Distribuir la práctica en el tiempo en lugar de concentrarla | Un concepto se reevalúa al día siguiente, a la semana y dentro de proyectos posteriores | Motor SM-2 + `ReviewItem` |
| **Recuperación activa** | Recuperar de memoria en vez de releer | Antes de ver la solución, el estudiante predice, explica o escribe el código | Bloqueo de revelación + `QuizAttempt` |
| **Intercalado** | Mezclar tipos de problemas para entrenar la discriminación | Ejercicios que mezclan lógica, pruebas, APIs y depuración sin anunciar la categoría | `Exercise.stacking` (conceptos cruzados) |
| **Elaboración** | Explicar el *porqué* y conectar con conocimiento previo | Justificar decisiones, alternativas y consecuencias | Campo obligatorio de justificación en entregas |
| **Ejemplos concretos** | Anclar lo abstracto en casos reales | Cada concepto con un caso de negocio o bug real | `Lesson.concreteExample` |
| **Representación dual (visual + verbal)** | Combinar diagrama y explicación | Diagramas de arquitectura, animaciones de asincronía y flujos | Bloque `diagram` en lecciones |

---

## 2. Advertencia epistemológica obligatoria

Estas estrategias **no garantizan por sí solas** que alguien se convierta en experto. Su eficacia depende de:

1. **Cómo se implementan** (una mala implementación de recuperación activa produce frustración sin aprendizaje).
2. **El conocimiento previo** del estudiante (los novatos necesitan más andamiaje; los expertos se benefician del intercalado agresivo).
3. **La calidad de los ejercicios** (un ejercicio ambiguo entrena la conducta equivocada).

**Consecuencia de diseño:** la plataforma debe medir tanto el **desempeño inmediato** como la **capacidad de resolver problemas nuevos** (transferencia). Si solo mide el primero, está certificando memorización.

---

## 3. Cómo se aplica cada estrategia, con ejemplo

### 3.1 Repetición espaciada

**Ejemplo canónico del currículo:** promesas en JavaScript.

| Momento | Actividad |
|---------|-----------|
| Día 0 | Lección + ejercicio guiado de `async/await` |
| Día 1 | Ejercicio de recuperación: predecir el orden de logs en un fragmento asíncrono |
| Día 4 | Reto semi-autónomo: corregir un `try/catch` que no captura el rechazo |
| Día 12 | Aplicación en proyecto: consumir una API con reintentos |
| Día 30 | Pregunta acumulativa en evaluación de módulo |

**Regla:** un concepto no se considera consolidado hasta haber sido recuperado con éxito al menos **3 veces** tras intervalos crecientes.

### 3.2 Recuperación activa

Nunca se muestra una solución antes de un intento registrado. El orden forzado es:

```
Enunciado → Predicción/Intento (registrado) → Retroalimentación → Solución → Explicación del estudiante
```

Si el estudiante abre la solución sin intento, la actividad pierde valor formativo y se marca como **no válida para la competencia** (aunque cuente como lectura).

### 3.3 Intercalado

Los ejercicios acumulativos **no anuncian** qué técnica usar. El estudiante debe decidir: ¿esto se resuelve con un `JOIN`, con una caché o con una validación de entrada? Entrenar esa decisión es el objetivo real del intercalado.

### 3.4 Explicación del porqué (elaboración)

Todo entregable incluye un campo estructurado de justificación:

```
¿Qué decidiste? / ¿Qué alternativa descartaste? / ¿Qué consecuencia tiene tu elección?
```

Este campo se evalúa con la rúbrica (peso 15 %) y **no puede quedar vacío**.

### 3.5 Ejemplos visuales (representación dual)

Tipos de material visual obligatorios por familia de concepto:

| Familia de concepto | Representación visual requerida |
|---------------------|--------------------------------|
| Asincronía / event loop | Animación del stack, microtasks y macrotasks |
| HTTP / API | Diagrama de secuencia request-response |
| Arquitectura | Diagrama de componentes y flujo de datos |
| Base de datos | Diagrama entidad-relación |
| RAG / embeddings | Diagrama de pipeline de recuperación |
| Agentes | Grafo de decisión y ejecución de herramientas |

### 3.6 Retroalimentación y corrección

Cada error produce un ciclo cerrado obligatorio:

```
Error → Explicación del error (no solo "incorrecto") → Oportunidad de corrección → Nuevo ejercicio del mismo concepto
```

El sistema no avanza si el error no ha sido corregido; lo reprograma en el calendario de repaso con prioridad alta.

---

## 4. Niveles de dominio (escala de certificación)

La plataforma certifica competencias en cuatro niveles. Esta escala es la **unidad de medida oficial** de todo el proyecto.

| Nivel | Nombre | Definición operativa | Evidencia requerida |
|-------|--------|----------------------|---------------------|
| **1** | Comprensión | Reconoce conceptos, explica definiciones, entiende ejemplos | Quiz + explicación escrita |
| **2** | Aplicación guiada | Resuelve problemas similares con pistas y referencias | Laboratorio con pistas disponibles |
| **3** | Dominio independiente | Resuelve un problema **nuevo**, prueba su solución y explica sus decisiones | Laboratorio sin pistas + tests propios + justificación |
| **4** | Transferencia profesional | Resuelve con restricciones reales, compara alternativas y defiende decisiones ante revisión | Proyecto con requisitos en conflicto + defensa técnica |

### Regla de avance

> Para desbloquear módulos que dependen de competencias previas:
> - **≥ 80 %** de cumplimiento en la evaluación del módulo, y
> - **Nivel 3** en todas las competencias marcadas como críticas.

El 80 % es una regla inicial; se ajustará con datos de las primeras cohortes.

---

## 5. La microestructura: los 7 pasos de una lección

Toda lección de CodeAI Academy sigue la misma estructura. Esto reduce carga cognitiva (el estudiante siempre sabe en qué fase está) y garantiza las seis características.

| Paso | Nombre | Propósito pedagógico | Estrategia activada |
|------|--------|---------------------|---------------------|
| 1 | **Objetivo medible** | Saber qué debe poder *hacer* al terminar | Expectativa clara |
| 2 | **Explicación y ejemplo resuelto** | Andamiaje inicial con errores comunes | Ejemplo concreto + dual coding |
| 3 | **Práctica guiada** | Completar código con pistas progresivas | Aplicación guiada (Nivel 2) |
| 4 | **Práctica independiente** | Problema nuevo sin solución visible | Dominio independiente (Nivel 3) |
| 5 | **Depuración y revisión con IA** | Usar IA pero verificar su propuesta | Nivel B del curso |
| 6 | **Recuperación y evaluación** | Recordar sin apuntes | Recuperación activa |
| 7 | **Transferencia al mundo real** | Conectar con tarea real o pregunta de entrevista | Transferencia (Nivel 4) |

Plantilla completa en [`../06-plantillas/plantilla-leccion.md`](../06-plantillas/plantilla-leccion.md).

---

## 6. Ejemplo completo aplicado: lección de promesas

Mostrar una definición de promesa no es enseñar promesas. La lección real exige que el estudiante:

1. **Prediga** el resultado de un fragmento de código asíncrono (recuperación activa).
2. **Explique** qué ocurre cuando una promesa se resuelve o se rechaza (elaboración).
3. **Complete** una función que consume una API real (práctica guiada).
4. **Detecte** un error de manejo asíncrono en código ajeno (intercalado + depuración).
5. **Escriba pruebas** para el caso de éxito y el de fallo (evaluación profesional).
6. **Pida a la IA una revisión** y evalúe críticamente sus sugerencias (Nivel B).
7. **Resuelva otro problema similar** días después (repetición espaciada).
8. **Explique el concepto en voz alta** como si estuviera en una entrevista (transferencia).

Solo cuando los 8 puntos están registrados se marca la competencia como adquirida. **Leer el texto no acredita nada.**

---

## 7. Obligaciones del diseñador de contenido

Quien redacte una lección, ejercicio o evaluación debe verificar esta lista antes de publicarla:

- [ ] El objetivo está escrito como capacidad observable ("implementar", "depurar", "justificar"), no como tema ("promesas").
- [ ] Hay al menos un ejercicio por cada nivel de dominio declarado.
- [ ] Existe una versión de la práctica **sin pistas** para poder certificar Nivel 3.
- [ ] Los errores esperados están enumerados y tienen explicación propia.
- [ ] Hay una actividad de recuperación posterior programable.
- [ ] Existe un ítem de transferencia ligado a una tarea real o a una entrevista.
- [ ] El material visual requerido por la familia de concepto está presente.
- [ ] La justificación del estudiante es obligatoria y evaluable.

---

## Documentos relacionados

- [`vision-y-filosofia.md`](vision-y-filosofia.md) — filosofía general
- [`../01-curriculo/rubricas-evaluacion.md`](../01-curriculo/rubricas-evaluacion.md) — pesos de evaluación
- [`../02-contenido/banco-ejercicios.md`](../02-contenido/banco-ejercicios.md) — taxonomía de ejercicios

