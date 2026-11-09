import { z } from "zod";

/**
 * Registro de certificaciones de la ruta AWS.
 *
 * Fuente única: `docs/02-contenido/aws-guias-examen.md` (S14-T0). Los nombres de
 * examen y de dominio se copian literalmente de las guías oficiales, en inglés y
 * sin traducir; los pesos son «% of scored content» y suman 100 en cada examen.
 */

export const CERTIFICATION_CODES = [
  "CLF-C02",
  "SAA-C03",
  "DVA-C03",
  "SOA-C03",
  "DOP-C02",
  "SAP-C03",
  "AIF-C01",
  "AIP-C01",
  "SCS-C03",
  "DEA-C01",
  "MLA-C02",
] as const;

export type CertificationCode = (typeof CERTIFICATION_CODES)[number];

export const certificationCodeSchema = z.enum(CERTIFICATION_CODES);

export const CERTIFICATION_LEVELS = [
  "foundational",
  "associate",
  "professional",
  "specialty",
] as const;

export type CertificationLevel = (typeof CERTIFICATION_LEVELS)[number];

/** Tipos de ítem del examen real. */
export const EXAM_ITEM_TYPES = ["single", "multiple", "ordering", "matching"] as const;

export type ExamItemType = (typeof EXAM_ITEM_TYPES)[number];

export interface ExamDomain {
  readonly id: number; // 1…6, como en la guía
  readonly name: string; // nombre oficial en inglés, tal cual la guía
  readonly weightPct: number; // % of scored content; los dominios de un examen suman 100
}

export interface CertificationDefinition {
  readonly code: CertificationCode;
  readonly name: string; // nombre oficial en inglés
  readonly level: CertificationLevel;
  readonly stageId: number; // 101…111
  readonly status: "ga" | "beta";
  readonly questionCount: number; // total del examen (puntuadas + no puntuadas)
  readonly scoredQuestionCount: number | null; // null = 🔎 (MLA-C02 beta)
  readonly durationMin: number;
  readonly passingScore: number; // escala 100–1000
  readonly itemTypes: readonly ExamItemType[]; // los que lista la guía vigente
  readonly unconfirmedItemTypes: readonly ExamItemType[]; // AIP-C01: las dos fuentes oficiales difieren
  readonly availableFrom: string | null; // ISO; fecha de entrada en uso de esta versión, si la fuente la da
  readonly retiresOn: string | null; // ISO; ninguna de las 11 versiones tiene fecha de retiro publicada
  readonly guideUrl: string;
  readonly verifiedAt: string; // "2026-11-09"
  readonly domains: readonly ExamDomain[];
}

/** Prefijo común de las guías de examen que publica AWS en PDF. */
const GUIDE_URL_PREFIX = "https://docs.aws.amazon.com/pdfs/aws-certification/latest/";

/** Fecha de la lectura de las guías que respalda este registro (`aws-guias-examen.md`). */
const VERIFIED_AT = "2026-11-09";

