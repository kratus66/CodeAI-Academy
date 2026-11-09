import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CERTIFICATION_CODES,
  CERTIFICATION_REGISTRY,
  certificationCodeSchema,
  certificationForStageId,
  examTaskBelongsToDomain,
  isExamDomainOf,
  type CertificationCode,
} from "./certification";

/** Guía oficial de la ruta AWS: el registro no puede desviarse de ella. */
const GUIDE_PATH = resolve(__dirname, "../../../../docs/02-contenido/aws-guias-examen.md");
const GUIDE_LINES = readFileSync(GUIDE_PATH, "utf8").split(/\r?\n/);

/** Cabecera de examen: `### 2.1 CLF-C02 · AWS Certified Cloud Practitioner`. */
const SECTION_PATTERN = /^### 2\.\d{1,2} ([A-Z]{3}-C\d{2}) · /;
/** Fila de la tabla de dominios: `| 1 | Cloud Concepts | 24 % | G ✅ |`. */
const DOMAIN_ROW_PATTERN = /^\|\s*(\d{1,2})\s*\|\s*([^|]+?)\s*\|\s*(\d{1,3})\s*%\s*\|/;
/** Fila de la tabla resumen de §1. */
const SUMMARY_ROW_PATTERN = /^\|\s*([A-Z]{3}-C\d{2})\s*\|/;

interface GuideDomain {
  readonly id: number;
  readonly weightPct: number;
}

function guideDomains(code: CertificationCode): GuideDomain[] {
  const start = GUIDE_LINES.findIndex((line) => {
    const match = SECTION_PATTERN.exec(line);

    return match !== null && match[1] === code;
  });
  const domains: GuideDomain[] = [];

  if (start === -1) {
    return domains;
  }

  for (const line of GUIDE_LINES.slice(start + 1)) {
    if (line.startsWith("### ") || line.startsWith("## ")) {
      break;
    }

    const match = DOMAIN_ROW_PATTERN.exec(line);

    if (match === null || match[1] === undefined || match[3] === undefined) {
      continue;
    }

    domains.push({ id: Number(match[1]), weightPct: Number(match[3]) });
  }

  return domains;
}

/** Número de dominios de la columna «Dominios» de la tabla resumen de §1. */
function summaryDomainCount(code: CertificationCode): number {
  const start = GUIDE_LINES.findIndex((line) => line.startsWith("## 1. Tabla resumen"));
  const end = GUIDE_LINES.findIndex((line, index) => index > start && line.startsWith("## 2. "));

  for (const line of GUIDE_LINES.slice(start + 1, end === -1 ? undefined : end)) {
    const match = SUMMARY_ROW_PATTERN.exec(line);

    if (match === null || match[1] !== code) {
      continue;
    }

    const cells = line.split("|");

    return Number(cells[7]?.trim());
  }

  return Number.NaN;
}

