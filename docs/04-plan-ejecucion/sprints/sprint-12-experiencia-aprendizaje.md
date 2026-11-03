# Sprint 12 — Experiencia de aprendizaje (UX / Frontend)

> **Estado:** ✅ cerrado (2026-10-30; 10/10 tareas, T9 como deuda documentada) · **Duración prevista:** 8–10 sesiones · **Depende de:** S3 (lección y catálogo), S4 (progreso y desbloqueos), S5–S6 (laboratorio y pistas), S7 (repaso SM-2), S8 (tutor socrático) y S11 (analítica: `GET /api/analytics/me/summary`).
> **Ámbito:** solo `apps/web`. Ninguna tarea cambia el esquema de datos ni añade endpoints salvo que su ficha lo diga explícitamente (T9, streaming del tutor, es la única con dependencia de API y se puede posponer).
> **Por qué este sprint existe:** los once sprints anteriores construyeron un producto correcto, accesible y bien probado, pero la **capa de presentación** aún no acompaña a la pedagogía. El alumno que vuelve no sabe dónde iba, el catálogo no muestra avance, el código de las lecciones no se resalta, los 7 pasos se leen en pasivo y el tutor —el gran diferenciador de IA— está al fondo de la lección y ausente del laboratorio. Este sprint convierte "bien construido" en "producto que engancha y enseña mejor", sin tocar la lógica de negocio ya verificada.

---

## 1. Objetivo

Al cerrar el sprint, el estudiante:

- aterriza en un **panel de inicio accionable** (no en un catálogo plano) con "continuar", repaso vencido y una foto de su progreso;
- ve en el **catálogo** el estado real de cada etapa (bloqueada / en curso / dominada y % de avance);
- lee lecciones con **código resaltado**, botón de copiar y salto directo al laboratorio;
- recorre **los 7 pasos como un stepper activo**, no como una lista;
- tiene al **tutor socrático dentro del laboratorio**, con el contexto de su código actual;
- puede **alternar tema claro/oscuro** y navega bien en **móvil**;
- percibe las cargas con **esqueletos**, no con texto plano.

Todo con el mismo listón de accesibilidad y pruebas del resto del proyecto.

## 2. Alcance

**Incluye**

- Panel de inicio del estudiante en `/learn` (mover el catálogo a `/learn/stages`).
- Estado de progreso en las tarjetas del catálogo y en el outline de etapa.
- Resaltado de sintaxis en los bloques `code` de la lección (Shiki, en build), botón copiar y enlace "abrir en el laboratorio".
- Stepper interactivo para la microestructura de 7 pasos.
- Tutor acoplado en el laboratorio con el código del intento como contexto.
- (Opcional / con dependencia de API) respuestas del tutor en streaming.
- Toggle de tema claro/oscuro con tokens CSS y auditoría de contraste WCAG AA.
- Navegación móvil (barra inferior) y poda de efectos globales de rendimiento.
- Esqueletos de carga en las vistas principales.
- Onboarding de primer uso (3 pasos: objetivo, nivel, ritmo semanal).

**No incluye**

- El **sandbox real** de ejecución. Sigue siendo `mock` y es deuda declarada en `banco-ejercicios.md` §5 y `sandbox-ejecucion.md`; es trabajo de backend/infra y merece su propio sprint. Este sprint no lo aborda.
- Internacionalización completa (i18n). Se recomienda, pero se planifica aparte para no mezclar extracción de cadenas con rediseño.
- Nuevos tipos de ejercicio ("auditar código de IA") y cualquier cambio de currículo.

**Fuera de alcance explícito**

- Rediseñar la landing pública. Sus efectos 3D se podan por rendimiento (T8) pero su estructura no cambia.

## 3. Decisiones de diseño