export const CERTIFICATION_REGISTRY: Readonly<Record<CertificationCode, CertificationDefinition>> = {
  "CLF-C02": {
    code: "CLF-C02",
    name: "AWS Certified Cloud Practitioner",
    level: "foundational",
    stageId: 101,
    status: "ga",
    questionCount: 65,
    scoredQuestionCount: 50,
    durationMin: 90,
    passingScore: 700,
    itemTypes: ["single", "multiple"],
    unconfirmedItemTypes: [],
    availableFrom: null,
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}cloud-practitioner-02/cloud-practitioner-02.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      { id: 1, name: "Cloud Concepts", weightPct: 24 },
      { id: 2, name: "Security and Compliance", weightPct: 30 },
      { id: 3, name: "Cloud Technology and Services", weightPct: 34 },
      { id: 4, name: "Billing, Pricing, and Support", weightPct: 12 },
    ],
  },
  "SAA-C03": {
    code: "SAA-C03",
    name: "AWS Certified Solutions Architect - Associate",
    level: "associate",
    stageId: 102,
    status: "ga",
    questionCount: 65,
    scoredQuestionCount: 50,
    durationMin: 130,
    passingScore: 720,
    itemTypes: ["single", "multiple"],
    unconfirmedItemTypes: [],
    availableFrom: null,
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}solutions-architect-associate-03/solutions-architect-associate-03.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      { id: 1, name: "Design Secure Architectures", weightPct: 30 },
      { id: 2, name: "Design Resilient Architectures", weightPct: 26 },
      { id: 3, name: "Design High-Performing Architectures", weightPct: 24 },
      { id: 4, name: "Design Cost-Optimized Architectures", weightPct: 20 },
    ],
  },
  "DVA-C03": {
    code: "DVA-C03",
    name: "AWS Certified Developer - Associate",
    level: "associate",
    stageId: 103,
    status: "ga",
    questionCount: 65,
    scoredQuestionCount: 50,
    durationMin: 130,
    passingScore: 720,
    itemTypes: ["single", "multiple"],
    unconfirmedItemTypes: [],
    availableFrom: "2026-12-01",
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}developer-associate-03/developer-associate-03.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      { id: 1, name: "Development with AWS Services", weightPct: 30 },
      { id: 2, name: "Security", weightPct: 26 },
      { id: 3, name: "Testing and Deployment", weightPct: 22 },
      { id: 4, name: "Troubleshooting and Optimization", weightPct: 22 },
    ],
  },
  "SOA-C03": {
    code: "SOA-C03",
    name: "AWS Certified CloudOps Engineer - Associate",
    level: "associate",
    stageId: 104,
    status: "ga",
    questionCount: 65,
    scoredQuestionCount: 50,
    durationMin: 130,
    passingScore: 720,
    itemTypes: ["single", "multiple"],
    unconfirmedItemTypes: [],
    availableFrom: "2025-09-30",
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}sysops-administrator-associate-03/sysops-administrator-associate-03.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      {
        id: 1,
        name: "Monitoring, Logging, Analysis, Remediation, and Performance Optimization",
        weightPct: 22,
      },
      { id: 2, name: "Reliability and Business Continuity", weightPct: 22 },
      { id: 3, name: "Deployment, Provisioning, and Automation", weightPct: 22 },
      { id: 4, name: "Security and Compliance", weightPct: 16 },
      { id: 5, name: "Networking and Content Delivery", weightPct: 18 },
    ],
  },
  "DOP-C02": {
    code: "DOP-C02",
    name: "AWS Certified DevOps Engineer - Professional",
    level: "professional",
    stageId: 105,
    status: "ga",
    questionCount: 75,
    scoredQuestionCount: 65,
    durationMin: 180,
    passingScore: 750,
    itemTypes: ["single", "multiple"],
    unconfirmedItemTypes: [],
    availableFrom: null,
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}devops-engineer-professional-02/devops-engineer-professional-02.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      { id: 1, name: "SDLC Automation", weightPct: 22 },
      { id: 2, name: "Configuration Management and IaC", weightPct: 17 },
      { id: 3, name: "Resilient Cloud Solutions", weightPct: 15 },
      { id: 4, name: "Monitoring and Logging", weightPct: 15 },
      { id: 5, name: "Incident and Event Response", weightPct: 14 },
      { id: 6, name: "Security and Compliance", weightPct: 17 },
    ],
  },
  "SAP-C03": {
    code: "SAP-C03",
    name: "AWS Certified Solutions Architect - Professional",
    level: "professional",
    stageId: 106,
    status: "ga",
    questionCount: 75,
    scoredQuestionCount: 65,
    durationMin: 180,
    passingScore: 720,
    itemTypes: ["single", "multiple"],
    unconfirmedItemTypes: [],
    availableFrom: "2026-11-17",
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}solutions-architect-professional-03/solutions-architect-professional-03.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      { id: 1, name: "Architecture Design and Implementation Built for the Cloud", weightPct: 25 },
      { id: 2, name: "Security, Compliance, and Governance", weightPct: 25 },
      { id: 3, name: "Cost-Optimized Architecture Design", weightPct: 15 },
      { id: 4, name: "Resilience, Migration, and Business Continuity", weightPct: 15 },
      { id: 5, name: "Operational Excellence and Automation", weightPct: 20 },
    ],
  },
  "AIF-C01": {
    code: "AIF-C01",
    name: "AWS Certified AI Practitioner",
    level: "foundational",
    stageId: 107,
    status: "ga",
    questionCount: 65,
    scoredQuestionCount: 50,
    durationMin: 90,
    passingScore: 700,
    itemTypes: ["single", "multiple", "ordering", "matching"],
    unconfirmedItemTypes: [],
    availableFrom: null,
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}ai-practitioner-01/ai-practitioner-01.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      { id: 1, name: "Fundamentals of AI and ML", weightPct: 20 },
      { id: 2, name: "Fundamentals of GenAI", weightPct: 24 },
      { id: 3, name: "Applications of Foundation Models", weightPct: 28 },
      { id: 4, name: "Guidelines for Responsible AI", weightPct: 14 },
      { id: 5, name: "Security, Compliance, and Governance for AI Solutions", weightPct: 14 },
    ],
  },
  "AIP-C01": {
    code: "AIP-C01",
    name: "AWS Certified Generative AI Developer - Professional",
    level: "professional",
    stageId: 108,
    status: "ga",
    questionCount: 75,
    scoredQuestionCount: 65,
    durationMin: 180,
    passingScore: 750,
    itemTypes: ["single", "multiple"],
    unconfirmedItemTypes: ["ordering", "matching"],
    availableFrom: null,
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}ai-professional-01/ai-professional-01.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      { id: 1, name: "Foundation Model Integration, Data Management, and Compliance", weightPct: 31 },
      { id: 2, name: "Implementation and Integration", weightPct: 26 },
      { id: 3, name: "AI Safety, Security, and Governance", weightPct: 20 },
      { id: 4, name: "Operational Efficiency and Optimization for GenAI Applications", weightPct: 12 },
      { id: 5, name: "Testing, Validation, and Troubleshooting", weightPct: 11 },
    ],
  },
  "SCS-C03": {
    code: "SCS-C03",
    name: "AWS Certified Security - Specialty",
    level: "specialty",
    stageId: 109,
    status: "ga",
    questionCount: 65,
    scoredQuestionCount: 50,
    durationMin: 170,
    passingScore: 750,
    itemTypes: ["single", "multiple", "ordering", "matching"],
    unconfirmedItemTypes: [],
    availableFrom: "2025-12-02",
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}security-specialty-03/security-specialty-03.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      { id: 1, name: "Detection", weightPct: 16 },
      { id: 2, name: "Incident Response", weightPct: 14 },
      { id: 3, name: "Infrastructure Security", weightPct: 18 },
      { id: 4, name: "Identity and Access Management", weightPct: 20 },
      { id: 5, name: "Data Protection", weightPct: 18 },
      { id: 6, name: "Security Foundations and Governance", weightPct: 14 },
    ],
  },
  "DEA-C01": {
    code: "DEA-C01",
    name: "AWS Certified Data Engineer - Associate",
    level: "associate",
    stageId: 110,
    status: "ga",
    questionCount: 65,
    scoredQuestionCount: 50,
    durationMin: 130,
    passingScore: 720,
    itemTypes: ["single", "multiple"],
    unconfirmedItemTypes: [],
    availableFrom: null,
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}data-engineer-associate-01/data-engineer-associate-01.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      { id: 1, name: "Data Ingestion and Transformation", weightPct: 34 },
      { id: 2, name: "Data Store Management", weightPct: 26 },
      { id: 3, name: "Data Operations and Support", weightPct: 22 },
      { id: 4, name: "Data Security and Governance", weightPct: 18 },
    ],
  },
  "MLA-C02": {
    code: "MLA-C02",
    name: "AWS Certified Machine Learning Engineer - Associate",
    level: "associate",
    stageId: 111,
    status: "beta",
    questionCount: 85,
    scoredQuestionCount: null,
    durationMin: 170,
    passingScore: 720,
    itemTypes: ["single", "multiple"],
    unconfirmedItemTypes: [],
    availableFrom: "2027-01-14",
    retiresOn: null,
    guideUrl: `${GUIDE_URL_PREFIX}machine-learning-engineer-associate-02/machine-learning-engineer-associate-02.pdf`,
    verifiedAt: VERIFIED_AT,
    domains: [
      { id: 1, name: "Data Preparation for ML and AI", weightPct: 28 },
      { id: 2, name: "ML Model and Foundation Model (FM) Development", weightPct: 24 },
      { id: 3, name: "Deployment and Orchestration of ML and AI Workflows", weightPct: 24 },
      { id: 4, name: "Operating, Monitoring, and Securing ML and AI Solutions", weightPct: 24 },
    ],
  },
};

