import type { AuditAnswerInput, AuditAnswerResult } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import type { AuditGrading } from "./audit-grading";
import { gradeAudit, UNKNOWN_FINDING } from "./audit-grading";

/**
 * Auditoría sembrada como la deja T10b: dos defectos reales (con su severidad) y
 * tres hallazgos correctos, que son los tres falsos positivos posibles.
 */
const AUDIT = {
  findings: [
    { id: "f1", isDefect: true, severity: "critical", explanation: "Borra la tabla sin filtro." },
    { id: "f2", isDefect: true, severity: "medium", explanation: "No cierra la conexión." },
    { id: "f3", isDefect: false, severity: null, explanation: "El nombre es claro." },
    { id: "f4", isDefect: false, severity: null, explanation: "El log es el adecuado." },
    { id: "f5", isDefect: false, severity: null, explanation: "La validación está bien." },
  ],
  verdict: "fix",
};

const DEFECTS_MARKED = [
  { findingId: "f1", severity: "critical" },
  { findingId: "f2", severity: "medium" },
] as const;

/** Respuesta correcta más los falsos positivos indicados, todos con una severidad inventada. */
function marksWith(extra: readonly string[]): AuditAnswerInput["marks"] {
  const defects = DEFECTS_MARKED.map((mark) => ({
    findingId: mark.findingId,
    severity: mark.severity,
  }));

  return [...defects, ...extra.map((findingId) => ({ findingId, severity: "low" as const }))];
}

function graded(grading: AuditGrading): {
  readonly result: AuditAnswerResult;
  readonly submissionCode: string;
} {
  if (grading.status !== "graded") {
    throw new Error(`Se esperaba una corrección y llegó «${grading.status}»`);
  }

  return { result: grading.result, submissionCode: grading.submissionCode };
}

function invalidMessage(grading: AuditGrading): string {
  if (grading.status !== "invalid-answer") {
    throw new Error(`Se esperaba una respuesta inválida y llegó «${grading.status}»`);
  }

  return grading.message;
}

function isBrokenContent(grading: AuditGrading): boolean {
  return grading.status === "broken-content";
}

describe("mensajes del contrato", () => {
  it("fija el texto literal de S14-T11b", () => {
    expect(UNKNOWN_FINDING("f9")).toBe("El hallazgo f9 no existe en esta auditoría");
  });
});

describe("gradeAudit — acierto total", () => {
  it("todos los defectos con su severidad y la decisión correcta valen 100", () => {
    const { result, submissionCode } = graded(
      gradeAudit(AUDIT, { marks: [...DEFECTS_MARKED], decision: "fix" }),
    );

    expect(result.score).toBe(100);
    expect(result.outcome).toBe("PASSED");
    expect(result.detectedDefects).toBe(2);
    expect(result.totalDefects).toBe(2);
    expect(result.falsePositives).toBe(0);
    expect(result.decisionCorrect).toBe(true);
    expect(result.verdict).toBe("fix");
    expect(submissionCode).toBe(
      '{"marks":[{"findingId":"f1","severity":"critical"},{"findingId":"f2","severity":"medium"}],"decision":"fix"}',
    );
  });

  it("revela todos los hallazgos, marcados o no, con su explicación", () => {
    const { result } = graded(gradeAudit(AUDIT, { marks: [...DEFECTS_MARKED], decision: "fix" }));

    expect(result.findings).toHaveLength(AUDIT.findings.length);
    expect(result.findings).toEqual([
      {
        id: "f1",
        isDefect: true,
        severity: "critical",
        marked: true,
        chosenSeverity: "critical",
        severityCorrect: true,
        explanation: "Borra la tabla sin filtro.",
      },
      {
        id: "f2",
        isDefect: true,
        severity: "medium",
        marked: true,
        chosenSeverity: "medium",
        severityCorrect: true,
        explanation: "No cierra la conexión.",
      },
      {
        id: "f3",
        isDefect: false,
        severity: null,
        marked: false,
        chosenSeverity: null,
        severityCorrect: null,
        explanation: "El nombre es claro.",
      },
      {
        id: "f4",
        isDefect: false,
        severity: null,
        marked: false,
        chosenSeverity: null,
        severityCorrect: null,
        explanation: "El log es el adecuado.",
      },
      {
        id: "f5",
        isDefect: false,
        severity: null,
        marked: false,
        chosenSeverity: null,
        severityCorrect: null,
        explanation: "La validación está bien.",
      },
    ]);
  });
});