**3.1 El inicio del área privada es un panel, no un catálogo.** Hoy `/learn` renderiza `StageCatalog`. El alumno que vuelve el día 14 ve 12 tarjetas iguales y tiene que recordar dónde iba. El catálogo se mueve a `/learn/stages` (con redirección desde `/learn/stages` ya cubierta por el enrutado de etapas) y `/learn` pasa a ser un panel con una **única acción primaria** ("Continuar: …"), el recuento de repaso vencido y una foto de progreso. Los datos ya existen: `GET /api/analytics/me/summary` (contrato `StudentSummary` de `packages/shared`), `progressApi.listUnits()` y la cola de repaso de S7. No se inventa ningún dato nuevo.

**3.2 El progreso se muestra donde se decide.** Un catálogo que no dice dónde estás no orienta. Las tarjetas de etapa reciben estado (`locked` / `in_progress` / `mastered`) y porcentaje a partir del progreso por unidad que ya expone la API. El color de estado nunca es el único canal: cada estado lleva etiqueta de texto y, cuando aplica, icono con `sr-only`.

**3.3 El código de las lecciones se resalta en build, no en cliente.** Un curso de programación con bloques `<pre><code>` en gris plano pierde credibilidad y legibilidad. Se usa **Shiki**, que resuelve el resaltado en tiempo de build/servidor y manda HTML coloreado sin JavaScript de resaltado al cliente (encaja con RSC de Next 16). Cada bloque gana botón "copiar" y, si el bloque declara que pertenece a un ejercicio, enlace "abrir en el laboratorio".

**3.4 Los 7 pasos se recorren, no se leen.** La microestructura (objetivo → explicación → práctica guiada → autónoma → depuración → evaluación → transferencia) es el corazón pedagógico. Pasa de `<ol>` pasivo a un **stepper**: un paso visible a la vez, avance consciente ("Siguiente"), indicador de posición y marca de "visto". El avance se guarda en estado local de la vista; no se persiste en API en este sprint.

**3.5 El tutor vive donde se programa.** El tutor socrático es el diferenciador de IA y hoy está al fondo de la lección y **ausente del laboratorio**, justo donde el alumno se atasca. Se acopla como panel lateral (drawer en escritorio, hoja inferior en móvil) disponible sin scroll, y en el laboratorio recibe el **código actual del intento** y el enunciado como contexto. Sigue sin entregar la solución completa (regla de S8); solo gana contexto.

**3.6 El tema es un token, no un color fijo.** `colorScheme: "dark"` está fijo y el cuerpo de texto largo cansa en sesiones de lectura y de día. Se introducen variables CSS de tema en `:root` (oscuro por defecto) y un `[data-theme="light"]`, con un toggle que respeta `prefers-color-scheme` y recuerda la elección en `localStorage` con `try/catch`. Se audita contraste: los labels `text-slate-500` sobre tinta rozan el mínimo AA y se corrigen.

**3.7 El móvil usa una barra inferior, no un carrusel de píldoras.** `LearnNav` es hoy un scroll horizontal de 7 ítems sin señal de desbordamiento. En móvil se sustituye por una **bottom tab bar** con los 4–5 destinos clave; la barra de píldoras se conserva en escritorio.

**3.8 Los efectos no se pagan en todas las pantallas.** `AmbientPieces` y `GlowTracker` están en el layout raíz, así que corren también dentro de la app privada; el hero 3D arrastra Three.js (~150 KB+). Se restringen los efectos pesados a la landing y se confirma que respetan `prefers-reduced-motion` también en su lógica JS (no solo en CSS).

**3.9 La carga se percibe con esqueletos.** Los estados de carga son hoy texto ("Cargando…"). Se sustituyen por esqueletos con la forma del contenido final para reducir el salto de layout percibido.

---

## 4. Tareas