describe("CERTIFICATION_REGISTRY", () => {
  it("declara exactamente los 11 códigos, con etapa 100 + posición y sin repetir etapa", () => {
    const keys = Object.keys(CERTIFICATION_REGISTRY).sort();

    expect(keys).toEqual([...CERTIFICATION_CODES].sort());

    CERTIFICATION_CODES.forEach((code, index) => {
      expect(CERTIFICATION_REGISTRY[code].code).toBe(code);
      expect(CERTIFICATION_REGISTRY[code].stageId).toBe(100 + index + 1);
    });

    const stageIds = CERTIFICATION_CODES.map((code) => CERTIFICATION_REGISTRY[code].stageId);

    expect(new Set(stageIds).size).toBe(CERTIFICATION_CODES.length);
  });

  it.each([...CERTIFICATION_CODES])("los pesos de %s suman 100", (code) => {
    const total = CERTIFICATION_REGISTRY[code].domains.reduce(
      (sum, domain) => sum + domain.weightPct,
      0,
    );

    expect(total).toBe(100);
  });

  it.each([...CERTIFICATION_CODES])(
    "los dominios y pesos de %s coinciden con aws-guias-examen.md",
    (code) => {
      const fromGuide = guideDomains(code);
      const definition = CERTIFICATION_REGISTRY[code];

      expect(fromGuide.length).toBeGreaterThan(0);
      expect(definition.domains.map((domain) => domain.id)).toEqual(
        fromGuide.map((domain) => domain.id),
      );
      expect(definition.domains.map((domain) => domain.weightPct)).toEqual(
        fromGuide.map((domain) => domain.weightPct),
      );
    },
  );

  it.each([...CERTIFICATION_CODES])(
    "el número de dominios de %s coincide con la tabla resumen",
    (code) => {
      expect(CERTIFICATION_REGISTRY[code].domains.length).toBe(summaryDomainCount(code));
    },
  );

  it("marca como beta solo MLA-C02, con 85 preguntas y sin reparto confirmado", () => {
    const beta = CERTIFICATION_CODES.filter(
      (code) => CERTIFICATION_REGISTRY[code].status === "beta",
    );

    expect(beta).toEqual(["MLA-C02"]);

    const mla = CERTIFICATION_REGISTRY["MLA-C02"];

    expect(mla.questionCount).toBe(85);
    expect(mla.durationMin).toBe(170);
    expect(mla.scoredQuestionCount).toBeNull();
  });

  it("deja en «sin confirmar» los tipos de ítem que las fuentes de AIP-C01 no comparten", () => {
    const aip = CERTIFICATION_REGISTRY["AIP-C01"];

    expect(aip.itemTypes).toEqual(["single", "multiple"]);
    expect(aip.unconfirmedItemTypes).toContain("ordering");
    expect(aip.unconfirmedItemTypes).toContain("matching");
    expect(CERTIFICATION_REGISTRY["AIF-C01"].unconfirmedItemTypes).toEqual([]);
  });

  it("no publica fecha de retiro y data la verificación en 2026-11-09", () => {
    for (const code of CERTIFICATION_CODES) {
      expect(CERTIFICATION_REGISTRY[code].retiresOn).toBeNull();
      expect(CERTIFICATION_REGISTRY[code].verifiedAt).toBe("2026-11-09");
      expect(CERTIFICATION_REGISTRY[code].guideUrl).toMatch(
        /^https:\/\/docs\.aws\.amazon\.com\/pdfs\/aws-certification\/latest\/.+\.pdf$/,
      );
    }
  });
});

describe("certificationCodeSchema", () => {
  it("acepta solo los códigos del registro", () => {
    expect(certificationCodeSchema.parse("MLA-C02")).toBe("MLA-C02");
    expect(certificationCodeSchema.safeParse("CLF-C01").success).toBe(false);
  });
});

describe("certificationForStageId", () => {
  it("resuelve las etapas de certificación", () => {
    expect(certificationForStageId(101)?.code).toBe("CLF-C02");
    expect(certificationForStageId(111)?.code).toBe("MLA-C02");
  });

  it("devuelve null fuera del rango 101–111", () => {
    expect(certificationForStageId(100)).toBeNull();
    expect(certificationForStageId(112)).toBeNull();
    expect(certificationForStageId(2.5)).toBeNull();
  });
});

describe("isExamDomainOf", () => {
  it("reconoce solo los dominios que declara el examen", () => {
    expect(isExamDomainOf("CLF-C02", 4)).toBe(true);
    expect(isExamDomainOf("CLF-C02", 5)).toBe(false);
    expect(isExamDomainOf("DOP-C02", 6)).toBe(true);
    expect(isExamDomainOf("SAA-C03", 6)).toBe(false);
  });
});

describe("examTaskBelongsToDomain", () => {
  it("asigna la tarea al dominio de su primer número", () => {
    expect(examTaskBelongsToDomain("2.3", 2)).toBe(true);
    expect(examTaskBelongsToDomain("2.3", 3)).toBe(false);
    expect(examTaskBelongsToDomain("12.11", 12)).toBe(true);
  });

  it("rechaza formatos que no son dos enteros separados por un punto", () => {
    expect(examTaskBelongsToDomain("x.y", 2)).toBe(false);
    expect(examTaskBelongsToDomain("2", 2)).toBe(false);
    expect(examTaskBelongsToDomain("2.", 2)).toBe(false);
    expect(examTaskBelongsToDomain(" 2.3", 2)).toBe(false);
    expect(examTaskBelongsToDomain("2.3.1", 2)).toBe(false);
  });
});
