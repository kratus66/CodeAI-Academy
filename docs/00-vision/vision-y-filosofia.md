# Visión y filosofía de CodeAI Academy

> Documento raíz de la visión. Cualquier decisión de producto, currículo o arquitectura debe poder justificarse contra este texto.

---

## 1. El problema que resolvemos

La aparición de los asistentes de programación creó una contradicción:

- Es más fácil que nunca **producir** código.
- Es tan fácil producir código incorrecto que **la capacidad de evaluarlo vale más que la de escribirlo**.

Un recién llegado que aprende "pidiendo código a la IA" puede construir un prototipo en una tarde y ser incapaz de explicar por qué funciona, detectar una vulnerabilidad, escribir una prueba o mantenerlo seis meses después. Esa persona no es empleable como desarrolladora; es empleable como operadora de un generador de texto.

**CodeAI Academy existe para formar profesionales, no operadores.** Profesionales que puedan decir con orgullo: *"esta aplicación la entiendo, la puedo defender, la puedo romper a propósito y la puedo arreglar"*.

---

## 2. La distinción fundamental: tres niveles

El programa se estructura sobre tres niveles que **no son equivalentes** y que un profesional debe dominar todos:

### Nivel A — Usar IA para programar *(el más bajo)*

Pedirle a un modelo que genere código y aceptar lo que devuelva.

- Requiere: saber formular una petición.
- Riesgo: no saber si lo que devolvió es correcto.
- **No es el objetivo del curso, es el punto de partida que hay que superar.**

### Nivel B — Desarrollar software con IA *(el objetivo principal)*

Saber qué pedir, proporcionar contexto, evaluar respuestas, detectar errores, probar soluciones y tomar decisiones técnicas.

- Requiere: fundamentos sólidos, criterio de ingeniería, capacidad de verificación.
- **Es el centro de gravedad de CodeAI Academy.**

### Nivel C — Desarrollar sistemas que incorporan IA *(la especialización avanzada)*

Integrar modelos, diseñar flujos con herramientas, gestionar datos, evaluar resultados y controlar costos, seguridad y fiabilidad.

- Requiere: Nivel B consolidado + arquitectura + evaluación + observabilidad.
- Corresponde a las etapas 8–10 del currículo.

> **Regla editorial:** ninguna lección puede enseñar Nivel B o C mientras el estudiante no demuestre dominio verificable del Nivel A y de los fundamentos correspondientes. No se puede auditar código generado sin saber programar.

---

## 3. Las seis características esenciales del método

Estas seis características son **obligatorias** en el diseño de cualquier módulo. Una lección que no cumpla al menos cuatro debe rediseñarse.

| # | Característica | Qué significa operativamente | Cómo se verifica en la plataforma |
|---|----------------|------------------------------|-----------------------------------|
| 1 | **Aprendizaje basado en proyectos** | Cada concepto se usa para construir algo funcional | Todo módulo tiene un entregable registrado en la app |
| 2 | **Práctica deliberada** | Ejercicios específicos que atacan un error concreto | Cada competencia tiene ejercicios de refuerzo etiquetados por error objetivo |
| 3 | **Recuperación activa** | Recordar y aplicar sin consultar apuntes | Evaluaciones que no permiten abrir la teoría hasta responder |
| 4 | **Repetición espaciada** | Volver al concepto tras intervalos planificados | Motor SM-2 que reprograma ejercicios según desempeño |
| 5 | **Aprendizaje progresivo** | De ejercicios guiados a problemas autónomos | Escalera de dificultad declarada por lección (guiado → semi → autónomo) |
| 6 | **Evaluación profesional** | Explicar decisiones, defender código, resolver problemas nuevos | Rúbrica con peso explícito en justificación y transferencia |

Detalle pedagógico y respaldo en [`fundamentos-pedagogicos.md`](fundamentos-pedagogicos.md).

---

## 4. Lo que CodeAI Academy NO es

Definir el "no" protege el producto de la deriva:

- **No es una biblioteca de videos.** El video es un insumo, no la unidad pedagógica.
- **No es un generador de soluciones.** El tutor de IA entrega pistas graduales, nunca la solución completa por defecto.
- **No es un curso de "prompting".** La ingeniería de prompts es una etapa, no el producto.
- **No es una plataforma que mide tiempo de conexión.** Mide competencias demostradas.
- **No es un bootcamp con fecha fija de graduación.** Se avanza por dominio, no por calendario.
- **No garantiza empleo.** Garantiza una preparación rigurosa, medible y orientada a demostrar competencias reales.

---

## 5. Principios de diseño del producto

Además de las seis características, la plataforma obedece a cinco principios técnicos de producto:

1. **El progreso es evidencia, no actividad.** Un video visto no desbloquea un módulo; lo hace una evaluación superada.
2. **Todo error es material didáctico.** Cada fallo registra qué concepto revela y programa refuerzo.
3. **La IA es pares, no oráculo.** El tutor pregunta, sugiere y verifica; no sentencia.
4. **Nada de código de estudiante en el servidor principal.** Toda ejecución ocurre en sandbox aislado con límites de recursos.
5. **Cada funcionalidad debe ser explicable al estudiante.** Si una función de la plataforma no puede enseñarse como ejemplo de buen desarrollo, no pertenece a un producto que enseña desarrollo.

---

## 6. Criterio de éxito del proyecto

La plataforma habrá cumplido su propósito cuando permita a una persona:

1. Completar la ruta desde cero (o desde su diagnóstico) hasta un proyecto full-stack con funcionalidad de IA.
2. Demostrar con evidencias —código, pruebas, documentación, defensa oral— las competencias del perfil de egreso.
3. Aprobar simulaciones de entrevista técnica evaluadas con criterios explícitos.
4. Explicar, sobre cualquier fragmento de su propio código, **de dónde salió, por qué existe y cómo sabe que funciona**.

El punto 4 es el criterio final: un egresado que no puede auditar su propio código no ha completado CodeAI Academy, independientemente de las métricas que muestre la plataforma.

---

## Documentos relacionados

- [`fundamentos-pedagogicos.md`](fundamentos-pedagogicos.md) — base investigativa del método
- [`perfil-profesional.md`](perfil-profesional.md) — competencias de egreso
- [`../01-curriculo/curriculo-maestro.md`](../01-curriculo/curriculo-maestro.md) — implementación curricular
