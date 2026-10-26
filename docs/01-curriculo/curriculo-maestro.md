# Currículo maestro de CodeAI Academy

> **Fuente de verdad del contenido educativo.** Define módulos, unidades, competencias, prerequisitos, horas estimadas y criterios de dominio.
> Cualquier lección, ejercicio o evaluación debe poder rastrearse hasta una entrada de este documento.

---

## 1. Estructura de la ruta

12 etapas organizadas en 4 niveles progresivos, con especialización en **desarrollo web full-stack** y una línea avanzada de **ingeniería de IA**.

| Nivel | Nombre | Etapas | Foco |
|-------|--------|--------|------|
| **1** | Fundamentos | 0–3 | Entorno, lógica, programación y Git |
| **2** | Ingeniería de software | 4–7 | Web, backend, datos, pruebas y arquitectura |
| **3** | Desarrollo con IA | 8–10 | Asistentes, modelos, RAG, agentes y evaluación |
| **4** | Profesionalización | 11 | Proyecto final, portafolio y entrevistas |

**La duración no es una barrera artificial.** El estudiante avanza cuando demuestra dominio suficiente, no porque haya terminado de ver los videos.

---

## 2. Mapa general

```
NIVEL 1 · FUNDAMENTOS
  E0  Diagnóstico y entorno            [15–25 h]
  E1  Lógica y resolución de problemas [70–100 h]
  E2  JavaScript y TypeScript          [100–140 h]
  E3  Git, GitHub y trabajo profesional[20–30 h]
        │
NIVEL 2 · INGENIERÍA DE SOFTWARE
  E4  Frontend profesional             [80–120 h]
  E5  Backend y diseño de APIs         [80–120 h]
  E6  Bases de datos y persistencia    [40–60 h]
  E7  Ingeniería, calidad y despliegue [70–100 h]
        │
NIVEL 3 · DESARROLLO CON IA
  E8  Fundamentos de IA y desarrollo asistido   [40–60 h]
  E9  Ingeniería de aplicaciones con modelos IA [70–110 h]
  E10 Agentes, automatización y sistemas avanzados [40–70 h]
        │
NIVEL 4 · PROFESIONALIZACIÓN
  E11 Preparación laboral y proyecto integrador [60–100 h]

TOTAL ORIENTATIVO: 685–1.035 horas
```

### Nota sobre las horas

Las cifras son **estimaciones de planificación**, no resultados de un estudio que garantice una duración concreta. Tampoco incluyen toda la práctica adicional requerida para una especialización avanzada. A 10 h/semana representan aproximadamente entre 16 y 24 meses.

---

## 3. Grafo de prerequisitos

Un estudiante solo puede iniciar una etapa si cumple sus prerequisitos **certificados** (no solo cursados).

```
E0 ──► E1 ──► E2 ──► E3
                     │
                     ▼
                    E4 ──► E5 ──► E6 ──► E7
                                          │
                                          ▼
                                         E8 ──► E9 ──► E10
                                                          │
                                                          ▼
                                                         E11
```

**Excepciones controladas:**
- **E3 puede cursarse en paralelo con E1–E2** desde la semana 3 (el estudiante ya tiene código que versionar).
- **E6 puede iniciarse al 60 % de E5** si el estudiante domina el modelo de datos básico.
- **E10 requiere E7 completo**: no se automatizan agentes sin pruebas, APIs y bases de datos sólidas.

Reglas detalladas de desbloqueo en [`prerequisitos-y-progreso.md`](prerequisitos-y-progreso.md).

---

## 4. Convenciones de esta especificación

Cada etapa define:

| Campo | Significado |
|-------|-------------|
| **Objetivo** | Capacidad observable al terminar la etapa |
| **Competencias** | Códigos C1–C14 que se trabajan (ver [`mapa-competencias.md`](mapa-competencias.md)) |
| **Módulos** | Agrupaciones temáticas; cada módulo genera lecciones |
| **Unidades** | Subdivisión de un módulo; la unidad es la granularidad de progreso |
| **Ejercicios clave** | Tipos y ejemplos del banco de ejercicios |
| **Entregable** | Evidencia obligatoria de la etapa |
| **Criterio de dominio** | Qué debe demostrarse para desbloquear la siguiente etapa |
| **Horas** | Rango estimado |

Los **tipos de ejercicio** (lab, quiz, memory, flashcard, debug, reto cronometrado, simulación) se definen en [`../02-contenido/banco-ejercicios.md`](../02-contenido/banco-ejercicios.md).

