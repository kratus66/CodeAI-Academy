# Plan de poblado del banco de ejercicios y recursos (E0–E2)

> Cómo se llena el curso con ejercicios, enlaces y material multimedia **sin certificar lo que nadie comprobó**.
> **Estado:** 🔄 E0–E2 poblados y publicados (864 ejercicios en 52 unidades), verificados en navegador; **sin revisión humana** · **Fecha:** 2026-10-28
> Criterio de publicación: [`banco-ejercicios.md`](banco-ejercicios.md) §5 · Plantilla: [`../06-plantillas/plantilla-ejercicio.md`](../06-plantillas/plantilla-ejercicio.md) · Política de recursos: [`catalogo-recursos.md`](catalogo-recursos.md) §1.

---

## 1. Volumen real

E0, E1 y E2 suman **52 unidades** (14 + 18 + 20). Con el mínimo de §5 (8 `QUIZ`, 6 `FLASHCARD`, 1 `LAB` guiado, 1 `LAB` autónomo, 1 `DEBUG`, 1 `REFLECT`) son **≈ 1.000 ejercicios**. Hoy hay 18 sembrados, ninguno publicado.

La producción se hace **unidad a unidad y con revisión del molde antes de escalar**: un error de método repetido 50 veces cuesta más que revisar una unidad.

---

## 2. Qué se puede publicar y cuándo

| Tipo | ¿Se corrige hoy? | Bloqueo para publicar | Desbloqueo |
|------|------------------|-----------------------|------------|
| `QUIZ` | No: el envío exige `language` de sandbox | Falta ruta de respuesta | **T2**: `POST /api/exercises/:id/quiz-answers` (corrige en servidor, sin sandbox) |
| `FLASHCARD` | No | Falta revelar-tras-intento y calificación SM-2 | **T3**: revelar reverso tras un intento registrado y crear/reprogramar el `ReviewItem` |
| `LAB`, `DEBUG` | Con `mock`, **cualquier** código sin `TODO` da `PASSED` | Publicar certificaría competencias sin comprobar | Sandbox real (`sandbox-ejecucion.md`) |
| `REFLECT` | No | Falta ruta de entrega y rúbrica (S9) | Rúbrica de justificación de S9 |

Por eso los ejercicios se escriben ahora con `isPublished: false` y una guarda (`seed-exercise-quality.spec.ts`) impide publicarlos antes de que exista su ruta de corrección. Publicar un `QUIZ` sin T2 lo mostraría en el laboratorio de código y fallaría con `400`.

---

## 3. Tareas

| ID | Tarea | Estado |
|----|-------|--------|
| T1 | Esquema de semilla para `QUIZ` (opciones con explicación propia, sin verdadero/falso ni «todas las anteriores») y `FLASHCARD` (reverso breve); carga en `seed.mts` sin exponer la respuesta | ✅ |
| T1b | Molde de unidad: U0.1.1 con 8 `QUIZ`, 6 `FLASHCARD` y 1 `REFLECT` | ✅ **a revisar por una persona** |
| T2 | API de `QUIZ`: corrige en servidor, registra el intento, devuelve la explicación de la opción elegida y de la correcta, programa el repaso | ✅ |
| T3 | API de `FLASHCARD`: reverso solo tras un intento registrado; la calidad 0–5 reprograma SM-2 | ✅ |
| T4 | Web: `QuizPlayer`, `FlashcardPlayer` y `ExercisePlayer` (despacha por tipo) | ✅ |
| T5 | E0 completo (14 unidades) | ✅ escrito y publicado; **sin revisión humana** |
| T6 | E1 y E2 (`LAB` y `DEBUG` con solución ejecutada en prueba, como el piloto `js-async-00x`) | ✅ escrito y publicado; **sin revisión humana** |
| T7 | Recursos de E2–E11 (hoy 204 recursos) | ✅ 2026-10-28: las 207 lecciones tienen al menos un recurso oficial (uno por unidad en E2–E11), con URL comprobada (200) y título leído; **contenido no leído completo** |
| T9 | Ejercicios de E3–E11 (155 unidades) | ✅ escrito y publicado 2026-10-28: 8 `QUIZ` + 6 `FLASHCARD` + 1 `REFLECT` por unidad (2.325 ejercicios), sin `LAB`/`DEBUG` por no haber sandbox real; **sin revisión humana** |
| T8 | Publicar | ✅ por decisión del responsable (2026-10-28) se publicó todo sin esperar revisión ni sandbox real, con aviso en los laboratorios |

**Excepción por revisar (T1b):** U0.1.1 es conceptual y no admite `LAB` ni `DEBUG` con código sin forzarlos. El mínimo de §5 debe decir cómo se cubren las unidades conceptuales; propuesta: `LAB` guiado y autónomo pasan a ser un `AUDIT`/`DEBUG` de texto (p. ej. corregir un conjunto de criterios de aceptación mal escritos), con la rúbrica de la unidad.

---

## 4. Recursos: material multimedia y enlaces

Reglas de [`catalogo-recursos.md`](catalogo-recursos.md) §1, aplicadas así:

