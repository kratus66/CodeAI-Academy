# Perfil profesional de egreso

> Define qué debe poder **hacer** una persona que completa CodeAI Academy. Es la referencia contra la que se diseñan competencias, ejercicios y evaluaciones.

---

## 1. Objetivo principal

Formar un **desarrollador de software con IA**, con una ruta adicional hacia la **ingeniería de aplicaciones basadas en modelos de lenguaje**.

La ruta principal (Niveles 1 y 2 del currículo) forma full-stack con dominio de asistentes. La ruta avanzada (Nivel 3) especializa en ingeniería de IA aplicada.

---

## 2. Competencias de egreso (10 obligatorias)

Estas diez competencias son el contrato de salida del programa. Cada una tiene etapas responsables y evidencia asociada.

| # | Competencia | Qué significa en la práctica | Etapas | Evidencia de egreso |
|---|-------------|------------------------------|--------|---------------------|
| **C1** | Programar y comprender código, no solo generarlo | Escribir lógica propia y leer código ajeno sin ejecutarlo | 1, 2 | Sprint de algoritmos + lectura de código |
| **C2** | Usar asistentes y modelos de lenguaje eficazmente | Elegir herramienta según tarea, aportar contexto útil | 8 | Proyecto auditable con IA |
| **C3** | Diseñar instrucciones, aportar contexto y evaluar resultados | Redactar especificaciones, validar salidas, detectar respuestas erróneas | 8, 9 | Comparativa de prompts + detección de fallos |
| **C4** | Construir frontend, backend, APIs y bases de datos | Full-stack funcional, no prototipos | 4, 5, 6 | Aplicación administrativa completa |
| **C5** | Aplicar Git, pruebas automatizadas, seguridad y buenas prácticas | Historial limpio, tests reales, sin vulnerabilidades evidentes | 3, 7 | Repo + pipeline + informe de seguridad |
| **C6** | Integrar modelos, herramientas y salidas estructuradas | Flujos con validación de esquema y manejo de fallos | 9 | Asistente con referencias verificables |
| **C7** | Depurar código generado por IA y detectar errores sutiles | Encontrar el bug que "funciona" pero viola requisitos | 8, 10 | Sesión de depuración en vivo |
| **C8** | Desplegar aplicaciones y supervisar su funcionamiento | Docker, CI/CD, logs, métricas, alertas | 7 | Despliegue documentado y observable |
| **C9** | Documentar decisiones técnicas y colaborar | ADRs, READMEs, revisión de código, pull requests | 3, 7, 11 | Portafolio documentado |
| **C10** | Resolver pruebas técnicas y defender proyectos | Explicar trade-offs bajo presión | 11 | Simulación de entrevista aprobada |

---

## 3. Competencias de la ruta avanzada (ingeniería de IA)

Adicionales para quien complete las etapas 9–10:

| # | Competencia | Evidencia |
|---|-------------|-----------|
| **C11** | Evaluación de modelos y sistemas RAG | Conjunto de preguntas de referencia + métricas antes/después |
| **C12** | Diseño de agentes con herramientas limitadas | Agente con permisos, trazabilidad y aprobación humana |
| **C13** | Observabilidad y optimización de costos de IA | Panel de latencia, costo por consulta y tasa de fallo |
| **C14** | Seguridad en sistemas con LLM (inyección de prompts, fuga de datos) | Informe de amenazas y mitigaciones implementadas |

---

## 4. Mapa de competencias por etapa

```
Etapa 0  → (diagnóstico) base de C1
Etapa 1  → C1  ████████
Etapa 2  → C1  ████████████
Etapa 3  → C5, C9 ████
Etapa 4  → C4  ██████
Etapa 5  → C4  ██████
Etapa 6  → C4  █████
Etapa 7  → C5, C8, C9 ██████
Etapa 8  → C2, C3, C7 ██████
Etapa 9  → C3, C6, C11, C14 ██████
Etapa 10 → C12, C13, C14 █████
Etapa 11 → C10 ██████
```

Cada competencia se certifica en Nivel 1–4 según [`fundamentos-pedagogicos.md`](fundamentos-pedagogicos.md#4-niveles-de-dominio-escala-de-certificación). **El egreso exige Nivel 3 en C1–C9 y Nivel 4 en C10.**

---

## 5. Perfiles objetivo del mercado

El currículo se contrasta contra vacantes reales de tres perfiles:

| Perfil | Énfasis | Competencias dominantes |
|--------|---------|-------------------------|
| **Desarrollador Full-Stack Junior** | Construir features end-to-end | C1, C4, C5, C9 |
| **Desarrollador con foco en IA** | Integrar LLMs en producto | C2, C3, C6, C7 |
| **Ingeniero de Aplicaciones LLM** | Sistemas RAG y agentes | C11, C12, C13, C14 |

Análisis de vacantes y brechas: ver Etapa 11 en [`../01-curriculo/curriculo-maestro.md`](../01-curriculo/curriculo-maestro.md).

---

## 6. Lo que el programa NO promete

Declararlo protege la honestidad del producto:

- **No garantiza superar cualquier entrevista.** Ningún curso puede hacerlo.
- **No sustituye experiencia profesional.** Un portafolio demuestra capacidad, no trayectoria.
- **No certifica seniority.** El egreso corresponde a un perfil junior sólido con especialización.
- **No cubre todas las tecnologías.** Cubre un stack moderno y transferible; la capacidad de aprender lo demás es parte de la competencia.

---

## 7. Evidencias mínimas del portafolio de egreso

Al terminar, el estudiante debe poder mostrar:

1. **Un proyecto full-stack con funcionalidad de IA**: autenticación, base de datos, pruebas, documentación y despliegue.
2. **Un repositorio colaborativo** con historial claro, pull requests y revisión de código.
3. **Un asistente con RAG** con referencias verificables y evaluación documentada.
4. **Un agente operativo** con permisos limitados y trazabilidad.
5. **Un informe de decisiones técnicas** (ADRs) explicando trade-offs.
6. **Una grabación de simulación de entrevista** con autoevaluación contra rúbrica.
7. **Un CV técnico** y perfil profesional alineados a las competencias C1–C10.

---

## Documentos relacionados

- [`vision-y-filosofia.md`](vision-y-filosofia.md)
- [`fundamentos-pedagogicos.md`](fundamentos-pedagogicos.md)
- [`../01-curriculo/mapa-competencias.md`](../01-curriculo/mapa-competencias.md)
