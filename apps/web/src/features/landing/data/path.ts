/**
 * Ruta curricular mostrada en la landing.
 * Fuente de verdad: docs/01-curriculo/curriculo-maestro.md §2 y perfil-profesional.md §4.
 * Cuando el contenido se cargue desde la base de datos (Sprint 2), este archivo se elimina.
 */

export type LevelNumber = 1 | 2 | 3 | 4;

export interface CurriculumLevel {
  readonly number: LevelNumber;
  readonly name: string;
  readonly focus: string;
}

export interface CurriculumStage {
  readonly code: string;
  readonly level: LevelNumber;
  readonly title: string;
  readonly hours: string;
  readonly competencies: readonly string[];
}

export const LEVELS: readonly CurriculumLevel[] = [
  {
    number: 1,
    name: "Fundamentos",
    focus: "Entorno, lógica, programación y Git",
  },
  {
    number: 2,
    name: "Ingeniería de software",
    focus: "Web, backend, datos, pruebas y arquitectura",
  },
  {
    number: 3,
    name: "Desarrollo con IA",
    focus: "Asistentes, modelos, RAG, agentes y evaluación",
  },
  {
    number: 4,
    name: "Profesionalización",
    focus: "Proyecto final, portafolio y entrevistas",
  },
];

export const STAGES: readonly CurriculumStage[] = [
  {
    code: "E0",
    level: 1,
    title: "Diagnóstico y entorno",
    hours: "15–25 h",
    competencies: ["C1"],
  },
  {
    code: "E1",
    level: 1,
    title: "Lógica y resolución de problemas",
    hours: "70–100 h",
    competencies: ["C1"],
  },
  {
    code: "E2",
    level: 1,
    title: "JavaScript y TypeScript",
    hours: "100–140 h",
    competencies: ["C1"],
  },
  {
    code: "E3",
    level: 1,
    title: "Git, GitHub y trabajo profesional",
    hours: "20–30 h",
    competencies: ["C5", "C9"],
  },
  {
    code: "E4",
    level: 2,
    title: "Frontend profesional",
    hours: "80–120 h",
    competencies: ["C4"],
  },
  {
    code: "E5",
    level: 2,
    title: "Backend y diseño de APIs",
    hours: "80–120 h",
    competencies: ["C4"],
  },
  {
    code: "E6",
    level: 2,
    title: "Bases de datos y persistencia",
    hours: "40–60 h",
    competencies: ["C4"],
  },
  {
    code: "E7",
    level: 2,
    title: "Ingeniería, calidad y despliegue",
    hours: "70–100 h",
    competencies: ["C5", "C8", "C9"],
  },
  {
    code: "E8",
    level: 3,
    title: "Fundamentos de IA y desarrollo asistido",
    hours: "40–60 h",
    competencies: ["C2", "C3", "C7"],
  },
  {
    code: "E9",
    level: 3,
    title: "Ingeniería de aplicaciones con modelos IA",
    hours: "70–110 h",
    competencies: ["C3", "C6", "C11", "C14"],
  },
  {
    code: "E10",
    level: 3,
    title: "Agentes, automatización y sistemas avanzados",
    hours: "40–70 h",
    competencies: ["C12", "C13", "C14"],
  },
  {
    code: "E11",
    level: 4,
    title: "Preparación laboral y proyecto integrador",
    hours: "60–100 h",
    competencies: ["C10"],
  },
];

export const TOTAL_HOURS_LABEL = "685–1.035 h";

export function stagesByLevel(level: LevelNumber): CurriculumStage[] {
  return STAGES.filter((stage) => stage.level === level);
}