| Origen | Estado de entrada | Quién lo promueve a `VERIFIED` |
|--------|-------------------|--------------------------------|
| Documentación oficial y páginas de cursos que se abren y leen (MDN, docs oficiales, freeCodeCamp, Full Stack Open, CS50…) | `VERIFIED`, con fecha de revisión y nota de cómo se comprobó | Quien lo añade, tras abrir la página y comprobar título, idioma y vigencia |
| Videos | `NEEDS_REVIEW` | Una persona que lo **vea**: no es posible comprobar el contenido de un video por texto, solo que la URL existe y el título coincide |
| Material propio (diagramas, animaciones, trazas) | Va en la lección como bloque `diagram`; ya hay 15 | Revisión pedagógica (`revision-pedagogica.md`) |

Solo se sirven a estudiantes los `VERIFIED`: un video pendiente nunca llega a la pantalla.

---

## 4.1 Lo que se publicó sin revisar (2026-10-28)

El responsable decidió publicar E0–E2 «aunque falle» y corregir después. Estado real:

| Qué | Cifra |
|-----|-------|
| Unidades con paquete (E0–E2) | 52 de 52 |
| Ejercicios | 864: 422 `QUIZ`, 312 `FLASHCARD`, 52 `REFLECT`, 52 `LAB`, 26 `DEBUG` |
| Verificado por máquina | Esquema y reglas de la plantilla (todos); soluciones JavaScript **ejecutadas** (LAB/DEBUG); 12 afirmaciones de TypeScript contrastadas con el compilador; reparto de la respuesta correcta |
| **No verificado** | Exactitud pedagógica y técnica de los enunciados, claridad de los distractores, dificultad real, URLs del campo `sources` (se escribieron de memoria, ninguna se abrió), longitud de la opción correcta (en varios quizzes es la más larga) |

**Riesgos abiertos de la publicación sin revisar**
1. **Los laboratorios no certifican nada:** el sandbox sigue siendo `mock` (da `PASSED` a cualquier código sin `TODO`). Cada laboratorio lo avisa en pantalla, pero el `achievedLevel` que se guarda en base de datos sigue calculándose como si fuera real.
2. **Fuentes sin comprobar:** cientos de ejercicios citan URLs que nadie abrió; algunas pueden dar 404.
3. **Dos videos de la lección U0.1.1** están publicados sin que nadie los haya visto.

**Puntos concretos que los autores dejaron marcados para una persona**
- U0.2.4: un quiz afirma que `sudo` no existe en Windows; no sale de la lección.
- U0.1.2: la fuente es `roadmap.sh/roadmaps`, demasiado genérica.
- U1.1.4: el LAB guiado fija un límite de 130 años y devuelve `false` en entradas inválidas (decisión del autor, no de la lección).
- U1.2.3: el LAB autónomo `parsePrice` usa una expresión regular que la lección no enseña. U1.2.2 usa `Math.floor`, que la lección menciona pero no practica.
- U1.3.1, U1.3.2, U1.4.1: reglas inventadas por el autor (franja de edad de menores, `RangeError` en `collatzSteps`, reglas de contraseña fuerte). Quiz 7 de U1.3.2: la explicación del ciclo con `i++` e `i > 0` debe matizarse.
- U1.5.3: el LAB autónomo fija «el que aparece primero» como desempate; la lección no lo dice. U1.5.2 y U1.5.3: la comprobación de O(n) cuenta lecturas con umbrales (4n y 10n), es empírica.
- U2.1.1: la condición «sin `==` ni `||`» solo vive en el enunciado; ninguna prueba puede comprobarla.
- U2.1.4: el LAB autónomo usa `tls = {}` como valor por defecto anidado, un paso más allá de la lección.
- U2.1.5: la afirmación de que `npm ci` falla si el lockfile no coincide con `package.json` no sale de la lección. El distractor «1.9.9» no es un error plausible.
- U2.3.3: los tiempos del quiz 4 (≈300 ms y ≈100 ms) son razonados, no medidos. U2.3.4: los dos quizzes de bloqueo no se ejecutaron (cuelgan el programa).
- U2.2.4: los LAB usan `class` al nivel superior; si el sandbox real solo reconociera declaraciones `function`, habría que cambiarlos.
- En general, los fragmentos de TypeScript de enunciados y opciones (E2, U2.4.x) se comprobaron solo en 12 afirmaciones clave, no uno por uno.

---

## 5. Criterios de aceptación de cada lote

- [ ] La semilla valida con `contentSeedSchema` (reglas duras de la plantilla).
- [ ] Cada `QUIZ` tiene una sola respuesta correcta, explicación propia en cada opción y la correcta repartida entre posiciones (guarda automática).
- [ ] Cada `LAB`/`DEBUG` tiene su solución **ejecutada** y su código inicial falla al menos una prueba visible.
- [ ] Cada ejercicio declara `concepts` (alimenta SM-2), `competencies` y una fuente oficial.
- [ ] Ninguna lección cita un ejercicio que no exista.
- [ ] Una persona revisó la unidad (no vale la revisión del mismo autor).

---

## Documentos relacionados

- [`banco-ejercicios.md`](banco-ejercicios.md)
- [`revision-pedagogica.md`](revision-pedagogica.md)
- [`../03-arquitectura/sandbox-ejecucion.md`](../03-arquitectura/sandbox-ejecucion.md)
