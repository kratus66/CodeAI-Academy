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