> Fichas atómicas. Cada una es auto-contenida y sigue `../../05-orquestacion/plantilla-tarea.md`. **Orden recomendado:** T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T10 → T9. T9 (streaming) va al final porque es la única con dependencia de API.
> Verificación común a todas salvo que se indique:
> ```bash
> npm run typecheck -w apps/web
> npm run lint -w apps/web
> npm run test -w apps/web
> ```
> y, si la tarea cambia rutas o layout, además `npm run build -w apps/web`. Resultado esperado: código de salida 0, 0 warnings, pruebas al 100 %.

### T1 — Panel de inicio del estudiante · 🔴 prioridad alta

- **Contexto:** `/learn` renderiza hoy `StageCatalog`. Esta tarea mueve el catálogo a `/learn/stages` y convierte `/learn` en un panel accionable.
- **Archivos:** `src/app/(learning)/learn/page.tsx` (modificar: pasa a renderizar el panel), `src/app/(learning)/learn/stages/page.tsx` (crear: aloja `StageCatalog`), `src/features/learning/components/StudentDashboard.tsx` (crear).
- **Datos (sin endpoints nuevos):** `GET /api/analytics/me/summary` (`StudentSummary`), `progressApi.listUnits()`, cola de repaso de S7. Verificar firmas contra `@codeai/shared` y `contratos-api.md`; si algo no existe, detenerse y preguntar.
- **Criterios:**
  - [x] `/learn` muestra una acción primaria "Continuar" que enlaza a la última unidad/lección en curso (o, si no hay progreso, a la primera etapa).
  - [x] Muestra el recuento de repaso vencido con enlace a `/learn/review`; si es 0, lo dice sin alarmar.
  - [x] Muestra una foto de progreso (porcentaje global y unidades dominadas/en curso) a partir de `StudentSummary`.
  - [x] `/learn/stages` muestra el catálogo que antes estaba en `/learn`, sin regresión.
  - [x] Estados de carga (esqueleto o texto `role="status"`), error (`role="alert"` con reintento) y "sin progreso aún" cubiertos.
  - [x] Prueba del panel con datos simulados inyectados (camino con progreso y camino de alumno nuevo).

### T2 — Estado de progreso en el catálogo y el outline · 🔴 alta

- **Contexto:** `StageCatalog` y `StageOutline` pintan contenido sin estado de avance.
- **Archivos:** `src/features/learning/components/StageCatalog.tsx` (modificar), `src/features/learning/components/StageOutline.tsx` (modificar), `src/components/ui/ProgressRing.tsx` (crear).
- **Criterios:**
  - [x] Cada tarjeta de etapa muestra estado (`bloqueada` / `en curso` / `dominada`) con etiqueta de texto, no solo color.
  - [x] Cada tarjeta muestra % de avance con un anillo/barra accesible (`role="progressbar"`, `aria-valuenow/min/max`).
  - [x] El outline de unidades refleja el mismo estado por unidad.
  - [x] Una etapa bloqueada comunica el prerrequisito (reutiliza `LockNotice`) y no es navegable.
  - [x] Prueba con etapas en los tres estados.

### T3 — Resaltado de sintaxis + copiar + abrir en el laboratorio · 🔴 alta

- **Contexto:** los bloques `code` en `LessonReader` son `<pre><code>` en gris plano.
- **Archivos:** `src/features/learning/components/CodeBlock.tsx` (crear: Shiki + botón copiar), `src/features/learning/components/LessonReader.tsx` (modificar: usa `CodeBlock`), `src/lib/highlight.ts` (crear: configura Shiki y temas claro/oscuro).
- **Dependencia:** añadir `shiki`. **Reportar la dependencia y pedir aprobación antes de instalarla** (regla del proyecto: no instalar sin visto bueno).
  - Instalada la versión 4.5.0 tras aprobación explícita. Queda registrada con su justificación en [`../../03-arquitectura/stack-tecnologico.md`](../../03-arquitectura/stack-tecnologico.md), como exige la cabecera de ese documento.