---

# NIVEL 1 · FUNDAMENTOS

## Etapa 0 — Diagnóstico y preparación del entorno

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Configurar un entorno de desarrollo funcional y determinar el punto de partida real del estudiante |
| **Competencias** | C1 (base) |
| **Horas** | 15–25 |

### Módulos

**M0.1 — Cómo funciona el software y los equipos técnicos**
- U0.1.1 Qué es desarrollar software: del requisito al despliegue
- U0.1.2 Roles en un equipo: frontend, backend, datos, QA, infraestructura, IA
- U0.1.3 Cómo se organiza un proyecto real: repos, tableros, revisiones

**M0.2 — Herramientas del oficio**
- U0.2.1 Sistema de archivos, terminal y rutas
- U0.2.2 Editor de código: atajos, extensiones mínimas, depurador
- U0.2.3 Navegador como herramienta de desarrollo: DevTools
- U0.2.4 Instalación de Node.js, Git y gestor de paquetes
- U0.2.5 Verificación del entorno (checklist automatizado)

**M0.3 — Qué puede y qué no puede hacer un modelo de IA**
- U0.3.1 Generación probabilística: por qué a veces inventa
- U0.3.2 Conocimiento desactualizado y límites de contexto
- U0.3.3 Cuándo la IA acelera y cuándo introduce deuda

**M0.4 — Método de estudio e investigación**
- U0.4.1 Cómo leer documentación oficial
- U0.4.2 Cómo investigar un error (leer el mensaje, aislar, reproducir)
- U0.4.3 Organización de tareas y registro de avances

### Ejercicios clave
1. Identificar las partes de una aplicación web en un caso real (quiz visual).
2. Instalar editor, Git y runtime; verificar con script (lab de entorno).
3. Crear una carpeta de proyecto y ejecutarla desde terminal (lab guiado).
4. Pedir a una IA que explique un error y **verificar la explicación** con fuentes (ejercicio de auditoría).
5. **Prueba diagnóstica sin ayuda** con 40 ítems que cubren lógica, JS, web y datos (evaluación inicial).
6. Memory: emparejar herramientas con su función (juego de memoria).

### Entregable
Entorno funcional verificado + **plan individual de aprendizaje** generado a partir del diagnóstico.

### Criterio de dominio
- Checklist de entorno al 100 %.
- Diagnóstico completado sin asistencia (mide línea base, no aprueba ni reprueba).

---

## Etapa 1 — Lógica de programación y resolución de problemas

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Pensar como programador antes de depender de la generación automática de código |
| **Competencias** | C1 |
| **Horas** | 70–100 |

### Módulos

**M1.1 — Fundamentos del pensamiento computacional**
- U1.1.1 Algoritmos y pseudocódigo
- U1.1.2 Diagramas de flujo
- U1.1.3 Descomposición de problemas
- U1.1.4 Casos límite y análisis de errores

**M1.2 — Datos y operaciones**
- U1.2.1 Variables y tipos de datos
- U1.2.2 Operadores y expresiones
- U1.2.3 Conversión y comparación de tipos
- U1.2.4 Arreglos, objetos, mapas y conjuntos

**M1.3 — Control de flujo**
- U1.3.1 Condicionales
- U1.3.2 Ciclos y casos de terminación
- U1.3.3 Condiciones compuestas y tablas de verdad

**M1.4 — Funciones y abstracción**
- U1.4.1 Funciones, parámetros y retornos
- U1.4.2 Alcance (scope)
- U1.4.3 Composición de funciones
- U1.4.4 Funciones puras y efectos secundarios

**M1.5 — Eficiencia básica**
- U1.5.1 Conteo de operaciones
- U1.5.2 Complejidad temporal intuitiva O(n), O(n²), O(log n)
- U1.5.3 Comparar dos soluciones al mismo problema

### Ejercicios clave
1. Calculadora de tarifas con reglas de negocio (lab guiado).
2. Clasificar registros según reglas (lab).
3. Encontrar duplicados en una lista (3 enfoques con distinta complejidad).
4. Validar identificadores y datos de entrada (lab con casos límite).
5. Resolver un problema con ciclos y luego con funciones (refactor guiado).
6. **Corregir programas con errores intencionales** (debug: 12 casos).
7. Explicar un algoritmo línea por línea (elaboración escrita).
8. Un mismo problema con dos estrategias: comparar ventajas (análisis escrito).
9. Memory de operadores y precedencia.
10. Flashcard de patrones algorítmicos.

