# Rúbricas de evaluación

> El curso no acredita dominio por completar videos ni por responder cuestionarios. Cada competencia exige evidencias concretas evaluadas con pesos explícitos.

---

## 1. Rúbrica base para evaluaciones prácticas

Aplicable a laboratorios, proyectos y entregables por defecto.

| Criterio | Peso | Qué se observa | Nivel 1 | Nivel 3 | Nivel 4 |
|----------|------|----------------|---------|---------|---------|
| **Correctitud funcional y cumplimiento de requisitos** | **30 %** | ¿Hace lo que se pidió, incluidos casos límite? | Falla en casos básicos | Cumple todos los criterios | Cumple y anticipa requisitos conflictivos |
| **Calidad, legibilidad y mantenibilidad del código** | **20 %** | Nombres, estructura, duplicación, complejidad | Código funcional pero opaco | Claro, modular, sin duplicación evidente | Refleja el dominio del problema; fácil de extender |
| **Pruebas y manejo de casos límite** | **20 %** | Cobertura de éxito, error y borde | Sin pruebas o triviales | Pruebas significativas de éxito y fallo | Pruebas que documentan decisiones y previenen regresiones |
| **Seguridad y buenas prácticas** | **15 %** | Validación, secretos, dependencias, permisos | Riesgos evidentes | Sin vulnerabilidades conocidas | Endurecido y justificado |
| **Explicación y justificación de decisiones** | **15 %** | Trade-offs, alternativas, consecuencias | No justifica | Justifica con fundamentos | Defiende bajo cuestionamiento y reconoce límites |

### Reglas de aplicación
- Un criterio con puntuación 0 en **Correctitud** invalida el entregable (no se compensa con los demás).
- La **justificación vacía** resta el 15 % completo, no una fracción.
- El uso de IA **no penaliza por sí mismo**; penaliza la falta de verificación.

---

## 2. Rúbricas específicas por tipo de actividad

### 2.1 Laboratorio de código

| Criterio | Peso |
|----------|------|
| Casos de prueba superados (incluye ocultos) | 40 % |
| Calidad del código | 20 % |
| Pruebas propias aportadas | 20 % |
| Explicación del enfoque | 20 % |

**Nota:** si se usaron pistas de nivel 3+, el máximo alcanzable es Nivel 2.

### 2.2 Ejercicio de depuración

| Criterio | Peso |
|----------|------|
| Localización correcta del defecto | 35 % |
| Explicación de la causa raíz | 30 % |
| Corrección que no introduce regresiones | 25 % |
| Prueba que previene la reaparición | 10 % |

### 2.3 Auditoría de código generado por IA

| Criterio | Peso |
|----------|------|
| Detección de defectos reales (sin falsos positivos) | 35 % |
| Clasificación por gravedad | 20 % |
| Verificación con fuentes o pruebas | 25 % |
| Decisión fundamentada: aceptar, corregir o descartar | 20 % |

### 2.4 Diseño de base de datos

| Criterio | Peso |
|----------|------|
| Modelo cumple los requisitos | 30 % |
| Integridad y restricciones | 25 % |
| Eficiencia de consultas | 20 % |
| Justificación de normalización/desnormalización | 15 % |
| Documentación del modelo | 10 % |

### 2.5 Proyecto integrador

| Criterio | Peso |
|----------|------|
| Funcionalidad completa según especificación | 25 % |
| Arquitectura y separación de responsabilidades | 20 % |
| Pruebas automatizadas en pipeline | 20 % |
| Seguridad y manejo de errores | 15 % |
| Documentación (README + ADRs) | 10 % |
| Defensa técnica oral | 10 % |

### 2.6 Simulación de entrevista

| Criterio | Peso |
|----------|------|
| Razonamiento en voz alta | 30 % |
| Correctitud de la solución | 25 % |
| Comunicación y claridad | 20 % |
| Manejo de preguntas de seguimiento | 15 % |
| Reconocimiento de límites propios | 10 % |

### 2.7 Entrevista de algoritmos (cronometrada)

| Criterio | Peso |
|----------|------|
| Comprensión del problema y preguntas aclaratorias | 25 % |
| Estrategia antes de codificar | 25 % |
| Correctitud y casos límite | 30 % |
| Complejidad y optimización | 20 % |

---

## 3. Escala de conversión

| Puntuación | Resultado | Consecuencia |
|------------|-----------|--------------|
| 90–100 % | Excelente | Nivel 4 potencial; apto para convalidar |
| 80–89 % | Aprobado con dominio | Desbloquea siguiente etapa |
| 70–79 % | Aprobado débil | Requiere refuerzo obligatorio antes de avanzar |
| 50–69 % | Insuficiente | Repetir con ejercicios nuevos (no los mismos) |
| < 50 % | No acreditado | Revisar prerequisitos; posible retroceso de unidad |

---

## 4. Reglas anti-fraude y anti-sesgo

1. **Verificación de autoría conceptual:** toda entrega incluye una explicación en texto propio; si no coincide con el código, se activa revisión oral.
2. **Ejercicios con casos ocultos:** los laboratorios incluyen pruebas no visibles para evitar sobreajuste.
3. **Variantes por estudiante:** los enunciados tienen variantes paramétricas (datos y restricciones distintas).
4. **Detección de copia de solución:** si el código coincide estructuralmente con la solución oficial, se invalida el intento.
5. **Prohibición de "solución por IA pegada":** si el estudiante no puede explicar una línea, no cuenta como evidencia de competencia.
6. **Revisión por pares ciega:** en proyectos colaborativos la revisión es obligatoria y evaluada.

---

## 5. Rúbrica de calidad del contenido (para autores)

Antes de publicar una lección o ejercicio:

| Criterio | Obligatorio |
|----------|-------------|
| Objetivo medible y observable | ✅ |
| Al menos un ejercicio por nivel de dominio | ✅ |
| Errores esperados documentados con explicación | ✅ |
| Existe versión sin pistas (para Nivel 3) | ✅ |
| Actividad de recuperación programable | ✅ |
| Ítem de transferencia real o de entrevista | ✅ |
| Material visual requerido por la familia de concepto | ✅ |
| Justificación del estudiante obligatoria | ✅ |
| Fuentes oficiales citadas y verificadas | ✅ |
| Licencia compatible si hay recurso externo | ✅ |

---

## Documentos relacionados

- [`../00-vision/fundamentos-pedagogicos.md`](../00-vision/fundamentos-pedagogicos.md)
- [`mapa-competencias.md`](mapa-competencias.md)
- [`../02-contenido/banco-ejercicios.md`](../02-contenido/banco-ejercicios.md)

