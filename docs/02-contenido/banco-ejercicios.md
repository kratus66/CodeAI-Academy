# Banco de ejercicios — taxonomía

> Catálogo de los **tipos de ejercicio** que soporta la plataforma. Todo contenido se clasifica con esta taxonomía, y el motor de la app se implementa contra ella.

---

## 1. Principio rector

> **Cada tipo de ejercicio debe producir una señal de aprendizaje utilizable por el motor de repaso.**

Un ejercicio que no genere datos (correcto/incorrecto, pistas usadas, tiempo, error cometido) no puede entrar al banco: no sirve ni para evaluar ni para programar repaso.

---

## 2. Los 8 tipos de ejercicio

| Código | Tipo | Propósito pedagógico | Datos que registra | Nivel de dominio típico |
|--------|------|----------------------|--------------------|--------------------------|
| `LAB` | Laboratorio de código | Aplicar y construir con retroalimentación automática | Tests pasados/fallidos, pistas usadas, tiempo, intentos | 2–3 |
| `QUIZ` | Cuestionario | Verificar comprensión conceptual | Aciertos, opción elegida, tiempo | 1 |
| `MEMORY` | Juego de memoria | Interiorizar asociaciones (comando↔efecto, concepto↔definición) | Pares, movimientos, tiempo, errores | 1–2 |
| `FLASHCARD` | Tarjeta de recuperación espaciada | Recuperación activa a intervalos | Calidad de respuesta (0–5), intervalo | 1–3 |
| `DEBUG` | Depuración | Encontrar y corregir defectos | Defecto localizado, causa raíz, corrección | 3 |
| `AUDIT` | Auditoría de código IA | Evaluar críticamente código generado | Defectos detectados, falsos positivos, decisión | 3–4 |
| `CHALLENGE` | Reto cronometrado | Resolver bajo presión (entrevista) | Tiempo, correctitud, estrategia | 3–4 |
| `SIM` | Simulación de entrevista | Practicar explicación y defensa | Rúbrica, seguimiento, autoevaluación | 4 |

Complementarios:
- `READING` — lectura de documentación oficial con preguntas de verificación.
- `REFLECT` — elaboración escrita obligatoria (justificación de decisiones).
- `PROJECT` — entregable integrador evaluado por rúbrica.

---

## 3. Especificación por tipo

### 3.1 `LAB` — Laboratorio de código

**Estructura:**

```yaml
type: LAB
slug: js-async-001
title: Consumir una API con manejo de errores
concept: [promises, async-await, error-handling]
difficulty: guided | semi | autonomous   # escalera de progreso
stack: [typescript, node]
statement: |
  Implementa fetchUser(id) que…
starter_code: |
  export async function fetchUser(id: number) { /* TODO */ }
tests:
  visible:
    - "devuelve el usuario cuando la API responde 200"
    - "lanza UserNotFoundError cuando la API responde 404"
  hidden:
    - "reintenta 2 veces en error de red"
    - "no hace llamadas duplicadas en paralelo"
hints:
  - level: 1
    text: "¿Qué devuelve fetch cuando el estado no es ok?"
  - level: 2
    text: "Revisa si estás lanzando un Error personalizado."
  - level: 3
    text: "Considera un bucle con contador de reintentos y backoff."
solution: ./solutions/js-async-001.ts
rubric: default
```

**Reglas:**
- Todo `LAB` tiene solución oficial almacenada y no accesible al estudiante.
- Las pistas son **progresivas** y su uso se registra (afecta al nivel máximo alcanzable).
- Los tests ocultos nunca se muestran, ni siquiera al fallar (solo el resultado agregado).
- Debe existir una versión `autonomous` (sin pistas) para certificar Nivel 3.

### 3.2 `QUIZ` — Cuestionario

**Estructura:**

```yaml
type: QUIZ
slug: http-status-001
concept: [http-status-codes]
questions:
  - prompt: "¿Qué código indica que el recurso se creó correctamente?"
    options: ["200", "201", "204", "301"]
    correct: "201"
    explanation: "201 Created indica creación exitosa y suele incluir cabecera Location."
    distractor_explanations:
      "200": "Es éxito genérico, pero no específico de creación."
      "204": "Indica éxito sin contenido."
```

**Reglas:**
- Cada distractor tiene explicación propia (el error también enseña).
- Los quizzes pueden ser: de opción única, de opción múltiple, de ordenar pasos, de emparejar, de predecir salida de código.
- Se prohíbe el "verdadero/falso" sin justificación.
- Cada pregunta declara el `concept` para el motor de repaso.

### 3.3 `MEMORY` — Juego de memoria

**Propósito:** interiorizar pares de asociación mediante repetición lúdica.

**Pares válidos por etapa:**

