# Plantilla de ejercicio

> Todo ejercicio se clasifica con la taxonomía de [`banco-ejercicios.md`](../02-contenido/banco-ejercicios.md) y **produce señal de aprendizaje** (resultado, pistas usadas, tiempo, error).

---

## Metadatos obligatorios

| Campo | Regla |
|-------|-------|
| `type` | `LAB`, `QUIZ`, `MEMORY`, `FLASHCARD`, `DEBUG`, `AUDIT`, `CHALLENGE`, `SIM`, `READING`, `REFLECT` o `PROJECT` |
| `slug` | único, `kebab-case`, con etapa (`js-async-001`) |
| `concept` | conceptos que activa (alimentan SM-2 y mapa de competencias) |
| `difficulty` | `guided` · `semi` · `autonomous` |
| `stage` | E0–E11 |
| `competencies` | C1–C14 |
| `outcome` | qué debe poder hacer el estudiante al resolverlo |

Sin estos metadatos el ejercicio **no entra al banco**.

---

## Estructura (ejemplo `LAB`)

```yaml
type: LAB
slug: js-async-001
title: Consumir una API con manejo de errores
concept: [promises, async-await, error-handling]
difficulty: guided
stack: [typescript, node]
stage: E2
competencies: [C1, C2, C6]
statement: |
  Implementa fetchUser(id) que…
starter_code: |
  export async function fetchUser(id: number) { /* ... */ }
tests:
  visible:
    - "devuelve el usuario cuando la API responde 200"
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

---

## Reglas por tipo

| Tipo | Regla dura |
|------|-----------|
| `LAB` | Solución oficial almacenada y no accesible; tests ocultos nunca visibles; versión `autonomous` para certificar Nivel 3 |
| `QUIZ` | Cada distractor tiene explicación propia; prohibido verdadero/falso sin justificación |
| `FLASHCARD` | Calidad de respuesta 0–5; el intervalo lo calcula SM-2 |
| `DEBUG` | El defecto debe ser reproducible con una prueba |
| `AUDIT` | El código auditado incluye defectos reales y al menos un falso positivo |
| `CHALLENGE` | Tiempo límite declarado y criterio de correctitud explícito |
| `SIM` | Rúbrica de entrevista + autoevaluación del estudiante |
| `PROJECT` | Rúbrica por competencia y defensa oral |

---

## Pistas progresivas

1. **Concepto:** pregunta que orienta sin revelar la técnica.
2. **Dirección:** señala el área del problema (sin código).
3. **Fragmento:** estructura mínima; nunca la solución completa.

El uso de pistas se registra y limita el nivel máximo alcanzable.

---

## Registro de intento

```
exercise_id, user_id, started_at, duration, attempts,
hints_used[], tests_passed, tests_failed[], error_category,
self_explanation, ai_assistance_used, outcome
```

Este registro es obligatorio: sin él no hay repaso, ni mapa de competencias, ni analítica.

---

## Checklist de calidad

- [ ] Metadatos completos y `slug` único.
- [ ] Enunciado en español, sin ambigüedad, con un ejemplo de entrada/salida.
- [ ] Tests visibles que verifican el contrato; ocultos que verifican casos límite.
- [ ] Solución oficial probada.
- [ ] Al menos un error común documentado.
- [ ] Asociado a una lección y a una competencia.

---

## Documentos relacionados

- [`plantilla-leccion.md`](plantilla-leccion.md)
- [`../02-contenido/banco-ejercicios.md`](../02-contenido/banco-ejercicios.md)
- [`../01-curriculo/rubricas-evaluacion.md`](../01-curriculo/rubricas-evaluacion.md)
- [`../01-curriculo/mapa-competencias.md`](../01-curriculo/mapa-competencias.md)