### Regla pedagógica de la etapa
> Los primeros problemas se resuelven **sin IA**. Después se repite una selección **con asistencia de IA** para comparar comprensión, velocidad, calidad y errores.

### Proyecto
**Sistema de gestión de tareas en consola**: alta, baja, modificación, listado, filtros y persistencia en archivo. Sin frameworks, sin IA.

### Criterio de dominio
- Nivel 3 en C1: resolver un problema **nuevo** sin pistas, con casos límite propios.
- ≥ 80 % en la evaluación de lógica.

---

## Etapa 2 — JavaScript y TypeScript en profundidad

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Dominar el lenguaje de la ruta principal (JS + TS) con criterio de tipos |
| **Competencias** | C1 |
| **Horas** | 100–140 |

### Módulos

**M2.1 — Núcleo de JavaScript**
- U2.1.1 Sintaxis, tipos primitivos y coerción
- U2.1.2 Funciones, closures y `this`
- U2.1.3 Objetos, prototipos y clases
- U2.1.4 Destructuración, spread y módulos
- U2.1.5 Gestión de paquetes (npm) y estructura de proyecto

**M2.2 — Datos y funciones de orden superior**
- U2.2.1 `map`, `filter`, `reduce`, `sort`
- U2.2.2 Inmutabilidad
- U2.2.3 Composición y currying
- U2.2.4 Tratamiento de errores (`try/catch`, errores personalizados)

**M2.3 — Asincronía**
- U2.3.1 Callbacks y el infierno anidado
- U2.3.2 Promesas: estados, encadenamiento y errores
- U2.3.3 `async/await`
- U2.3.4 Event loop: stack, microtasks, macrotasks
- U2.3.5 Concurrencia: `Promise.all`, `allSettled`, `race`

**M2.4 — TypeScript**
- U2.4.1 Tipos, interfaces y alias
- U2.4.2 Uniones, intersecciones y literales
- U2.4.3 Narrowing y type guards
- U2.4.4 Genéricos
- U2.4.5 Utilidades de tipos (`Partial`, `Pick`, `Omit`, `Record`)
- U2.4.6 Diseño de contratos y tipos de dominio

### Ejercicios clave
1. Transformar datos de una API (lab).
2. Construir un validador de formularios (lab progresivo).
3. Escribir funciones puras y probarlas (lab + tests).
4. Predecir orden de ejecución asíncrona (quiz de event loop, 10 casos).
5. Corregir tipos inseguros en un proyecto dado (lab de `any` → tipos).
6. Refactorizar una función de 120 líneas (lab de refactor).
7. Crear una pequeña biblioteca reutilizable (proyecto menor).
8. Comparar código generado por IA con código verificado manualmente (auditoría).
9. Animación interactiva del event loop (recurso visual + quiz asociado).
10. Memory de métodos de array y su comportamiento.

### Proyecto
**Biblioteca TypeScript** para calcular tarifas, validar entradas y generar reportes, con tests unitarios.

### Criterio de dominio
- Nivel 3 en asincronía y en TypeScript.
- ≥ 80 % en evaluación de la etapa.

---

## Etapa 3 — Git, GitHub y trabajo profesional

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Versionar, colaborar y proteger credenciales como en un equipo real |
| **Competencias** | C5, C9 |
| **Horas** | 20–30 |

### Módulos

**M3.1 — Fundamentos de Git**
- U3.1.1 Repositorios, commits y el modelo de tres áreas
- U3.1.2 Ramas, etiquetas y `HEAD`
- U3.1.3 `clone`, `add`, `commit`, `push`, `pull`, `merge`

**M3.2 — Colaboración**
- U3.2.1 Resolución de conflictos
- U3.2.2 Pull requests y revisión de código
- U3.2.3 Convenciones de commits
- U3.2.4 Issues, tableros y planificación

**M3.3 — Documentación y seguridad del repositorio**
- U3.3.1 README efectivo
- U3.3.2 Documentación de decisiones (ADR)
- U3.3.3 Secretos, `.env` y `.gitignore`
- U3.3.4 Uso responsable de asistentes en repositorios

