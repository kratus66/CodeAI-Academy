# Plantilla de lección

> Toda lección sigue los **7 pasos** de [`fundamentos-pedagogicos.md`](../00-vision/fundamentos-pedagogicos.md) §5. Sin los siete, no se publica.

---

## Metadatos

| Campo | Valor |
|-------|-------|
| **Etapa** | E0–E11 |
| **Módulo / unidad** | `E5-M2 / U3` |
| **Competencias** | C1–C14 (ver [`mapa-competencias.md`](../01-curriculo/mapa-competencias.md)) |
| **Prerrequisitos** | unidades o competencias certificadas |
| **Duración estimada** | 45–90 min |
| **Nivel de dominio objetivo** | 1–4 |

---

## 1. Objetivo medible

> Al terminar, el estudiante podrá **\<verbo observable\>** … **sin** \<condición que se retira\>.

- ✅ "Implementa un `fetch` con reintentos y explica por qué el backoff evita saturar el servidor."
- ❌ "Entender promesas."

---

## 2. Explicación y ejemplo resuelto

- **Idea central** (2–3 párrafos, sin jerga innecesaria).
- **Ejemplo resuelto paso a paso** con el razonamiento visible, no solo el código final.
- **Errores comunes** (mínimo 2), cada uno con la causa y cómo detectarlo.

```ts
// Ejemplo mínimo ejecutable
```

---

## 3. Práctica guiada (Nivel 2)

- Ejercicio `LAB` con `difficulty: guided`.
- Pistas progresivas (nivel 1 concepto, nivel 2 dirección, nivel 3 fragmento).
- El estudiante **completa** código existente; no parte de cero.

**Criterio de paso:** resuelve con hasta 2 pistas.

---

## 4. Práctica independiente (Nivel 3)

- Ejercicio `LAB` con `difficulty: autonomous`, sin pistas disponibles.
- Problema **nuevo**, no una variación superficial del ejemplo.
- El estudiante escribe sus propias pruebas además de pasar las ocultas.

**Criterio de paso:** pasa los tests visibles y ocultos sin pistas usadas.

---

## 5. Depuración y revisión con IA (Nivel B del curso)

- Se entrega código (propio o generado) **con un defecto** y se pide localizarlo.
- El estudiante debe indicar: qué falla, por qué, cómo lo comprobó y qué cambió.
- Prohibido aceptar la respuesta de la IA sin verificación ejecutada.

**Evidencia:** justificación escrita + prueba que demuestra la corrección.

---

## 6. Recuperación y evaluación

- 3–5 preguntas `QUIZ` o `FLASHCARD` **sin apuntes**.
- Cada pregunta declara su `concept` para el motor de repaso.
- Los errores se programan en la cola SM-2 con prioridad alta.

**Criterio de paso:** ≥ 80 % de aciertos y Nivel 3 en competencias críticas.

---

## 7. Transferencia al mundo real

- Conexión explícita con una tarea profesional o una pregunta de entrevista.
- Variante del problema con una restricción nueva (tiempo, memoria, API caída).
- Pregunta de cierre: *"¿Cuándo **no** usarías este enfoque?"*

---

## Registro de calidad

- [ ] Los 7 pasos están presentes.
- [ ] Cada concepto tiene al menos un ejercicio asociado.
- [ ] Hay solución oficial almacenada y no visible.
- [ ] Los textos están en español y el código en inglés.
- [ ] La lección se rastrea a una entrada de [`curriculo-maestro.md`](../01-curriculo/curriculo-maestro.md).

---

## Documentos relacionados

- [`fundamentos-pedagogicos.md`](../00-vision/fundamentos-pedagogicos.md)
- [`plantilla-ejercicio.md`](plantilla-ejercicio.md)
- [`../01-curriculo/rubricas-evaluacion.md`](../01-curriculo/rubricas-evaluacion.md)
- [`../02-contenido/banco-ejercicios.md`](../02-contenido/banco-ejercicios.md)