/**
 * Devuelve la certificación de la etapa indicada, o `null` si la etapa no es
 * una de las 11 certificaciones (por ejemplo, 100, 112 o un valor no entero).
 */
export function certificationForStageId(stageId: number): CertificationDefinition | null {
  if (!Number.isInteger(stageId)) {
    return null;
  }

  for (const code of CERTIFICATION_CODES) {
    const definition = CERTIFICATION_REGISTRY[code];

    if (definition.stageId === stageId) {
      return definition;
    }
  }

  return null;
}

/** Indica si el examen declara ese dominio (por su id, 1…6). */
export function isExamDomainOf(code: CertificationCode, domainId: number): boolean {
  return CERTIFICATION_REGISTRY[code].domains.some((domain) => domain.id === domainId);
}

/** Formato de tarea de examen: dos números enteros separados por un punto. */
const EXAM_TASK_PATTERN = /^(\d{1,2})\.(\d{1,2})$/;

/** "2.3" pertenece al dominio 2. Formato: dos números enteros separados por un punto. */
export function examTaskBelongsToDomain(task: string, domainId: number): boolean {
  const match = EXAM_TASK_PATTERN.exec(task);

  if (match === null || match[1] === undefined) {
    return false;
  }

  return Number(match[1]) === domainId;
}