### Ejercicios clave
1. Resolver un conflicto real entre dos ramas (lab simulado interactivo).
2. Revisar código generado por otro desarrollador (revisión guiada con checklist).
3. Crear un pull request con pruebas (lab).
4. Recuperar un cambio incorrecto (`revert`, `reset`, `reflog`) (lab de rescate).
5. Escribir un buen mensaje de commit y justificarlo (elaboración).
6. **Identificar secretos expuestos** en un repositorio de práctica (ejercicio de seguridad).
7. Memory de comandos Git ↔ efecto.
8. Reto cronometrado: reconstruir un historial limpio desde un log desordenado.

### Proyecto
Repositorio colaborativo con historial claro, documentación, revisión de cambios y pipeline mínimo.

### Criterio de dominio
- Nivel 3 en C5: resolver un conflicto y recuperar un error sin ayuda.
- Historial del proyecto sin commits basura.

---

# NIVEL 2 · INGENIERÍA DE SOFTWARE

## Etapa 4 — Desarrollo frontend profesional

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Construir interfaces funcionales, accesibles y mantenibles |
| **Competencias** | C4 |
| **Horas** | 80–120 |

### Módulos

**M4.1 — Fundamentos de la web**
- U4.1.1 HTML semántico y formularios
- U4.1.2 CSS: modelo de cajas, especificidad
- U4.1.3 Flexbox y Grid
- U4.1.4 Diseño adaptable y unidades relativas
- U4.1.5 Accesibilidad: ARIA, foco, contraste, teclado
- U4.1.6 DOM y eventos con JavaScript

**M4.2 — Comunicación con servicios**
- U4.2.1 HTTP: métodos, cabeceras, códigos de estado
- U4.2.2 JSON y serialización
- U4.2.3 Consumo de APIs, estados de carga y error
- U4.2.4 CORS y cookies

**M4.3 — React con TypeScript**
- U4.3.1 Componentes, propiedades y composición
- U4.3.2 Estado y flujo de datos
- U4.3.3 Hooks: `useState`, `useEffect`, `useMemo`, `useCallback`, custom hooks
- U4.3.4 Formularios controlados y validación
- U4.3.5 Enrutamiento y organización por funcionalidades
- U4.3.6 Gestión del estado global
- U4.3.7 Server state vs client state
- U4.3.8 Pruebas de componentes

**M4.4 — Calidad en la interfaz**
- U4.4.1 Rendimiento: renders innecesarios, memoización, code splitting
- U4.4.2 Patrones de interfaz y sistema de diseño
- U4.4.3 Manejo de errores en UI (error boundaries)

### Ejercicios clave
1. Convertir un diseño visual dado en una interfaz (lab de maquetación con captura comparativa).
2. Tabla con búsqueda, filtros y paginación (lab progresivo, 4 niveles de pista).
3. Formulario con validación completa (lab + tests).
4. Consumir una API y manejar carga/error/vacío (lab).
5. **Corregir problemas de accesibilidad** en una pantalla dada (auditoría guiada, detección con lector de pantalla simulado).
6. Detectar renders innecesarios (lab con React Profiler).
7. Pedir a la IA una interfaz y realizar revisión técnica de su resultado (auditoría).
8. Memory de elementos HTML semánticos ↔ propósito.
9. Quiz visual: identificar el bug de layout por la captura.

### Proyecto
**Dashboard administrativo adaptable** con autenticación simulada, tablas, formularios y métricas.

### Criterio de dominio
- Nivel 3 en C4 (parte cliente).
- Accesibilidad: sin violaciones críticas en auditoría automatizada.

---

## Etapa 5 — Backend y diseño de APIs

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Construir servicios confiables que puedan utilizar clientes web y sistemas externos |
| **Competencias** | C4 |
| **Horas** | 80–120 |

### Módulos

**M5.1 — Node.js y NestJS**
- U5.1.1 Modelo de ejecución de Node y módulos
- U5.1.2 Estructura de NestJS: módulos, controladores, proveedores
- U5.1.3 Inyección de dependencias
- U5.1.4 DTO, validación con `class-validator` y pipes
- U5.1.5 Manejo centralizado de errores (filtros)

**M5.2 — Diseño de API REST**
- U5.2.1 Recursos, rutas y verbos
- U5.2.2 Códigos de estado correctos
- U5.2.3 Versionado y compatibilidad
- U5.2.4 Paginación, filtros y ordenamiento
- U5.2.5 Idempotencia y límites de solicitudes (rate limiting)
- U5.2.6 Documentación con Swagger/OpenAPI

**M5.3 — Identidad y permisos**
- U5.3.1 Autenticación: sesiones, JWT y refresh tokens
- U5.3.2 Hashing de contraseñas
- U5.3.3 Autorización por roles y por recurso
- U5.3.4 Protección de rutas y guards

