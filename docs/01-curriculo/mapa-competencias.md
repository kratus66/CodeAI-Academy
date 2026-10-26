# Mapa de competencias

> Trazabilidad entre competencias, etapas, ejercicios y evidencias. Permite responder: *"¿dónde se enseña esto y cómo se certifica?"*

---

## 1. Catálogo de competencias

### Competencias núcleo (obligatorias)

| Código | Competencia | Etapas | Nivel exigido al egreso |
|--------|-------------|--------|-------------------------|
| **C1** | Programar y comprender código, no solo generarlo | 1, 2 | 3 |
| **C2** | Usar asistentes y modelos de lenguaje eficazmente | 8 | 3 |
| **C3** | Diseñar instrucciones, aportar contexto y evaluar resultados | 8, 9 | 3 |
| **C4** | Construir frontend, backend, APIs y bases de datos | 4, 5, 6 | 3 |
| **C5** | Aplicar Git, pruebas automatizadas, seguridad y buenas prácticas | 3, 7 | 3 |
| **C6** | Integrar modelos, herramientas y salidas estructuradas | 9 | 3 |
| **C7** | Depurar código generado por IA y detectar errores sutiles | 8, 10 | 3 |
| **C8** | Desplegar aplicaciones y supervisar su funcionamiento | 7 | 3 |
| **C9** | Documentar decisiones técnicas y colaborar | 3, 7, 11 | 3 |
| **C10** | Resolver pruebas técnicas y defender proyectos | 11 | 4 |

### Competencias de especialización (ruta avanzada)

| Código | Competencia | Etapas | Nivel exigido |
|--------|-------------|--------|---------------|
| **C11** | Evaluación de modelos y sistemas RAG | 9 | 3 |
| **C12** | Diseño de agentes con herramientas limitadas | 10 | 3 |
| **C13** | Observabilidad y optimización de costos de IA | 10 | 3 |
| **C14** | Seguridad en sistemas con LLM | 9, 10 | 3 |

---

## 2. Matriz de cobertura etapa × competencia

Símbolos: `●` competencia principal · `○` competencia trabajada · `·` no trabajada

| Etapa | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | C13 | C14 |
|-------|----|----|----|----|----|----|----|----|----|-----|-----|-----|-----|-----|
| 0 | ○ | · | · | · | · | · | · | · | · | · | · | · | · | · |
| 1 | ● | · | · | · | · | · | · | · | · | · | · | · | · | · |
| 2 | ● | · | · | · | ○ | · | · | · | · | · | · | · | · | · |
| 3 | · | · | · | · | ● | · | · | · | ○ | · | · | · | · | · |
| 4 | ○ | · | · | ● | ○ | · | · | · | · | · | · | · | · | · |
| 5 | ○ | · | · | ● | ○ | · | · | ○ | · | · | · | · | · | · |
| 6 | ○ | · | · | ● | ○ | · | · | · | · | · | · | · | · | · |
| 7 | · | · | · | ○ | ● | · | · | ● | ● | · | · | · | · | · |
| 8 | · | ● | ● | · | · | ○ | ● | · | · | · | · | · | · | ○ |
| 9 | · | ○ | ● | ○ | · | ● | ○ | · | · | · | ● | ○ | ○ | ● |
| 10 | · | ○ | ○ | ○ | ○ | ● | ● | ○ | · | · | ○ | ● | ● | ● |
| 11 | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● | ● | ○ | ○ | ○ | ○ |

---

## 3. Tipos de evidencia por competencia

Cada competencia se certifica con evidencia **verificable**, no con asistencia.

| Competencia | Evidencia principal | Instrumento |
|-------------|--------------------|-------------|
| C1 | Resolver problema nuevo sin pistas | Laboratorio sin pistas + tests propios |
| C2 | Elegir herramienta y contexto adecuados | Auditoría comparada de prompts |
| C3 | Detectar respuesta incorrecta del modelo | Ejercicio de detección de alucinación |
| C4 | Aplicación full-stack funcionando | Proyecto integrador |
| C5 | Repo limpio + pipeline + informe de seguridad | Revisión de repositorio |
| C6 | Flujo con salida estructurada validada | Asistente con esquema y validación |
| C7 | Encontrar bug sutil introducido por IA | Sesión de depuración en vivo |
| C8 | Despliegue observable | Demo de despliegue + panel |
| C9 | ADRs y revisión de código | Portafolio documentado |
| C10 | Simulación de entrevista aprobada | Rúbrica de entrevista |
| C11 | Métricas antes/después de cambiar recuperación | Informe de evaluación RAG |
| C12 | Agente con permisos y trazabilidad | Proyecto de agente |
| C13 | Panel de costo/latencia/errores | Observabilidad implementada |
| C14 | Amenazas identificadas y mitigadas | Informe de seguridad LLM |

---

## 4. Cálculo del nivel de dominio

El nivel de una competencia se calcula a partir de los intentos registrados:

```
Nivel 1 → acierta ≥ 70 % en quizzes de la competencia
Nivel 2 → resuelve ≥ 80 % de laboratorios guiados
Nivel 3 → resuelve ≥ 1 laboratorio sin pistas + escribe pruebas + justifica
Nivel 4 → resuelve proyecto con restricciones + defensa técnica aprobada
```

**Reglas:**
- Un nivel no se pierde por olvido: se marca como **"requiere repaso"** si pasa tiempo sin práctica y falla recuperaciones.
- Un nivel 3 obtenido con pistas "filtradas" no cuenta: el sistema registra si se solicitaron pistas y en qué nivel.
- El nivel **nunca** se calcula por tiempo de conexión ni por lecciones leídas.

---

## 5. Competencias críticas por etapa (bloqueo)

| Etapa | Competencias críticas (exigen Nivel 3 para avanzar) |
|-------|----------------------------------------------------|
| 1 | C1 |
| 2 | C1 |
| 3 | C5 |
| 4 | C4 |
| 5 | C4 |
| 6 | C4 |
| 7 | C5, C8 |
| 8 | C2, C3 |
| 9 | C3, C6 |
| 10 | C7, C12 |
| 11 | C10 |

---

## Documentos relacionados

- [`../00-vision/perfil-profesional.md`](../00-vision/perfil-profesional.md)
- [`curriculo-maestro.md`](curriculo-maestro.md)
- [`rubricas-evaluacion.md`](rubricas-evaluacion.md)
- [`prerequisitos-y-progreso.md`](prerequisitos-y-progreso.md)