- **Criterios:**
  - [x] Los bloques `code` se resaltan según `block.language`; un lenguaje desconocido cae a texto plano sin romper.
  - [x] El resaltado se resuelve en servidor/build; no se envía el resaltador al cliente para la lectura.
  - [x] Botón "copiar" accesible con confirmación visible (`aria-live`).
  - [x] Si el bloque declara pertenecer a un ejercicio, aparece enlace "abrir en el laboratorio" a la unidad/ejercicio correcto.
  - [x] El resaltado funciona en tema claro y oscuro (coordinar con T7; hasta entonces, oscuro).
  - [x] Prueba de render con varios lenguajes y con lenguaje desconocido.

### T4 — Stepper de los 7 pasos · 🟠 media

- **Contexto:** en `LessonReader` los `steps` se vuelcan como un `<ol>`.
- **Archivos:** `src/features/learning/components/StepsFlow.tsx` (crear), `src/features/learning/components/LessonReader.tsx` (modificar).
- **Criterios:**
  - [x] Se muestra un paso a la vez con indicador de posición (p. ej. "3 / 7") y nombre legible del paso.
  - [x] Navegación "Anterior/Siguiente" accesible por teclado; el foco se gestiona al cambiar de paso.
  - [x] Cada paso visitado queda marcado como visto (estado local, sin persistir).
  - [x] Respeta `prefers-reduced-motion` en cualquier transición.
  - [x] Prueba de avance/retroceso y de marca de "visto".

### T5 — Tutor en el laboratorio con contexto de código · 🔴 alta

- **Contexto:** `TutorPanel` solo se usa en la lección; el laboratorio (`ExerciseLab`) solo tiene `HintPanel`. El contrato del tutor (S8) acepta `lessonId`; verificar si admite contexto adicional de ejercicio/código y, si no, pasar el código como parte del `message` sin cambiar el contrato.
- **Archivos:** `src/features/ai/components/TutorPanel.tsx` (modificar: aceptar contexto opcional de código), `src/features/lab/components/ExerciseLab.tsx` (modificar: montar el tutor en el laboratorio).
- **Criterios:**
  - [x] En el laboratorio hay un tutor accesible sin abandonar la pantalla; en móvil se abre como hoja inferior.
  - [x] El tutor recibe el enunciado y el código actual del intento como contexto.
  - [x] Se mantiene la regla de S8: el tutor guía con preguntas y no entrega la solución completa; se conserva el aviso de privacidad.
  - [x] No se cambia el contrato de la API del tutor (si hiciera falta, detenerse y preguntar).
  - [x] Prueba de que el contexto de código viaja en la petición.

### T6 — Toggle de tema claro/oscuro + contraste · 🟠 media

- **Contexto:** `colorScheme: "dark"` fijo en `layout.tsx`; colores Tailwind hardcodeados (`ink`, `slate-*`).
- **Archivos:** `src/app/globals.css` (modificar: tokens CSS de tema), `src/components/ui/ThemeToggle.tsx` (crear), `src/app/layout.tsx` (modificar: script sin parpadeo que fija `data-theme` antes del render).
- **Auditoría de contraste:** los pares color/fondo revisados y su ratio medido viven junto a los tokens, en `src/app/globals.css`, para ambos temas y con el umbral AA de 4.5:1.
- **Nota:** tarea más grande que la media. Si al implementar se ve que toca demasiados archivos de color, **dividirla** (primero tokens + oscuro, luego claro) y reportarlo.
- **Criterios:**
  - [x] Existen tokens CSS de tema en `:root` (oscuro por defecto) y `[data-theme="light"]`.
  - [x] El toggle recuerda la elección en `localStorage` con `try/catch` y respeta `prefers-color-scheme` en el primer render sin parpadeo (FOUC).
  - [x] Los labels y textos secundarios cumplen contraste WCAG AA en ambos temas (documentar los pares color/fondo revisados).
  - [x] El toggle es accesible (rol, etiqueta, operable por teclado).
  - [x] Prueba del cambio de tema y de la persistencia.