describe("gradeAudit — falsos positivos", () => {
  it("un hallazgo correcto marcado baja la nota a 85", () => {
    const { result } = graded(gradeAudit(AUDIT, { marks: marksWith(["f3"]), decision: "fix" }));

    expect(result.score).toBe(85);
    expect(result.outcome).toBe("PASSED");
    expect(result.falsePositives).toBe(1);
    expect(result.detectedDefects).toBe(2);
  });

  it("dos hallazgos correctos marcados dejan la nota en 70, que aún aprueba", () => {
    const { result } = graded(gradeAudit(AUDIT, { marks: marksWith(["f3", "f4"]), decision: "fix" }));

    expect(result.score).toBe(70);
    expect(result.outcome).toBe("PASSED");
    expect(result.falsePositives).toBe(2);
  });

  it("tres hallazgos correctos marcados dejan la nota en 55, que es parcial", () => {
    const { result } = graded(
      gradeAudit(AUDIT, { marks: marksWith(["f3", "f4", "f5"]), decision: "fix" }),
    );

    expect(result.score).toBe(55);
    expect(result.outcome).toBe("PARTIAL");
    expect(result.falsePositives).toBe(3);
  });

  it("un falso positivo no acredita severidad: no era defecto", () => {
    const { result } = graded(gradeAudit(AUDIT, { marks: marksWith(["f3"]), decision: "fix" }));

    expect(result.findings.find((finding) => finding.id === "f3")).toEqual({
      id: "f3",
      isDefect: false,
      severity: null,
      marked: true,
      chosenSeverity: "low",
      severityCorrect: null,
      explanation: "El nombre es claro.",
    });
  });
});

describe("gradeAudit — severidad y decisión", () => {
  it("errar la severidad de un defecto de dos deja la nota en 80", () => {
    const { result } = graded(
      gradeAudit(AUDIT, {
        marks: [
          { findingId: "f1", severity: "high" },
          { findingId: "f2", severity: "medium" },
        ],
        decision: "fix",
      }),
    );

    expect(result.score).toBe(80);
    expect(result.outcome).toBe("PASSED");
    expect(result.detectedDefects).toBe(2);
    expect(result.falsePositives).toBe(0);
    expect(result.findings.find((finding) => finding.id === "f1")?.severityCorrect).toBe(false);
    expect(result.findings.find((finding) => finding.id === "f2")?.severityCorrect).toBe(true);
  });

  it("no marcar un defecto baja la nota aunque la decisión sea la correcta", () => {
    const { result } = graded(
      gradeAudit(AUDIT, { marks: [{ findingId: "f1", severity: "critical" }], decision: "fix" }),
    );

    expect(result.score).toBe(60);
    expect(result.outcome).toBe("PARTIAL");
    expect(result.detectedDefects).toBe(1);
    expect(result.totalDefects).toBe(2);
    expect(result.decisionCorrect).toBe(true);
    expect(result.findings.find((finding) => finding.id === "f2")?.marked).toBe(false);
  });

  it("una decisión equivocada no acredita los 20 puntos de decisión", () => {
    const { result } = graded(gradeAudit(AUDIT, { marks: [...DEFECTS_MARKED], decision: "accept" }));

    expect(result.score).toBe(80);
    expect(result.outcome).toBe("PASSED");
    expect(result.decisionCorrect).toBe(false);
    expect(result.verdict).toBe("fix");
  });

  it("un defecto sin severidad sembrada solo admite medio punto", () => {
    const solution = {
      findings: [
        { id: "f1", isDefect: true, severity: null, explanation: "Borra la tabla sin filtro." },
        { id: "f2", isDefect: false, explanation: "El nombre es claro." },
      ],
      verdict: "fix",
    };
    const { result } = graded(
      gradeAudit(solution, { marks: [{ findingId: "f1", severity: "low" }], decision: "fix" }),
    );

    expect(result.score).toBe(60);
    expect(result.outcome).toBe("PARTIAL");
    expect(result.findings.find((finding) => finding.id === "f1")?.severityCorrect).toBe(false);
  });

  it("sin defectos vistos no hay crédito por decidir: nota 0 y fallo", () => {
    const { result } = graded(gradeAudit(AUDIT, { marks: [], decision: "fix" }));

    expect(result.score).toBe(0);
    expect(result.outcome).toBe("FAILED");
    expect(result.detectedDefects).toBe(0);
    expect(result.falsePositives).toBe(0);
    expect(result.decisionCorrect).toBe(true);
    expect(result.findings.every((finding) => !finding.marked)).toBe(true);
  });

  it("sin marcas la decisión se informa igual, aunque sea la equivocada", () => {
    const { result } = graded(gradeAudit(AUDIT, { marks: [], decision: "discard" }));

    expect(result.score).toBe(0);
    expect(result.outcome).toBe("FAILED");
    expect(result.decisionCorrect).toBe(false);
  });
});

