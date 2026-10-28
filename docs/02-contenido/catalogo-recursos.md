# Catálogo de recursos multimedia

> Estrategia: **combinar recursos externos verificados con materiales propios, ejercicios originales y evaluaciones integradas**.

---

## 1. Política de incorporación de recursos

Ningún recurso entra al catálogo sin cumplir estas reglas:

| Regla | Descripción |
|-------|-------------|
| **URL verificada** | Comprobada manualmente y registrada con fecha de revisión |
| **Metadatos completos** | Idioma, nivel, duración, tema, licencia, tipo |
| **Vigencia** | Revisión periódica; se marca obsoleto si supera 12 meses sin revalidar |
| **Licencia compatible** | Nunca se copia contenido con licencia incompatible; se enlaza al origen |
| **Calidad técnica** | Revisada por una persona con criterio en la materia |
| **Accesibilidad** | Subtítulos, contraste, transcripción cuando sea posible |
| **Complementariedad** | Ningún recurso externo sustituye la ruta curricular propia |

> **Criterio importante:** no todo recurso que aparezca en Internet es adecuado. Un video popular puede enseñar prácticas obsoletas o inseguras.

---

## 2. Recursos externos iniciales

### 2.1 MDN Web Docs — fundamentos web

| Campo | Valor |
|-------|-------|
| **Acceso** | Gratuito |
| **URL** | https://developer.mozilla.org/es/docs/Learn |
| **Idioma** | Español e inglés |
| **Tipo** | Documentación + tutoriales |
| **Etapas** | E0, E2, E4 |
| **Uso** | Referencia central de HTML, CSS, JS y accesibilidad |

**Valor pedagógico:** es fuente primaria. Enseñar a leerla es parte del objetivo de la Etapa 0.

**Advertencia incorporada al currículo:** el propio currículo de MDN señala que aprender herramientas modernas sin comprender los fundamentos deja vacíos en resolución de problemas, accesibilidad y conocimientos esenciales de la web. Ese riesgo es exactamente lo que este programa combate.

### 2.2 freeCodeCamp — práctica guiada

| Campo | Valor |
|-------|-------|
| **Acceso** | Gratuito |
| **URL** | https://www.freecodecamp.org/espanol/learn/ |
| **Idioma** | Español e inglés |
| **Tipo** | Cursos interactivos + proyectos |
| **Etapas** | E1, E2, E4 |
| **Uso** | Refuerzo de ejercicios; **no sustituye** la ruta curricular propia |

### 2.3 Full Stack Open — desarrollo full-stack

| Campo | Valor |
|-------|-------|
| **Acceso** | Gratuito |
| **URL** | https://fullstackopen.com/es/ |
| **Idioma** | Español, inglés y otros |
| **Tipo** | Curso avanzado con ejercicios |
| **Etapas** | E4, E5, E6, E7 |
| **Prerequisito** | Conocimientos previos de programación (E2 completo) |
| **Uso** | Complemento de React, Node, APIs, pruebas y bases de datos |

### 2.4 OpenAI — ingeniería de aplicaciones con modelos

| Campo | Valor |
|-------|-------|
| **Acceso** | Gratuito (documentación) |
| **URL** | https://platform.openai.com/docs/guides |
| **Idioma** | Inglés |
| **Tipo** | Documentación técnica |
| **Etapas** | E8, E9, E10 |
| **Uso** | Instrucciones, llamadas a herramientas, evaluación de modelos |

### 2.5 GitHub Copilot — asistentes de programación

| Campo | Valor |
|-------|-------|
| **Acceso** | Gratuito (documentación) |
| **URL** | https://docs.github.com/en/copilot |
| **Idioma** | Inglés |
| **Etapas** | E8 |
| **Uso** | Capacidades, limitaciones y uso responsable de asistentes |

### 2.6 Docker — despliegue y contenedores

| Campo | Valor |
|-------|-------|
| **Acceso** | Gratuito |
| **URL** | https://docs.docker.com/get-started/ |
| **Idioma** | Inglés (parcialmente traducido) |
| **Etapas** | E7 |
| **Uso** | Empaquetar aplicaciones y trabajar con entornos reproducibles |

---

## 2.7 Recursos por lección (E0–E1, sembrados en `content.seed.json`)