**M5.4 — Operación del servicio**
- U5.4.1 Configuración y variables de entorno
- U5.4.2 Logging estructurado
- U5.4.3 Tareas asíncronas, colas y notificaciones
- U5.4.4 Arquitectura por capas y separación de responsabilidades

### Ejercicios clave
1. Diseñar una API CRUD desde requisitos escritos (lab de diseño).
2. Validar datos y devolver errores coherentes (lab + tests de contrato).
3. Implementar permisos por rol (lab).
4. Proteger rutas y verificar con pruebas (lab).
5. Documentar endpoints con Swagger (lab).
6. **Corregir un problema de inyección de dependencias** (debug).
7. Investigar una API lenta usando logs y pruebas (lab de diagnóstico).
8. Memory de códigos de estado HTTP ↔ significado.
9. Reto cronometrado: diseñar 5 endpoints para un caso de negocio nuevo.

### Proyecto
**API para gestionar usuarios, tareas, roles y auditoría** con Swagger y pruebas.

### Criterio de dominio
- Nivel 3 en C4 (parte servidor).
- API documentada y con errores consistentes.

---

## Etapa 6 — Bases de datos y persistencia

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Modelar información y garantizar que las aplicaciones manejen los datos correctamente |
| **Competencias** | C4 |
| **Horas** | 40–60 |

### Módulos

**M6.1 — Modelado**
- U6.1.1 Modelo entidad-relación
- U6.1.2 Claves primarias y foráneas
- U6.1.3 Relaciones 1:1, 1:N, N:M
- U6.1.4 Restricciones e integridad referencial
- U6.1.5 Normalización y cuándo desnormalizar

**M6.2 — SQL y PostgreSQL**
- U6.2.1 DDL, DML y tipos de datos
- U6.2.2 `JOIN`, agregaciones y subconsultas
- U6.2.3 Índices y planes de ejecución
- U6.2.4 Paginación eficiente
- U6.2.5 Transacciones y propiedades ACID
- U6.2.6 Bloqueos y concurrencia

**M6.3 — Persistencia en la aplicación**
- U6.3.1 ORM (Prisma) y mapeo objeto-relacional
- U6.3.2 Migraciones y versionado del esquema
- U6.3.3 Repositorios y separación de capas
- U6.3.4 Transacciones desde el código

**M6.4 — Operación y seguridad de datos**
- U6.4.1 Copias de seguridad y recuperación
- U6.4.2 Permisos de base de datos
- U6.4.3 Prevención de inyección SQL
- U6.4.4 Datos sensibles y minimización

### Ejercicios clave
1. Diseñar una base de datos desde requisitos escritos (lab de modelado con diagrama).
2. Escribir 10 consultas con distintos `JOIN` (lab progresivo).
3. Detectar y corregir duplicados (lab de limpieza de datos).
4. Resolver una actualización que debe ser atómica (lab de transacciones, caso de concurrencia).
5. Analizar una consulta lenta con `EXPLAIN` (lab de rendimiento).
6. Generar datos de prueba a escala (lab con script).
7. **Revisar el modelo sugerido por una IA y encontrar sus deficiencias** (auditoría).
8. Memory de tipos de `JOIN` ↔ resultado.
9. Reto cronometrado: normalizar una tabla mal diseñada.

### Proyecto
**Persistencia completa** de la aplicación administrativa de las etapas anteriores (migraciones, relaciones, transacciones).

### Criterio de dominio
- Modelo sin anomalías de actualización/borrado.
- Consultas eficientes verificadas con plan de ejecución.

---

## Etapa 7 — Ingeniería de software, calidad y despliegue

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Evitar un perfil que produce prototipos pero no mantiene software real |
| **Competencias** | C5, C8, C9 |
| **Horas** | 70–100 |

### Módulos

**M7.1 — Diseño de software**
- U7.1.1 Principios SOLID y cohesión
- U7.1.2 Refactorización y deuda técnica
- U7.1.3 Patrones de diseño apropiados al problema
- U7.1.4 Arquitectura por capas y límites de módulos

**M7.2 — Pruebas**
- U7.2.1 Unitarias: qué probar y qué no
- U7.2.2 Integración
- U7.2.3 Extremo a extremo
- U7.2.4 Pruebas de API y contratos
- U7.2.5 Dobles de prueba (mocks, stubs, fakes)
- U7.2.6 Cobertura: qué mide y qué no

