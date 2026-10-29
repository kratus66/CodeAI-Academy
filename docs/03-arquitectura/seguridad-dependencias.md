# Seguridad de dependencias

> **Registro vivo.** Qué vulnerabilidades conoce el proyecto, cuáles se corrigieron, cuáles se aceptan con motivo y cuándo se revisan. Toda excepción (`overrides`, aviso aceptado) se documenta aquí el mismo día en que se aplica.

---

## 1. Cómo se audita

```bash
npm run audit        # npm audit completo (incluye devDependencies)
npm run audit:prod   # npm audit --omit=dev: lo que llega a producción
npm ls <paquete>     # comprobar que una versión forzada está aplicada de verdad
```

`npm run audit` termina con código distinto de 0 mientras queden avisos: **es esperado** y no bloquea `typecheck`, `lint`, `test` ni `build`. El criterio del proyecto es que un aviso no se arregla con `npm audit fix --force` (rompe versiones mayores sin ficha), sino con una tarea que declare el salto.

---

## 2. Estado final de S11 (2026-10-29)

| Medición | 2026-10-28 | 2026-10-29 | Nota |
|----------|-----------|-----------|------|
| Total (dev + prod) | 38 | **28** | 5 low · 10 moderate · 13 high · **0 critical** |
| Críticas | 3 | **0** | `next`, `vitest` y `tinypool` resueltos |
| Solo producción (`--omit=dev`) | 16 | **14** | 5 moderate · 9 high · **0 critical** |

La primera caída (111 → 38) vino del `override` de `dompurify` y de los parches compatibles del lockfile. La segunda (38 → 28, sin críticas) viene de S11-T12 y T13: `next` 14.2 → **16.4.3** y `vitest` 2 → **5.0.5** (con `vite` 8).

**S11-T12 — `next@16.4.3`.** Salto con React 18 → **19.3.1**, `@react-three/fiber` 8 → **9.8.2**, `@types/react(-dom)` 19 y `eslint` 8 → **9** (lo exige `eslint-config-next@16`). `next lint` ya no existe: el lint de la web es `eslint . --max-warnings 0` con `apps/web/eslint.config.mjs` (flat config). Lista de comprobación cumplida: `typecheck`, `lint`, `build` (22 rutas) y `next start` sirviendo `/`, `/login`, `/learn/insights` y `/instructor/cohort` con 200; no hay `next/image` remoto, Server Actions, `rewrites` ni middleware. Ajustes de código por React 19 y su regla `react-hooks/set-state-in-effect`: `useContentLoader` reinicia el estado al cambiar `load`/intento durante el render, y `InterviewReport` deja de copiar la sesión a estado desde un efecto (ya la derivaba en el render).

**S11-T13 — `vitest@5.0.5`.** Declarado también en el `package.json` raíz para que `@testing-library/jest-dom/vitest` (instalado en la raíz) resuelva `vitest`. `vitest.config.mts` pasa de `esbuild.jsx` a `oxc.jsx.runtime` (Vite 8 usa oxc). Pruebas: shared 255 · API 780 · web 256 = **1 291**, las mismas que antes de la actualización.

Si algún día hay que repetir la instalación desde cero: tras una instalación parcial, el lockfile conservó `react@18` en la raíz y las pruebas de la web fallaron con «Objects are not valid as a React child»; se resolvió borrando del lockfile las entradas `react`, `react-dom` y `scheduler` y reinstalando.

---

## 3. `dompurify` forzado a 3.4.17

**Qué pasaba.** `monaco-editor@0.57.0` (dependencia de `@monaco-editor/react`, que usa el laboratorio de código de S5) fija `dompurify@3.4.15`, versión con avisos críticos. `dompurify` sanea HTML en el navegador: es la dependencia que más expuesta está a un XSS si se queda atrás.

**Qué se hizo.** En el `package.json` raíz:

```json
"overrides": { "dompurify": "3.4.17" }
```

El `override` gana sobre la versión fijada por `monaco-editor`. La primera vez no se aplicó porque el árbol ya estaba instalado; se editó el lockfile a mano y, al reinstalar, `npm install` regeneró la entrada con su `resolved` e `integrity` reales.