### T7 — Navegación móvil (barra inferior) · 🟠 media

- **Contexto:** `LearnNav` es un scroll horizontal de 7 píldoras.
- **Archivos:** `src/features/learning/components/MobileTabBar.tsx` (crear), `src/app/(learning)/learn/layout.tsx` (modificar: barra inferior en móvil, píldoras en escritorio).
- **Criterios:**
  - [x] En móvil aparece una barra inferior fija con 4–5 destinos clave e indicación de ruta activa (`aria-current`).
  - [x] En escritorio se conserva `LearnNav` sin regresión.
  - [x] No tapa contenido (padding inferior reservado) y respeta áreas seguras (`env(safe-area-inset-bottom)`).
  - [x] Operable por teclado y lector de pantalla.
  - [x] Prueba de resaltado de ruta activa.

### T8 — Poda de efectos globales por rendimiento · 🟠 media

- **Contexto:** `AmbientPieces` y `GlowTracker` viven en el layout raíz y corren en toda la app; el hero 3D arrastra Three.js.
- **Archivos:** `src/app/layout.tsx` (modificar: sacar los efectos pesados del layout global), `src/app/page.tsx` (modificar: montar los efectos solo en la landing).
- **Criterios:**
  - [x] Las rutas `/learn/*` no cargan Three.js ni el rastreador de ratón global.
  - [x] Los efectos JS (no solo CSS) se desactivan con `prefers-reduced-motion`.
  - [x] La landing conserva su aspecto actual.
  - [x] No hay regresión visual verificable en la app privada.

### T9 — Streaming del tutor · 🟢 opcional / al final

- **Contexto:** la respuesta del tutor llega de golpe tras "está pensando…". El streaming mejora la percepción. **Requiere soporte de SSE/stream en la API de IA (S8).** Si la API no lo ofrece, esta tarea se limita a dejar el cliente listo detrás de una bandera y se documenta la deuda; **no** se implementa el endpoint aquí.
- **Archivos:** `src/features/ai/components/TutorPanel.tsx` (modificar), `src/lib/api-client.ts` (modificar: lector de stream si la API lo soporta).
- **Criterios:**
  - [x] Si la API soporta streaming, la respuesta se pinta token a token con `aria-live="polite"` y un cierre claro.
  - [x] Si no lo soporta, el comportamiento actual se conserva intacto y se deja la deuda anotada en §6 de este sprint.
  - [x] Ningún cambio rompe el límite de mensajes ni el aviso de saldo.

### T10 — Onboarding de primer uso · 🟢 baja

- **Contexto:** el alumno nuevo cae en el panel sin bienvenida.
- **Archivos:** `src/features/learning/components/FirstRunOnboarding.tsx` (crear), `src/features/learning/components/StudentDashboard.tsx` (modificar: mostrarlo si no hay progreso).
- **Criterios:**
  - [x] En el primer acceso (sin progreso) se ofrece un flujo breve de 3 pasos (objetivo, nivel de partida, ritmo semanal) **saltable**.
  - [x] La elección se guarda en `localStorage` con `try/catch`; no bloquea el uso de la plataforma.
  - [x] Accesible y operable por teclado.
  - [x] Prueba del camino "saltar" y del camino completo.

---

## 5. Esqueletos de carga (transversal a T1–T3)

No es una tarea suelta: al tocar cada vista en T1–T3 se sustituye el texto "Cargando…" por un esqueleto con la forma del contenido final, conservando el `role="status"`/`aria-live` existente. Si resulta cómodo, extraer `src/components/ui/Skeleton.tsx` en T1 y reutilizarlo.

## 6. Deuda declarada al cierre

