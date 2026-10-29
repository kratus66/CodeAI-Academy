# Convenciones de código

> Reglas obligatorias para todo el monorepo. Un entregable que las incumpla se rechaza aunque funcione.

---

## 1. Principios

1. **Legibilidad antes que astucia.** El código se lee muchas más veces de las que se escribe.
2. **Sin `any`, sin `@ts-ignore`, sin `TODO`.** Si el tipo es difícil, se modela o se pregunta.
3. **Código completo.** Nunca se entregan placeholders ni funciones vacías.
4. **Idioma:** identificadores, rutas y nombres de archivo en **inglés**; textos de interfaz, mensajes de error y comentarios en **español**.
5. **Sin dependencias nuevas** sin aprobación explícita del Orquestador.
6. **La documentación se actualiza en el mismo commit** que el código que la afecta.

---

## 2. Estructura del monorepo

```
apps/
  api/src/
    common/       # middleware, filtros, utilidades transversales
    config/       # validación de entorno
    modules/<dominio>/   # controller, service, module, dto/
  web/src/
    app/          # rutas (App Router)
    components/   # layout y ui reutilizables
    features/<feature>/components|data
    lib/          # utilidades sin estado (cn, formatters)
packages/shared/src/
  constants/  enums/  schemas/   # + *.spec.ts junto al archivo
```

**Regla de frontera:** si un tipo, constante o esquema cruza web↔api, vive en `packages/shared`. No se duplica.

---

## 3. Nombres

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Archivos TS (no componente) | `kebab-case` | `all-exceptions.filter.ts`, `trace-id.middleware.ts` |
| Componentes React | `PascalCase.tsx` | `LearningPath.tsx` |
| Pruebas | `<nombre>.spec.ts(x)` junto al archivo | `path.spec.ts`, `Hero.spec.tsx` |
| Clases y tipos | `PascalCase` | `HealthService`, `ErrorBody` |
| Funciones y variables | `camelCase` | `loadEnv`, `traceId` |
| Constantes globales | `SCREAMING_SNAKE_CASE` | `PAGE_SIZE_MAX`, `TRACE_HEADER` |
| Schemas Zod | `camelCase` + sufijo `Schema` | `registerSchema`, `healthResponseSchema` |
| Módulos Nest | carpeta en singular | `modules/health/` |

---

## 4. TypeScript

- `strict: true` heredado de `tsconfig.base.json`; no se relaja por workspace.
- Tipos derivados de Zod: `export type X = z.infer<typeof xSchema>`; nunca se declaran a mano si existe el esquema.
- `import type` para todo lo que solo se usa como tipo. **Única excepción:** clases inyectadas por NestJS, porque `design:paramtypes` necesita el import de valor (se documenta con un comentario y `eslint-disable-next-line` puntual).
- Retornos explícitos en funciones exportadas.
- `unknown` + narrowing en lugar de `any`; guardas de tipo para datos externos.
- Sin aserciones no-nulas (`!`) salvo invariante demostrable y comentada.

---

## 5. Backend (NestJS)

- Un módulo por dominio: `*.module.ts`, `*.controller.ts`, `*.service.ts` (+ `dto/` cuando haya entrada).
- El controlador **no** contiene lógica de negocio: delega en el servicio.
- Validación de entrada con `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`).
- Toda respuesta de error sale del `AllExceptionsFilter`; **prohibido** devolver `{ message }` suelto.
- Logs con `Logger` de Nest; prohibido `console.log`.
- Configuración solo a través de `loadEnv`; nunca `process.env.X` disperso (salvo la versión informativa del health).
- Endpoints documentados con decoradores de Swagger.

---

## 6. Frontend (Next.js 16)

- Server Components por defecto; `"use client"` solo cuando hay estado, efectos o eventos.
- Contenido de la landing tipado y separado en `features/landing/data/`; los componentes no inventan textos.
- Estilos con Tailwind y tokens del tema; sin CSS inline ni archivos CSS por componente.
- Componentes reutilizables en `components/ui`; los específicos de una feature, dentro de la feature.
- Accesibilidad mínima: un `h1` por página, jerarquía de encabezados correcta, `aria-label` en enlaces icónicos, foco visible.
- Sin `fetch` en el cliente para contenido indexable.

---

## 7. Pruebas

- Runner: **Vitest**. Componentes: Testing Library + `jsdom`.
- Nombres de prueba en español y en forma de comportamiento: `"falla si PORT no es un número válido"`.
- Estructura Arrange–Act–Assert, sin comentarios obvios.
- Consultas por rol/texto accesible (`getByRole`), no por clase CSS.
- Prohibidos los snapshots y las pruebas que dependen del orden de ejecución.
- La limpieza de Testing Library es explícita en `vitest.setup.ts`.
- Cada corrección de bug añade la prueba que lo habría detectado.

---

## 8. Comentarios

- Español, y solo cuando explican **por qué**, no qué.
- Se documenta toda decisión no evidente (p. ej. la excepción de DI de Nest o la validación http(s) de `WEB_ORIGIN`).
- Prohibido el código comentado.

---

## 9. Commits

```
<tipo>(<alcance>): <descripción en imperativo>

[cuerpo opcional: por qué]

Tarea: SX-TY
```

Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

- Un commit por tarea aprobada.
- Nunca se versionan `.env`, `dist/`, `.next/`, `node_modules/` ni logs.
- Si el cambio afecta documentación, va en el mismo commit.

---

## 10. Verificación obligatoria

| Comando | Alcance |
|---------|---------|
| `npm run typecheck` | todos los workspaces |
| `npm run lint` | todos los workspaces (`--max-warnings 0`) |
| `npm test` | todos los workspaces |
| `npm run build` | todos los workspaces |
| `npm run typecheck -w apps/api` | solo el workspace afectado, durante el desarrollo |

---

## Documentos relacionados

- [`roadmap-sprints.md`](roadmap-sprints.md)
- [`../05-orquestacion/plantilla-tarea.md`](../05-orquestacion/plantilla-tarea.md)
- [`../03-arquitectura/stack-tecnologico.md`](../03-arquitectura/stack-tecnologico.md)
- [`../03-arquitectura/contratos-api.md`](../03-arquitectura/contratos-api.md)