**M7.3 — Seguridad**
- U7.3.1 Validación de entradas y salidas
- U7.3.2 OWASP Top 10 aplicado
- U7.3.3 XSS, CSRF, SSRF e inyección
- U7.3.4 Gestión de dependencias vulnerables
- U7.3.5 Cabeceras de seguridad y HTTPS

**M7.4 — Entrega y operación**
- U7.4.1 Docker y contenedores
- U7.4.2 Integración continua y entrega continua
- U7.4.3 Despliegue en la nube
- U7.4.4 Almacenamiento de archivos y configuración segura
- U7.4.5 Observabilidad: métricas, logs, trazas, alertas
- U7.4.6 Rendimiento, disponibilidad y recuperación ante fallos

### Ejercicios clave
1. Crear pruebas para una funcionalidad existente (lab).
2. **Encontrar un defecto con una prueba que inicialmente falla** (TDD invertido).
3. Corregir una vulnerabilidad en una aplicación de práctica (lab de seguridad).
4. Dockerizar frontend y backend (lab).
5. Automatizar pruebas en un pipeline (lab de CI).
6. Diagnosticar un despliegue fallido (simulación con logs).
7. Analizar logs de un error de producción simulado (lab de observabilidad).
8. Memory de patrones de diseño ↔ problema que resuelven.
9. Quiz de código: identificar violación de SOLID.
10. Reto cronometrado: escribir 5 tests para un bug report.

### Proyecto
**Desplegar la aplicación full-stack** con pruebas automatizadas, base de datos persistente y documentación de despliegue.

### Criterio de dominio
- Pipeline verde y reproducible desde cero.
- Vulnerabilidades críticas resueltas y documentadas.

---

# NIVEL 3 · DESARROLLO CON IA

## Etapa 8 — Fundamentos de IA y desarrollo asistido

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Usar IA como par de ingeniería, no como oráculo; verificar siempre el resultado |
| **Competencias** | C2, C3, C7 |
| **Horas** | 40–60 |

### Módulos

**M8.1 — Cómo funcionan los modelos**
- U8.1.1 Tokens, ventana de contexto y generación probabilística
- U8.1.2 Modelos de chat, de razonamiento y de código
- U8.1.3 Limitaciones: alucinación, conocimiento desactualizado, sesgo
- U8.1.4 Por qué "funciona en el ejemplo" no implica corrección

**M8.2 — Ingeniería de prompts**
- U8.2.1 Anatomía de una instrucción eficaz
- U8.2.2 Especificar requisitos, restricciones y criterios de aceptación
- U8.2.3 Ejemplos de referencia (few-shot) y formatos estructurados
- U8.2.4 Iteración y comparación de resultados

**M8.3 — Diseño de contexto**
- U8.3.1 Qué contexto aportar: repositorio, convenciones, documentación
- U8.3.2 Archivos de instrucciones para agentes
- U8.3.3 Delimitar el alcance: tareas pequeñas y verificables
- U8.3.4 Cuándo NO usar IA

**M8.4 — Asistentes en el flujo real**
- U8.4.1 Asistentes dentro del editor
- U8.4.2 Agentes de programación: planificar, implementar, revisar
- U8.4.3 Verificación independiente del código generado
- U8.4.4 Privacidad, propiedad intelectual y seguridad

### Ejercicios clave
1. Mejorar un prompt ambiguo y comparar resultados (auditoría comparada, 3 iteraciones).
2. Pedir a una IA que explique un repositorio antes de modificarlo (lab de comprensión).
3. **Detectar una solución aparentemente correcta que no satisface los requisitos** (caza de bugs: 6 casos).
4. Generar pruebas a partir de criterios de aceptación (lab).
5. Revisar una modificación y comprobar si introduce regresiones (lab).
6. Comparar estrategias de contexto (auditoría).
7. Dividir una tarea grande en cambios pequeños y verificables (ejercicio de planificación).
8. Documentar qué delegar y qué supervisar (elaboración).
9. Memory: capacidades ↔ limitaciones de los modelos.
10. Reto cronometrado: auditar un PR generado por IA en 15 minutos.

### Proyecto
Construir **una funcionalidad completa** con IA, incluyendo especificación, pruebas, revisión y registro de decisiones.

### Criterio de dominio
- Nivel 3 en C2 y C3: detectar al menos 5 de 6 respuestas incorrectas del modelo.
- Registro de decisiones que explique qué se delegó y cómo se verificó.