> Fuente de verdad operativa: el array `resources` de `content.seed.json` y las
> entradas `resources` de cada lección. Esta tabla es la vista legible en
> Markdown de esos mismos datos; si se añade o cambia un recurso en el seed,
> se actualiza también aquí en el mismo cambio (regla editorial #6).

Todos los recursos de esta sección se verificaron el 2026-10-27, son de acceso
gratuito y no requieren registro de pago. Estado inicial: `VERIFIED` para
todos salvo indicación contraria.

### E0 — Diagnóstico y preparación del entorno

**U0.1.1 — Qué es desarrollar software: del requisito al despliegue** (lección `del-requisito-al-despliegue`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [What is SDLC (Software Development Life Cycle)?](https://www.atlassian.com/agile/software-development/sdlc) — Atlassian | Documentación | 15 min | Inglés | Lee las fases y compáralas con el recorrido de siete etapas de la lección. |

**U0.1.2 — Roles en un equipo: frontend, backend, datos, QA, infraestructura, IA** (lección `roles-en-un-equipo-tecnico`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Developer Roadmaps](https://roadmap.sh/roadmaps) — roadmap.sh | Interactivo | — | Inglés | Ubica tu rol objetivo en el mapa y anota qué módulos de este programa lo cubren. |

**U0.1.3 — Cómo se organiza un proyecto real: repos, tableros, revisiones** (lección `repos-tableros-y-revisiones`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow) — GitHub Docs | Documentación | 10 min | Inglés | Lee el flujo completo antes de la práctica guiada de esta lección. |
| [About pull requests](https://docs.github.com/en/pull-requests/get-started/about-pull-requests) — GitHub Docs | Documentación | 10 min | Inglés | Entiende por qué una revisión ocurre antes de aceptar un cambio, no después. |
| [What is a kanban board?](https://www.atlassian.com/agile/kanban/boards) — Atlassian | Documentación | 12 min | Inglés | Compara las columnas de un tablero real con las etapas del recorrido de un requisito. |

**U0.2.1 — Sistema de archivos, terminal y rutas** (lección `sistema-de-archivos-terminal-y-rutas`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Command line crash course](https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Environment_setup/Command_line) — MDN Web Docs | Documentación | 20 min | Inglés | Practica los comandos básicos (cd, ls, mkdir) antes del ejercicio de rutas. |

**U0.2.2 — Editor de código: atajos, extensiones mínimas, depurador** (lección `editor-de-codigo-atajos-y-depurador`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Keyboard shortcuts for Visual Studio Code](https://code.visualstudio.com/docs/configure/keybindings) — Visual Studio Code Docs | Documentación | 10 min | Inglés | Memoriza al menos cinco atajos de navegación antes de seguir con el resto del curso. |
| [Debug code with Visual Studio Code](https://code.visualstudio.com/docs/debugtest/debugging) — Visual Studio Code Docs | Documentación | 15 min | Inglés | Sigue la guía oficial para poner tu primer breakpoint en un archivo real. |

**U0.2.3 — Navegador como herramienta de desarrollo: DevTools** (lección `devtools-del-navegador`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Chrome DevTools](https://developer.chrome.com/docs/devtools) — Chrome for Developers | Documentación | 15 min | Inglés | Recorre los paneles de Elements y Console antes de inspeccionar una página propia. |

**U0.2.4 — Instalación de Node.js, Git y gestor de paquetes** (lección `instalar-nodejs-git-y-npm`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Learn Node.js](https://nodejs.org/learn) — Node.js | Documentación | 20 min | Inglés | Instala Node.js siguiendo la guía oficial y verifica la versión con node -v. |
| [npm Docs](https://docs.npmjs.com/) — npm | Documentación | 15 min | Inglés | Referencia para resolver dudas sobre npm install y package.json. |
| [Pro Git (libro completo, en español)](https://git-scm.com/book/es/v2) — git-scm.com | Documentación | — | Español | Lee el capítulo 1 (instalación y configuración) en español. |

**U0.2.5 — Verificación del entorno (checklist automatizado)** (lección `verificacion-del-entorno`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Learn Node.js](https://nodejs.org/learn) — Node.js | Documentación | 20 min | Inglés | Confirma que tu instalación coincide con la guía oficial antes de correr el checklist. |
| [npm Docs](https://docs.npmjs.com/) — npm | Documentación | 15 min | Inglés | Si falla un comando npm, contrasta primero con la documentación oficial. |

**U0.3.1 — Generación probabilística: por qué a veces inventa** (lección `generacion-probabilistica-y-alucinaciones`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [What are AI hallucinations?](https://www.ibm.com/think/topics/ai-hallucinations) — IBM Think | Documentación | 10 min | Inglés | Ejemplos reales documentados de alucinaciones para contrastar con los de la lección. |

**U0.3.2 — Conocimiento desactualizado y límites de contexto** (lección `conocimiento-desactualizado-y-limites-de-contexto`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows) — Claude Platform Docs (Anthropic) | Documentación | 10 min | Inglés | Explica por qué más contexto no siempre mejora la respuesta (context rot). |

**U0.3.3 — Cuándo la IA acelera y cuándo introduce deuda** (lección `cuando-la-ia-acelera-y-cuando-introduce-deuda`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Responsible AI pair programming with GitHub Copilot](https://github.blog/ai-and-ml/github-copilot/responsible-ai-pair-programming-with-github-copilot/) — The GitHub Blog | Documentación | 10 min | Inglés | Prácticas de revisión recomendadas por GitHub para código generado con IA. |

**U0.4.1 — Cómo leer documentación oficial** (lección `como-leer-documentacion-oficial`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [The documentation system (Diátaxis)](https://docs.divio.com/documentation-system/) — Divio | Documentación | 15 min | Inglés | Aprende a distinguir tutorial, guía práctica, referencia y explicación antes de leer cualquier doc. |

**U0.4.2 — Cómo investigar un error (leer el mensaje, aislar, reproducir)** (lección `como-investigar-un-error`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [What is Debugging? How to Debug Your Code for Beginners](https://www.freecodecamp.org/news/what-is-debugging-how-to-debug-code/) — freeCodeCamp | Documentación | 15 min | Inglés | Guía práctica para leer el mensaje de error completo antes de buscar la causa. |

**U0.4.3 — Organización de tareas y registro de avances** (lección `organizacion-de-tareas-y-registro-de-avances`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [What is a kanban board?](https://www.atlassian.com/agile/kanban/boards) — Atlassian | Documentación | 12 min | Inglés | Usa esta referencia para montar tu propio tablero de seguimiento de tareas. |

### E1 — Lógica de programación y resolución de problemas

**U1.1.1 — Algoritmos y pseudocódigo** (lección `algoritmos-y-pseudocodigo`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [What is Pseudocode? How to Use Pseudocode to Solve Coding Problems](https://www.freecodecamp.org/news/what-is-pseudocode-in-programming/) — freeCodeCamp | Documentación | 15 min | Inglés | Refuerza la idea de planear en pseudocódigo antes de programar. |

**U1.1.2 — Diagramas de flujo** (lección `diagramas-de-flujo`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [How to Make Flowcharts and Bring Joy to your Coding](https://www.freecodecamp.org/news/how-to-make-flowcharts-with-mermaid/) — freeCodeCamp | Documentación | 15 min | Inglés | Muestra las formas estándar (proceso, decisión) que debes usar en tus propios diagramas. |

**U1.1.3 — Descomposición de problemas** (lección `descomposicion-de-problemas`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [How to make complex problems easier by decomposing and composing](https://www.freecodecamp.org/news/how-to-make-complex-problems-easier-by-decomposing-and-composing-be57ce230c49) — freeCodeCamp | Documentación | 15 min | Inglés | Profundiza en cómo asignar responsabilidades a cada parte descompuesta. |

**U1.1.4 — Casos límite y análisis de errores** (lección `casos-limite-y-analisis-de-errores`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [A Beginner's Guide to Testing: Error Handling Edge Cases](https://www.freecodecamp.org/news/a-beginners-guide-to-testing-implement-these-quick-checks-to-test-your-code-d50027ad5eed/) — freeCodeCamp | Documentación | 15 min | Inglés | Lista concreta de casos límite (cero, uno, máximo) para aplicar en tu práctica independiente. |

**U1.2.1 — Variables y tipos de datos** (lección `variables-y-tipos-de-datos`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Grammar and types](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types) — MDN Web Docs | Documentación | 20 min | Inglés | Referencia oficial de los tipos primitivos de JavaScript usados en los ejemplos de la lección. |

**U1.2.2 — Operadores y expresiones** (lección `operadores-y-expresiones`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Expressions and operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Expressions_and_operators) — MDN Web Docs | Documentación | 20 min | Inglés | Tabla completa de operadores y su precedencia, útil para resolver las trazas a mano. |

**U1.2.3 — Conversión y comparación de tipos** (lección `conversion-y-comparacion-de-tipos`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Grammar and types](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types) — MDN Web Docs | Documentación | 20 min | Inglés | Repasa las reglas de coerción de tipos antes de practicar === vs ==. |

**U1.2.4 — Arreglos, objetos, mapas y conjuntos** (lección `arreglos-objetos-mapas-y-conjuntos`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Indexed collections](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Indexed_collections) — MDN Web Docs | Documentación | 15 min | Inglés | Documentación oficial de arreglos: creación, recorrido y métodos. |
| [Keyed collections](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Keyed_collections) — MDN Web Docs | Documentación | 15 min | Inglés | Compara Map y Set con Object y Array antes de elegir cuál usar. |

**U1.3.1 — Condicionales** (lección `condicionales`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Control flow and error handling](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling) — MDN Web Docs | Documentación | 20 min | Inglés | Sintaxis oficial de if/else y switch para contrastar con el pseudocódigo de la lección. |

**U1.3.2 — Ciclos y casos de terminación** (lección `ciclos-y-casos-de-terminacion`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Loops and iteration](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration) — MDN Web Docs | Documentación | 15 min | Inglés | Referencia de for, while y do...while, incluida la condición de término de cada uno. |

**U1.3.3 — Condiciones compuestas y tablas de verdad** (lección `condiciones-compuestas-y-tablas-de-verdad`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Boolean Algebra Truth Table Tutorial](https://www.freecodecamp.org/news/boolean-algebra/) — freeCodeCamp | Documentación | 15 min | Inglés | Tablas de verdad completas de AND, OR, NOT y XOR para verificar tus propias tablas. |

**U1.4.1 — Funciones, parámetros y retornos** (lección `funciones-parametros-y-retornos`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions) — MDN Web Docs | Documentación | 20 min | Inglés | Referencia oficial de declaración de funciones, parámetros por defecto y retorno. |

**U1.4.2 — Alcance (scope)** (lección `alcance-scope`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures) — MDN Web Docs | Documentación | 20 min | Inglés | Explica el encadenamiento de alcances (scope chain) con más detalle que la lección. |

**U1.4.3 — Composición de funciones** (lección `composicion-de-funciones`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [What is Functional Programming? A Beginner's JavaScript Guide](https://www.freecodecamp.org/news/functional-programming-in-javascript/) — freeCodeCamp | Documentación | 20 min | Inglés | Ejemplos adicionales de cómo combinar funciones pequeñas en una más compleja. |

**U1.4.4 — Funciones puras y efectos secundarios** (lección `funciones-puras-y-efectos-secundarios`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [What Is a Pure Function in JavaScript?](https://www.freecodecamp.org/news/what-is-a-pure-function-in-javascript-acb887375dfe/) — freeCodeCamp | Documentación | 15 min | Inglés | Las dos pruebas de pureza (mismo resultado, sin efectos secundarios) con más ejemplos de código. |

**U1.5.1 — Conteo de operaciones** (lección `conteo-de-operaciones`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [VisuAlgo — visualización de estructuras de datos y algoritmos](https://visualgo.net/en/sorting) — VisuAlgo (National University of Singapore) | Interactivo | — | Inglés | Ejecuta un algoritmo de ordenamiento paso a paso y cuenta las comparaciones a simple vista. |

**U1.5.2 — Complejidad temporal intuitiva O(n), O(n²), O(log n)** (lección `complejidad-temporal-intuitiva`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Big O Notation Explained with Examples](https://www.freecodecamp.org/news/big-o-notation-explained-with-examples/) — freeCodeCamp | Documentación | 20 min | Inglés | Más ejemplos de O(1), O(n), O(n²) y O(log n) con código, misma notación que usa la lección. |

**U1.5.3 — Comparar dos soluciones al mismo problema** (lección `comparar-dos-soluciones`)

| Recurso | Tipo | Duración | Idioma | Por qué sirve aquí |
|---------|------|----------|--------|---------------------|
| [Big O Notation Explained with Examples](https://www.freecodecamp.org/news/big-o-notation-explained-with-examples/) — freeCodeCamp | Documentación | 20 min | Inglés | Repasa la notación antes de comparar dos soluciones al mismo problema. |
| [VisuAlgo — visualización de estructuras de datos y algoritmos](https://visualgo.net/en/sorting) — VisuAlgo (National University of Singapore) | Interactivo | — | Inglés | Compara visualmente cuántos pasos da cada algoritmo sobre la misma entrada. |

---

## 3. Formato de metadatos de un recurso (obligatorio)

```yaml
id: res-mdn-js-async
title: "Asincronía en JavaScript — MDN"
provider: MDN
url: https://developer.mozilla.org/es/docs/Learn/JavaScript/Asynchronous
type: documentation | video | course | interactive | repository | diagram
language: es | en | both
stages: [0, 1]
units: [U2.3.2, U2.3.3]
level: beginner | intermediate | advanced
duration_min: 45
license: CC-BY-SA-2.5 (verificar)
reviewed_at: 2026-10-26
reviewed_by: "equipo de contenido"
status: verified | needs-review | obsolete
notes: "Cubre promesas y async/await. No cubre event loop en profundidad."
embed_allowed: false        # true solo si el proveedor lo permite
fallback: "mostrar enlace de origen"
```

### Reglas de estado
- `verified` → visible en la plataforma.
- `needs-review` → visible con aviso.
- `obsolete` → oculto, no borrado (para trazabilidad).

---

## 4. Material propio que debemos producir

Los recursos externos no cubren lo específico de este programa. Hay que producir:

| Tipo de material | Uso pedagógico | Cantidad inicial estimada |
|------------------|----------------|---------------------------|
| **Videos breves** | Explicar conceptos y demostrar procedimientos | 1 por módulo (~40) |
| **Diagramas originales** | Arquitecturas, flujos, relaciones, procesos | 3–5 por etapa |
| **Animaciones** | Asincronía, eventos, peticiones HTTP, ejecución | 1 por concepto difícil (~25) |
| **Capturas anotadas** | Errores, depuración, DevTools | 2 por módulo práctico |
| **Repositorios de ejemplo** | Analizar código real y practicar revisiones | 1 por etapa |
| **Laboratorios interactivos** | Practicar con retroalimentación inmediata | Biblioteca completa |
| **Entrevistas grabadas/simuladas** | Observar cómo se explican decisiones | 5–10 iniciales |

---

## 5. Estructura de almacenamiento

```
apps/web/public/media/
├── videos/           # clips propios, MP4/H.264, < 3 min
├── diagrams/         # SVG (preferido) o PNG @2x
├── animations/       # SVG animado o WebM
└── captures/         # capturas anotadas

packages/shared/content/resources/
└── index.json        # catálogo completo de recursos (externos + propios)
```

**Reglas técnicas:**
- Diagramas en **SVG** siempre que sea posible (escalable, accesible, ligero).
- Video propio sirve además una **transcripción** en texto.
- Toda imagen tiene `alt` descriptivo; toda animación tiene versión estática de respaldo.
- Tamaño máximo por video: 15 MB (comprimido).

**Nota de arquitectura:** los binarios multimedia **no** se guardan en la base de datos. Se almacenan como archivos y la tabla `Resource` guarda la ruta o la URL externa.

---

## 6. Criterios de accesibilidad multimedia

- [ ] Subtítulos en videos propios.
- [ ] Transcripción textual disponible.
- [ ] Sin contenido esencial solo en audio.
- [ ] Contraste suficiente en diagramas.
- [ ] Sin destellos o parpadeos rápidos.
- [ ] Reproducción sin autoplay con sonido.

---

## 7. Cómo se integra un recurso en una lección

```tsx
<ResourceCard
  provider="MDN"
  title="Asincronía en JavaScript"
  language="es"
  duration="45 min"
  level="intermedio"
  url="https://developer.mozilla.org/es/docs/Learn/JavaScript/Asynchronous"
  embedAllowed={false}
  note="Leer las secciones de promesas y async/await antes de la práctica guiada."
/>
```

Cuando `embedAllowed` es `false`, la plataforma **muestra el enlace de origen** (nunca descarga ni reempaqueta el contenido).

---

## 8. Revisión periódica

| Frecuencia | Acción |
|------------|--------|
| Mensual | Verificar enlaces caídos (automatizado) |
| Trimestral | Revisar vigencia técnica de recursos de etapas activas |
| Anual | Revalidar licencias y condiciones de uso |
| Ante cambio mayor de tecnología | Marcar recursos afectados como `needs-review` |

---

## Documentos relacionados

- [`banco-ejercicios.md`](banco-ejercicios.md)
- [`../03-arquitectura/modelo-datos.md`](../03-arquitectura/modelo-datos.md) — entidad `Resource`
- [`../06-plantillas/plantilla-leccion.md`](../06-plantillas/plantilla-leccion.md)