| Etapa | Ejemplo de pares |
|-------|------------------|
| E0 | herramienta ↔ función |
| E1 | operador ↔ precedencia |
| E2 | método de array ↔ comportamiento · `Promise.all` ↔ falla si una falla |
| E3 | comando Git ↔ efecto |
| E4 | elemento HTML ↔ propósito semántico |
| E5 | código HTTP ↔ significado |
| E6 | tipo de `JOIN` ↔ resultado |
| E7 | patrón de diseño ↔ problema |
| E8 | capacidad de modelo ↔ limitación |
| E9 | concepto RAG ↔ función en el pipeline |
| E10 | herramienta de agente ↔ riesgo |

**Mecánica:**
- Tablero de 12–20 cartas (6–10 pares).
- Modos: normal · contrarreloj · "sin errores" · "emparejar por categoría".
- Registra: movimientos, tiempo, pares fallados.
- **Los pares fallados se convierten automáticamente en flashcards** para repaso espaciado. ← Esta es la conexión clave entre juego y aprendizaje real.

### 3.4 `FLASHCARD` — Recuperación espaciada

**Estructura de la tarjeta:**

```yaml
type: FLASHCARD
slug: fc-sm2-001
concept: [spaced-repetition]
front: "¿Qué dos propiedades ajusta SM-2 por repetición?"
back: "El intervalo (días) y la facilidad del ítem."
source: "docs/01-curriculo/prerequisitos-y-progreso.md#5"
```

**Reglas:**
- El estudiante **califica su recuperación** (0–5) o el sistema la infiere de un micro-ejercicio.
- El sistema es quien programa la fecha; el estudiante nunca elige "cuándo repasar".
- Toda tarjeta tiene fuente citable para evitar contenido inventado.

### 3.5 `DEBUG` — Depuración

**Estructura:**

```yaml
type: DEBUG
slug: dbg-async-001
concept: [async-await, error-handling]
language: typescript
buggy_code: |
  try {
    const res = await fetch(url);   // el rechazo no se captura
    handle(res);
  } catch (e) { console.log(e); }
bug_category: swallowed-rejection
expected_student_output:
  - "identificar la línea problemática"
  - "explicar la causa raíz"
  - "proponer corrección con prueba"
grading:
  location: 0.35
  root_cause: 0.30
  fix: 0.25
  regression_test: 0.10
```

**Reglas:**
- Cada ejercicio tiene **un defecto principal** y ningún defecto secundario accidental.
- El defecto debe corresponder a un error real y frecuente.
- Se registra `bug_category` para la analítica de errores frecuentes del estudiante.

### 3.6 `AUDIT` — Auditoría de código generado por IA

**Estructura:**

```yaml
type: AUDIT
slug: audit-auth-001
concept: [auth, jwt, security]
ai_code: ./fixtures/audit-auth-001.ts
known_defects:
  - id: D1
    severity: critical
    description: "El JWT no valida expiración"
  - id: D2
    severity: medium
    description: "El error revela si el email existe (enumeración de usuarios)"
plausible_but_fine:
  - "Usa bcrypt con coste 10 (aceptable)"
student_task: |
  Revisa el código. Enumera los defectos reales con gravedad y justifica.
  Indica si aceptarías, corregirías o descartarías el código.
```

**Reglas:**
- Debe contener **defectos reales** y al menos un aspecto **correcto que parezca sospechoso** (para castigar el exceso de desconfianza).
- Se penalizan los falsos positivos.

### 3.7 `CHALLENGE` — Reto cronometrado

**Estructura:**

```yaml
type: CHALLENGE
slug: ch-two-sum-001
mode: interview | speedrun | refactor-rush
duration_min: 20
statement: "Dado un arreglo de enteros y un objetivo, encuentra los índices de dos números que sumen el objetivo."
acceptance:
  - "O(n) con hash map"
  - "maneja duplicados y arreglos vacíos"
  - "explica la complejidad"
evaluation: manual | auto | hybrid
```

**Reglas:**
- El tiempo **no penaliza por sí mismo**: se evalúa el razonamiento registrado.
- Siempre incluye "explica tu estrategia antes de codificar".

### 3.8 `SIM` — Simulación de entrevista

**Estructura:**

```yaml
type: SIM
slug: sim-be-001
role: backend-junior
language: es | en
phases:
  - warmup
  - conceptual-questions
  - live-coding
  - code-review
  - follow-ups
  - candidate-questions
rubric: interview
```

**Reglas:**
- Las preguntas de seguimiento dependen de las respuestas previas.
- Se graba (o transcribe) para autoevaluación.
- Incluye una fase obligatoria: *"explica qué generaste con IA y cómo lo verificaste"*.

---