---

## Etapa 9 — Ingeniería de aplicaciones con modelos de IA

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Desarrollar productos que integren modelos de lenguaje mediante APIs |
| **Competencias** | C3, C6, C11, C14 |
| **Horas** | 70–110 |

### Módulos

**M9.1 — Integración de modelos**
- U9.1.1 Consumo de APIs de modelos
- U9.1.2 Autenticación, límites, errores y reintentos
- U9.1.3 Streaming de respuestas
- U9.1.4 Capa de abstracción de proveedor y selección de modelo

**M9.2 — Salidas confiables**
- U9.2.1 Prompts para producción
- U9.2.2 Salidas estructuradas y validación con esquemas (Zod)
- U9.2.3 Llamadas a herramientas y funciones
- U9.2.4 Gestión de contexto e historial

**M9.3 — Recuperación de información**
- U9.3.1 Embeddings y búsqueda semántica
- U9.3.2 RAG: arquitectura de recuperación aumentada
- U9.3.3 Chunking, recuperación, ranking y citas
- U9.3.4 Evaluación de la recuperación

**M9.4 — Evaluación, seguridad y costos**
- U9.4.1 Conjuntos de evaluación y preguntas de referencia
- U9.4.2 Métricas: exactitud, fidelidad a fuentes, tasa de rechazo
- U9.4.3 Inyección de prompts y fuga de datos
- U9.4.4 Costos, latencia y observabilidad

### Ejercicios clave
1. Integrar un modelo en una API NestJS (lab).
2. Convertir texto libre en datos validados (lab con Zod).
3. Crear un asistente que consulte documentos autorizados (lab progresivo).
4. Comparar resultados con un conjunto de preguntas de referencia (evaluación).
5. **Detectar respuestas no respaldadas por las fuentes** (lab de fidelidad).
6. Diseñar límites de costo y manejo de fallos (lab de diseño).
7. Medir precisión de recuperación antes y después de cambiar la estrategia (informe).
8. Memory de conceptos de RAG ↔ función en el pipeline.
9. Reto cronometrado: mitigar un ataque de inyección de prompt documentado.

### Proyecto
**Asistente de soporte** que consulta documentación y responde con referencias verificables.

### Criterio de dominio
- Nivel 3 en C6: flujo con esquema validado y manejo de fallos.
- Métricas de recuperación documentadas antes/después.

---

## Etapa 10 — Agentes, automatización y sistemas avanzados

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Diseñar sistemas autónomos limitados, trazables y seguros |
| **Competencias** | C7, C12, C13, C14 |
| **Horas** | 40–70 |
| **Prerequisito estricto** | Etapa 7 completa (pruebas, APIs y datos) |

### Módulos

**M10.1 — De chatbot a agente**
- U10.1.1 Chatbot, flujo automatizado y agente: diferencias reales
- U10.1.2 Cuándo NO usar un agente (preferir determinismo)
- U10.1.3 Uso de herramientas por modelos
- U10.1.4 Ciclos de decisión y ejecución

**M10.2 — Estado y orquestación**
- U10.2.1 Estado, memoria y persistencia
- U10.2.2 Planificación y descomposición de tareas
- U10.2.3 Orquestación de varios pasos
- U10.2.4 MCP y mecanismos de integración de herramientas

**M10.3 — Seguridad y control**
- U10.3.1 Permisos, aislamiento y aprobación humana
- U10.3.2 Protección contra acciones no autorizadas
- U10.3.3 Límites de ejecución y presupuesto
- U10.3.4 Trazabilidad de decisiones

**M10.4 — Fiabilidad y evaluación**
- U10.4.1 Fallos parciales, reintentos e idempotencia
- U10.4.2 Evaluación de agentes con casos repetibles
- U10.4.3 Observabilidad de agentes
- U10.4.4 Costos por ejecución

### Ejercicios clave
1. Crear un flujo que consulte datos y genere un informe (lab).
2. Validar argumentos antes de ejecutar una herramienta (lab).
3. Diseñar una aprobación humana para acciones sensibles (lab de diseño).
4. Simular fallos de una herramienta y verificar la recuperación (lab de resiliencia).
5. **Comparar un agente con una solución determinista** y justificar la elección (elaboración).
6. Evaluar resultados con casos de prueba repetibles (informe).
7. Memory de herramientas ↔ riesgo asociado.
8. Reto cronometrado: bloquear una acción no autorizada en un agente dado.