**Cómo se verifica.**

```bash
npm ls dompurify
# └─┬ monaco-editor@0.57.0
#   └── dompurify@3.4.17      ← sin "invalid"
npm audit | Select-String dompurify   # no aparece
```

**Cuándo se retira.** Cuando `monaco-editor` publique una versión que dependa de `dompurify ≥ 3.4.17` (o superior sin avisos). Ese día se borra la entrada de `overrides` y se comprueba con `npm ls dompurify` que sigue limpio. Un `override` que ya no hace falta es deuda: oculta qué versión pide realmente el árbol.

---

## 4. Avisos que se aceptan (con motivo y fecha de revisión)

Ninguno de estos se queda «porque sí»: cada fila dice qué lo contiene hoy y en qué sprint se paga.

| Paquete | Severidad | Por qué se acepta | Mitigación vigente | Se paga en |
|---------|-----------|-------------------|--------------------|-----------|
| `@nestjs/platform-express` · `body-parser` · `multer` | high | Arreglo: `@nestjs/platform-express@12`, versión mayor de Nest. | `multer` no se usa (no hay subida de archivos); `body-parser` opera con el límite por defecto de 100 kB y la API no acepta cuerpos comprimidos de usuarios anónimos. | Cuando se planifique Nest 12 |
| `zod` < 4.6.6 | high | La versión del proyecto es 3.x; el arreglo es `zod@4`, que cambiaría todos los contratos de `shared`. | Los cuerpos pasan por `ZodValidationPipe` con `.strict()` y los esquemas acotan longitudes y colecciones; no se validan payloads arbitrarios de varios MB. | Migración de Zod, sin sprint asignado |
| `prisma` · `@prisma/config` · `deepmerge-ts` | high | Arreglo: `prisma@7.10.1`, versión mayor del ORM. Afecta sobre todo a la CLI, no al runtime de la API. | La CLI solo se ejecuta en local sobre `prisma/schema.prisma` del repo. | Sin sprint asignado: exige migrar el cliente a Prisma 7 (§8 de S11) |
| `js-yaml` · `lodash` (vía `@nestjs/swagger`) | high | Arreglo: `@nestjs/swagger@12`, versión mayor. | Swagger genera el documento en el arranque; nadie envía YAML ni plantillas a la API. | Cuando se planifique Nest 12 |

**Regla:** si aparece un aviso **crítico nuevo en una dependencia de producción**, se abre tarea antes de seguir con el sprint en curso. Los de desarrollo se acumulan en la tarea de actualización de S11.

---

## 5. Historial de revisiones

| Fecha | Acción | Resultado |
|-------|--------|-----------|
| 2026-10-28 | Primer `npm audit` completo (111 avisos, 12 críticas), `override` de `dompurify` y `npm install` | 38 avisos (3 críticas); `dompurify@3.4.17` aplicado y verificado con `npm ls` |
| 2026-10-28 | Scripts `audit` y `audit:prod` en la raíz | La medición deja de depender de recordar el comando |
| 2026-10-28 | Re-ejecución de `npm audit` y `npm audit --omit=dev` al cerrar la documentación | Confirmadas las cifras: 38 (5 low · 13 moderate · 17 high · 3 critical) y 16 en producción (5 moderate · 10 high · 1 critical: `next`) |
| 2026-10-29 | S11-T12 (`next@16.4.3`, React 19) y S11-T13 (`vitest@5`); `npm audit` al cierre | 28 (5 low · 10 moderate · 13 high · 0 critical) y 14 en producción (5 moderate · 9 high · 0 critical). Las filas de `next`, `vitest`/`tinypool` y `postcss`/`eslint-config-next` salen de §4 |

**Próxima revisión:** al abrir S11, antes de la tarea de despliegue.

---

## Documentos relacionados

- [`stack-tecnologico.md`](stack-tecnologico.md)
- [`../04-plan-ejecucion/roadmap-sprints.md`](../04-plan-ejecucion/roadmap-sprints.md)
- [`../07-flujo-operativo.md`](../07-flujo-operativo.md)
