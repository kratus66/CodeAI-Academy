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

## 2. Estado (2026-10-28)

| Medición | Antes | Después | Nota |
|----------|-------|---------|------|
| Total (dev + prod) | 111 | **38** | 5 low · 13 moderate · 17 high · 3 critical |
| Críticas | 12 | **3** | `next`, `vitest`, `tinypool` |
| Solo producción (`--omit=dev`) | — | **16** | 5 moderate · 10 high · 1 critical (`next`) |

La caída de 111 a 38 viene de dos cambios: el `override` de `dompurify` y la reinstalación (`npm install`) que aplicó los parches compatibles que el lockfile tenía pendientes (`qs` 6.14.2 → 6.14.3 y su árbol). No se actualizó ninguna versión mayor.

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
| `next` 14.2.35 | **critical** | El arreglo es `next@16.4.3`: cambio de versión mayor con React 19 y App Router nuevos. Un salto así no cabe en un cierre documental. | No hay `next/image` remoto configurado ni Server Actions en el repo; no se usan `rewrites` ni middleware con i18n. La web se sirve en local. | S11-T12 |
| `vitest` ≤ 4.1.10 · `tinypool` ≤ 2.1.1 | **critical** | Afectan a la UI del runner y a `@vitest/mocker`. Arreglo: `vitest@5`. Solo existen en desarrollo. | Las pruebas corren en local/CI sobre código propio; no se levanta `vitest --ui` ni se abren puertos. | S11-T13, junto con `vite` |
| `@nestjs/platform-express` · `body-parser` · `multer` | high | Arreglo: `@nestjs/platform-express@12`, versión mayor de Nest. | `multer` no se usa (no hay subida de archivos); `body-parser` opera con el límite por defecto de 100 kB y la API no acepta cuerpos comprimidos de usuarios anónimos. | Cuando se planifique Nest 12 |
| `zod` < 4.6.6 | high | La versión del proyecto es 3.x; el arreglo es `zod@4`, que cambiaría todos los contratos de `shared`. | Los cuerpos pasan por `ZodValidationPipe` con `.strict()` y los esquemas acotan longitudes y colecciones; no se validan payloads arbitrarios de varios MB. | Migración de Zod, sin sprint asignado |
| `prisma` · `@prisma/config` · `deepmerge-ts` | high | Arreglo: `prisma@7.10.1`, versión mayor del ORM. Afecta sobre todo a la CLI, no al runtime de la API. | La CLI solo se ejecuta en local sobre `prisma/schema.prisma` del repo. | Sin sprint asignado: exige migrar el cliente a Prisma 7 (§8 de S11) |
| `js-yaml` · `lodash` (vía `@nestjs/swagger`) | high | Arreglo: `@nestjs/swagger@12`, versión mayor. | Swagger genera el documento en el arranque; nadie envía YAML ni plantillas a la API. | Cuando se planifique Nest 12 |
| `postcss` ≤ 8.5.22 · `@next/eslint-plugin-next` · `eslint-config-next` | high | Se resuelven con el salto a `next@16`. | Se ejecutan en el build local; no procesan CSS de terceros. | S11-T12 (llega con `next@16`) |

**Regla:** si aparece un aviso **crítico nuevo en una dependencia de producción**, se abre tarea antes de seguir con el sprint en curso. Los de desarrollo se acumulan en la tarea de actualización de S11.

---

## 5. Historial de revisiones

| Fecha | Acción | Resultado |
|-------|--------|-----------|
| 2026-10-28 | Primer `npm audit` completo (111 avisos, 12 críticas), `override` de `dompurify` y `npm install` | 38 avisos (3 críticas); `dompurify@3.4.17` aplicado y verificado con `npm ls` |
| 2026-10-28 | Scripts `audit` y `audit:prod` en la raíz | La medición deja de depender de recordar el comando |
| 2026-10-28 | Re-ejecución de `npm audit` y `npm audit --omit=dev` al cerrar la documentación | Confirmadas las cifras: 38 (5 low · 13 moderate · 17 high · 3 critical) y 16 en producción (5 moderate · 10 high · 1 critical: `next`) |

**Próxima revisión:** al abrir S11, antes de la tarea de despliegue.

---

## Documentos relacionados

- [`stack-tecnologico.md`](stack-tecnologico.md)
- [`../04-plan-ejecucion/roadmap-sprints.md`](../04-plan-ejecucion/roadmap-sprints.md)
- [`../07-flujo-operativo.md`](../07-flujo-operativo.md)
