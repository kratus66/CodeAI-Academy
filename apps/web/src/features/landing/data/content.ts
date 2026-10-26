/**
 * Contenido editorial de la landing.
 * Fuente de verdad: docs/00-vision/vision-y-filosofia.md, perfil-profesional.md
 * y docs/01-curriculo/curriculo-maestro.md.
 */

export interface AILevel {
  readonly code: "A" | "B" | "C";
  readonly title: string;
  readonly badge: string;
  readonly description: string;
  readonly highlighted: boolean;
}

export const AI_LEVELS: readonly AILevel[] = [
  {
    code: "A",
    title: "Usar IA para programar",
    badge: "Punto de partida",
    description:
      "Pedirle a un modelo que genere código y aceptar lo que devuelve. No es el objetivo del programa: es el hábito que hay que superar.",
    highlighted: false,
  },
  {
    code: "B",
    title: "Desarrollar software con IA",
    badge: "Centro del programa",
    description:
      "Saber qué pedir, aportar contexto, evaluar respuestas, detectar errores, probar soluciones y decidir técnicamente. Aquí se forma el profesional.",
    highlighted: true,
  },
  {
    code: "C",
    title: "Construir sistemas que incorporan IA",
    badge: "Especialización",
    description:
      "Integrar modelos, diseñar flujos, gestionar datos, evaluar resultados y controlar costos, seguridad y fiabilidad. Etapas 8 a 10.",
    highlighted: false,
  },
];

export interface MethodPillar {
  readonly title: string;
  readonly description: string;
}

export const METHOD_PILLARS: readonly MethodPillar[] = [
  {
    title: "Aprendizaje basado en proyectos",
    description:
      "Cada concepto se usa para construir algo funcional. Todo módulo tiene un entregable registrado en la plataforma.",
  },
  {
    title: "Práctica deliberada",
    description:
      "Ejercicios específicos que atacan un error concreto. Cada competencia tiene refuerzo etiquetado por error objetivo.",
  },
  {
    title: "Recuperación activa",
    description:
      "Evaluaciones que exigen recordar y aplicar sin consultar los apuntes antes de responder.",
  },
  {
    title: "Repetición espaciada",
    description:
      "Un motor SM-2 reprograma ejercicios según el desempeño real, no según el calendario.",
  },
  {
    title: "Aprendizaje progresivo",
    description:
      "De ejercicios guiados a problemas autónomos, con una escalera de dificultad declarada en cada lección.",
  },
  {
    title: "Evaluación profesional",
    description:
      "Explicar decisiones, defender código y resolver problemas nuevos, con peso explícito en la justificación.",
  },
];

export interface Competency {
  readonly code: string;
  readonly title: string;
  readonly description: string;
}

/** Competencias obligatorias de egreso (perfil-profesional.md §2). */
export const COMPETENCIES: readonly Competency[] = [
  {
    code: "C1",
    title: "Programar y comprender código",
    description:
      "Escribir lógica propia y leer código ajeno sin ejecutarlo.",
  },
  {
    code: "C2",
    title: "Usar asistentes de forma eficaz",
    description:
      "Elegir la herramienta según la tarea y aportar el contexto necesario.",
  },
  {
    code: "C3",
    title: "Diseñar instrucciones y evaluar resultados",
    description:
      "Redactar especificaciones, validar salidas y detectar respuestas erróneas.",
  },
  {
    code: "C4",
    title: "Construir frontend, backend y datos",
    description:
      "Aplicaciones full-stack funcionales, no prototipos descartables.",
  },
  {
    code: "C5",
    title: "Aplicar Git, pruebas y buenas prácticas",
    description:
      "Historial limpio, tests reales y ausencia de vulnerabilidades evidentes.",
  },
  {
    code: "C6",
    title: "Integrar modelos y salidas estructuradas",
    description:
      "Flujos con validación de esquema y manejo explícito de fallos.",
  },
  {
    code: "C7",
    title: "Depurar código generado por IA",
    description:
      "Encontrar el defecto que funciona pero viola los requisitos.",
  },
  {
    code: "C8",
    title: "Desplegar y supervisar aplicaciones",
    description:
      "Docker, CI/CD, logs, métricas y alertas en un despliegue documentado.",
  },
  {
    code: "C9",
    title: "Documentar y colaborar",
    description:
      "ADRs, READMEs, revisión de código y pull requests con criterio.",
  },
  {
    code: "C10",
    title: "Resolver pruebas y defender proyectos",
    description:
      "Explicar trade-offs bajo presión y sostener una entrevista técnica.",
  },
];

/** Competencias adicionales de la ruta avanzada, etapas 9 y 10 (perfil-profesional.md §3). */
export const ADVANCED_COMPETENCIES: readonly Competency[] = [
  {
    code: "C11",
    title: "Evaluar modelos y sistemas RAG",
    description:
      "Conjunto de referencia y métricas antes/después de cada cambio.",
  },
  {
    code: "C12",
    title: "Diseñar agentes con herramientas limitadas",
    description:
      "Permisos acotados, trazabilidad y aprobación humana en el flujo.",
  },
  {
    code: "C13",
    title: "Observar y optimizar costos de IA",
    description:
      "Latencia, costo por consulta y tasa de fallo visibles en un panel.",
  },
  {
    code: "C14",
    title: "Asegurar sistemas con LLM",
    description:
      "Inyección de prompts y fuga de datos: amenazas y mitigaciones.",
  },
];

export const NOT_THIS: readonly string[] = [
  "No es una biblioteca de videos. El video es un insumo, no la unidad pedagógica.",
  "No es un generador de soluciones. El tutor entrega pistas graduales, nunca la solución completa por defecto.",
  "No es un curso de prompting. La ingeniería de prompts es una etapa, no el producto.",
  "No mide tiempo de conexión. Mide competencias demostradas.",
  "No garantiza empleo. Garantiza una preparación rigurosa, medible y orientada a evidencias.",
];

export const CRITERION_QUESTIONS: readonly string[] = [
  "¿De dónde salió este código?",
  "¿Por qué existe?",
  "¿Cómo sé que funciona?",
  "¿Puedo romperlo a propósito y arreglarlo?",
];