describe("gradeAudit — hallazgo inexistente", () => {
  it("una marca con un id que no existe se rechaza antes de calcular nada", () => {
    expect(
      invalidMessage(
        gradeAudit(AUDIT, {
          marks: [...DEFECTS_MARKED, { findingId: "f9", severity: "low" }],
          decision: "fix",
        }),
      ),
    ).toBe("El hallazgo f9 no existe en esta auditoría");
  });

  it("el mensaje nombra el hallazgo que falta", () => {
    expect(
      invalidMessage(
        gradeAudit(AUDIT, { marks: [{ findingId: "f12", severity: "high" }], decision: "fix" }),
      ),
    ).toBe(UNKNOWN_FINDING("f12"));
  });
});

describe("gradeAudit — contenido roto", () => {
  it("rechaza soluciones que no son un objeto con hallazgos", () => {
    const answers = [
      gradeAudit(null, { marks: [], decision: "fix" }),
      gradeAudit(undefined, { marks: [], decision: "fix" }),
      gradeAudit("auditoría", { marks: [], decision: "fix" }),
      gradeAudit([], { marks: [], decision: "fix" }),
      gradeAudit({}, { marks: [], decision: "fix" }),
      gradeAudit({ findings: [], verdict: "fix" }, { marks: [], decision: "fix" }),
      gradeAudit({ findings: "f1", verdict: "fix" }, { marks: [], decision: "fix" }),
    ];

    expect(answers.every(isBrokenContent)).toBe(true);
  });

  it("rechaza una solución sin ningún defecto: no hay nada que auditar", () => {
    const solution = {
      findings: [
        { id: "f1", isDefect: false, severity: null, explanation: "El nombre es claro." },
        { id: "f2", isDefect: false, severity: null, explanation: "El log es el adecuado." },
      ],
      verdict: "accept",
    };

    expect(isBrokenContent(gradeAudit(solution, { marks: [], decision: "accept" }))).toBe(true);
  });

  it("rechaza hallazgos malformados: explicación, severidad, id o repetidos", () => {
    const malformed = [
      { findings: [{ id: "f1", isDefect: true, severity: "critical" }], verdict: "fix" },
      {
        findings: [{ id: "", isDefect: true, severity: "critical", explanation: "Un defecto." }],
        verdict: "fix",
      },
      {
        findings: [{ id: "f1", isDefect: "sí", severity: "critical", explanation: "Un defecto." }],
        verdict: "fix",
      },
      {
        findings: [{ id: "f1", isDefect: true, severity: "urgent", explanation: "Un defecto." }],
        verdict: "fix",
      },
      {
        findings: [
          { id: "f1", isDefect: true, severity: "critical", explanation: "Uno." },
          { id: "f1", isDefect: false, severity: null, explanation: "Dos." },
        ],
        verdict: "fix",
      },
    ];

    const broken = malformed.map((solution) =>
      isBrokenContent(gradeAudit(solution, { marks: [], decision: "fix" })),
    );

    expect(broken.every(Boolean)).toBe(true);
  });

  it("rechaza un veredicto que no está en el contrato", () => {
    const solution = {
      findings: [{ id: "f1", isDefect: true, severity: "critical", explanation: "Borra sin filtro." }],
      verdict: "quizá",
    };

    expect(isBrokenContent(gradeAudit(solution, { marks: [], decision: "fix" }))).toBe(true);
  });

  it("ignora los campos de la semilla que no puntúan, como las líneas y la etiqueta", () => {
    const solution = {
      findings: [
        {
          id: "f1",
          lines: [4, 6],
          label: "Consulta sin filtro",
          isDefect: true,
          severity: "critical",
          explanation: "Borra la tabla sin filtro.",
        },
      ],
      verdict: "fix",
    };
    const { result } = graded(
      gradeAudit(solution, { marks: [{ findingId: "f1", severity: "critical" }], decision: "fix" }),
    );

    expect(result.score).toBe(100);
    expect(result.totalDefects).toBe(1);
  });
});

describe("gradeAudit — nunca lanza", () => {
  it("devuelve un estado con cualquier solución, incluidas las basuras", () => {
    const garbage: unknown[] = [null, 42, false, {}, [], { findings: [null] }, { findings: [{ id: "f1" }] }];

    for (const solution of garbage) {
      expect(() => gradeAudit(solution, { marks: [], decision: "fix" })).not.toThrow();
    }
  });
});