### Proyecto
**Agente de asistencia operativa** con herramientas limitadas, registros de ejecución, validaciones y supervisión humana.

### Criterio de dominio
- Nivel 3 en C12: agente con permisos explícitos y trazas completas.
- Ninguna acción destructiva sin aprobación registrada.

---

# NIVEL 4 · PROFESIONALIZACIÓN

## Etapa 11 — Preparación laboral y proyecto integrador

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Convertir las competencias en empleabilidad demostrable |
| **Competencias** | C10, C9 |
| **Horas** | 60–100 |

### Módulos

**M11.1 — Fundamentos técnicos de entrevista**
- U11.1.1 Estructuras de datos y algoritmos esenciales
- U11.1.2 Ejercicios cronometrados
- U11.1.3 Diseño de sistemas a nivel junior e intermedio
- U11.1.4 Depuración en vivo

**M11.2 — Preguntas por tecnología**
- U11.2.1 JavaScript y TypeScript
- U11.2.2 React y frontend
- U11.2.3 Node y APIs
- U11.2.4 SQL y modelado
- U11.2.5 IA aplicada, RAG y agentes

**M11.3 — Comunicación profesional**
- U11.3.1 Análisis de vacantes y perfiles
- U11.3.2 Comunicación técnica en español e inglés
- U11.3.3 Presentación de proyectos y trade-offs
- U11.3.4 Revisión de código en vivo

**M11.4 — Portafolio y búsqueda**
- U11.4.1 CV técnico
- U11.4.2 Repositorio y portafolio
- U11.4.3 Simulación de entrevistas y retroalimentación

### Ejercicios clave
1. Simulaciones de entrevista completas con rúbrica (mínimo 5).
2. Entrevistas en inglés (mínimo 2).
3. Retos cronometrados de algoritmos (banco de 30).
4. Ejercicio de depuración en vivo con observador.
5. Revisión de código de otro estudiante con checklist.
6. Análisis de 10 vacantes reales y mapa de brechas.
7. Ensayo de defensa de arquitectura ante preguntas hostiles.
8. Simulación de "explica qué generó la IA y cómo lo verificaste".

### Proyecto final
**Aplicación full-stack con funcionalidad de IA**, autenticación, base de datos, pruebas, documentación y despliegue.

**Defensa obligatoria:** el estudiante debe defender su arquitectura, demostrar pruebas, corregir un error en vivo y explicar qué partes generó la IA y cómo verificó que fueran correctas.

### Criterio de dominio
- Nivel 4 en C10.
- Portafolio con las 7 evidencias mínimas (ver [`../00-vision/perfil-profesional.md`](../00-vision/perfil-profesional.md#7-evidencias-mínimas-del-portafolio-de-egreso)).

---

# Resumen de horas

| Etapa | Horas estimadas |
|-------|-----------------|
| Diagnóstico y entorno | 15–25 |
| Lógica y resolución de problemas | 70–100 |
| JavaScript y TypeScript | 100–140 |
| Git y colaboración | 20–30 |
| Frontend | 80–120 |
| Backend y APIs | 80–120 |
| Bases de datos | 40–60 |
| Ingeniería, pruebas y despliegue | 70–100 |
| Desarrollo asistido por IA | 40–60 |
| Ingeniería de aplicaciones con IA | 70–110 |
| Agentes y automatización | 40–70 |
| Entrevistas y proyecto final | 60–100 |
| **Total orientativo** | **685–1.035** |

A 10 h/semana: aproximadamente **16–24 meses**. Con más tiempo disponible la ruta puede completarse antes, siempre que se mantenga el nivel de dominio requerido.

---

# Reglas permanentes del currículo

1. **Cada concepto importante tendrá ejercicios.** Sin módulos puramente teóricos.
2. **Cada módulo tendrá un proyecto o entregable.** El conocimiento se acumula en una aplicación real.
3. **La IA será herramienta y objeto de estudio.** Se usa y se audita.
4. **Habrá pruebas acumulativas.** Los fundamentos se reevalúan después de avanzar.
5. **El curso termina con demostración de competencias.** Construir, probar, explicar y defender.

---

## Documentos relacionados

- [`mapa-competencias.md`](mapa-competencias.md)
- [`prerequisitos-y-progreso.md`](prerequisitos-y-progreso.md)
- [`rubricas-evaluacion.md`](rubricas-evaluacion.md)
- [`../02-contenido/banco-ejercicios.md`](../02-contenido/banco-ejercicios.md)