- **Sandbox real:** fuera de alcance; el laboratorio sigue sobre `mock`. Bloquea la certificación de E0–E2. Candidato a sprint propio de backend/infra.
- **Streaming del tutor (T9):** el cliente y la API siguen sin streaming y el comportamiento es el que había: una respuesta completa tras «está pensando…». Los adaptadores ya exponen `stream()` en `AiProvider` (`apps/api/src/modules/ai/providers/*.provider.ts`), pero nada lo consume: `AiService.tutor` usa `complete()` y `POST /api/ai/tutor` devuelve un `AiTutorResponse` JSON, sin `text/event-stream`. Hacerlo exige, en este orden: (1) un `@Sse`/respuesta en crudo en `AiController` que reutilice la misma cuota (`RateLimitGuard`, 30/h por usuario) y el mismo descuento de presupuesto; (2) mover `applyReplyGuards` al flujo —un texto parcial no se puede validar al final sin haberlo ya pintado—; (3) un lector de stream en `apps/web/src/lib/api-client.ts` y la pintura token a token con `aria-live="polite"` en `TutorPanel`. Mientras eso no exista no se toca `TutorPanel`: `TutorPanel.spec.tsx` sigue cubriendo el límite de mensajes, el saldo y el fallback. **No se añadió una bandera en el cliente**: una bandera solo puede gobernar código real, y sin `text/event-stream` no hay nada que gobernar; cuando exista el endpoint, la bandera entra en el mismo commit que el lector de stream y su prueba. El criterio 2 de la ficha de T9 queda así cumplido: comportamiento intacto y deuda anotada.
- **i18n:** cadenas aún hardcodeadas en español; extracción planificada aparte.

## 7. Criterios de cierre del sprint

- [x] T1–T8 y T10 aprobadas; T9 aprobada o documentada como deuda (lo segundo: §6).
- [x] `npm run typecheck -w apps/web`, `npm run lint -w apps/web` y `npm run test -w apps/web` en verde (342 pruebas en 46 archivos).
- [x] `npm run build -w apps/web` compila.
- [x] Sin regresión de accesibilidad: skip link, focus-visible, `prefers-reduced-motion`, roles y etiquetas conservados.
- [x] `README.md` (estado de construcción) y `roadmap-sprints.md` actualizados en el mismo commit que cierra el sprint.

## 8. Documentos relacionados

- [`../../05-orquestacion/plantilla-tarea.md`](../../05-orquestacion/plantilla-tarea.md)
- [`../../07-flujo-operativo.md`](../../07-flujo-operativo.md)
- [`../convenciones-codigo.md`](../convenciones-codigo.md)
- [`../../03-arquitectura/capa-ia.md`](../../03-arquitectura/capa-ia.md)
- [`../../03-arquitectura/contratos-api.md`](../../03-arquitectura/contratos-api.md)

## 9. Registro de ejecución

Cada tarea se cerró en su propio commit sobre `feat/ui-tetris-futurista`, con
specs nuevas o ampliadas en el mismo commit:

| Tarea | Commit | Qué dejó |
|-------|--------|----------|
| T1 | `bc0edcb` | Panel de inicio en `/learn`; el catálogo se mueve a `/learn/stages`. |
| T2 | `a38aaf6` | Estado y avance por etapa en el catálogo y en el outline. |
| T3 | `65f97e6` | Resaltado de sintaxis en build, botón de copiar y salto al laboratorio. |
| T4 | `bc3da5a` | Stepper de los siete pasos con foco gestionado. |
| T5 | `2a10443` | Tutor socrático dentro del laboratorio, con el código del intento como contexto. |
| T6 | `c1637ae` | Tema claro/oscuro sobre tokens CSS y contraste AA. |
| T7 | `d959dfc` | Barra inferior de navegación en móvil. |
| T8 | `071a987` | Los efectos de movimiento viven solo en la portada. |
| T10 | `82d7bdd` | Onboarding de primer uso en tres pasos. |
| T9 | `594e114` | Streaming del tutor declarado como deuda (§6). |
| — | `420b6a6` | Esta ficha entra al repositorio. |