## 4. Escalera de dificultad (obligatoria por concepto)

Todo concepto debe ofrecer ejercicios en estos tres escalones:

| Escalón | Nombre | Característica | Nivel certificable |
|---------|--------|----------------|--------------------|
| 1 | **Guiado** | Código parcial, pistas disponibles, tests visibles | 2 |
| 2 | **Semi-autónomo** | Enunciado completo, pistas limitadas, tests ocultos | 2–3 |
| 3 | **Autónomo** | Solo criterios de aceptación, sin pistas, tests ocultos | 3 |

**Regla de oro:** no se puede certificar Nivel 3 con ejercicios del escalón 1.

---

## 5. Distribución mínima de ejercicios por unidad

Para que una unidad se considere publicable:

| Tipo | Mínimo por unidad |
|------|-------------------|
| `QUIZ` | 8 preguntas |
| `LAB` guiado | 1 |
| `LAB` autónomo | 1 |
| `FLASHCARD` | 6 |
| `MEMORY` | 1 set (cada 3 unidades) |
| `DEBUG` | 1 |
| `AUDIT` | 1 (desde Etapa 8) |
| `CHALLENGE` | 1 (desde Etapa 3) |
| `REFLECT` | 1 |

### Estado real del banco (2026-10-28)

La tabla anterior es el **criterio de publicación**, no la foto actual. Hoy:

| Medición | Valor | Consecuencia |
|----------|-------|--------------|
| Etapas / módulos / unidades sembradas | 12 / 48 / 207 | El catálogo y el lector tienen datos reales desde S2–S3 |
| Lecciones publicadas | 207 (una por unidad) | Cada unidad enseña; la práctica queda declarada, no fingida |
| Ejercicios en la semilla | **3.189 publicados (E0–E11, sin revisión humana; ver `plan-poblado-banco-e0-e2.md` §4.1)**; E3–E11 solo con `QUIZ`/`FLASHCARD`/`REFLECT` (sin laboratorios). Antes: 3 (piloto, sin publicar) | `seed.mts` ya carga ejercicios con pistas y pruebas (`js-async-001`…`003`, unidades U2.3.2 y U2.3.3). Siguen sin publicarse: el sandbox `mock` no ejecuta código y publicarlos certificaría competencias sin comprobar. No hay `QUIZ` ni `FLASHCARD` sembrados |
| Unidades que cumplen la distribución mínima | **0 de 207** | Ninguna unidad es publicable según esta tabla hasta que exista su banco |

Esto es **deuda pedagógica declarada**, no un descuido silencioso: la regla permanente 1 del proyecto («ningún concepto sin ejercicios prácticos asociados») está hoy incumplida en los datos, aunque el modelo, la API y las pantallas de ejercicios existen y están probados (S5–S7). El soporte técnico de la semilla ya existe (esquema, reglas de la plantilla y carga idempotente); lo que falta es autoría de contenido por etapa y un sandbox que ejecute código antes de publicar. La autoría requiere revisión pedagógica humana: un ejercicio generado sin revisión no cuenta como evidencia de competencia.

---

## 6. Metadatos obligatorios de todo ejercicio

```yaml
id: string              # único y estable
slug: string            # legible, usado en URLs
type: LAB|QUIZ|MEMORY|FLASHCARD|DEBUG|AUDIT|CHALLENGE|SIM|READING|REFLECT|PROJECT
stage: 0-11
module: "M2.3"
unit: "U2.3.3"
concepts: [string]      # para el motor de repaso y analítica
competencies: [C1..C14]
difficulty: 1-4
ladder: guided|semi|autonomous
estimated_minutes: number
prerequisites: [exercise_id]
sources: [url]          # documentación oficial obligatoria
license: string
language: es|en|both
```

Sin estos metadatos el ejercicio **no entra al banco**.

---

## 7. Conexión con la analítica

Cada intento registra:

```
exercise_id, user_id, started_at, duration, attempts,
hints_used[], tests_passed, tests_failed[], error_category,
self_explanation, ai_assistance_used, outcome
```

Estos datos alimentan:
- el motor SM-2 (fecha de repaso),
- el mapa de competencias (nivel),
- el panel de analítica (errores frecuentes, conceptos olvidados),
- la recomendación de refuerzo.

---

## Documentos relacionados

- [`../01-curriculo/rubricas-evaluacion.md`](../01-curriculo/rubricas-evaluacion.md)
- [`../01-curriculo/prerequisitos-y-progreso.md`](../01-curriculo/prerequisitos-y-progreso.md)
- [`catalogo-recursos.md`](catalogo-recursos.md)
- [`../06-plantillas/plantilla-ejercicio.md`](../06-plantillas/plantilla-ejercicio.md)

