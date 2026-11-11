import { describe, expect, it } from "vitest";

import {
  contentSeedCloudLabSchema,
  contentSeedExerciseSchema,
  contentSeedQuizSchema,
  exerciseRuleViolations,
  type ContentSeedExercise,
} from "./content";

function exercise(overrides: Record<string, unknown> = {}): ContentSeedExercise {
  return contentSeedExerciseSchema.parse({
    slug: "js-async-900",
    type: "LAB",
    title: "Ejercicio de prueba",
    statement: "Enunciado con ejemplo.",
    ladder: "GUIDED",
    difficulty: 2,
    concepts: ["promises"],
    competencies: ["C1"],
    language: "javascript",
    starterCode: "function f() {}",
    solution: { code: "function f() { return 1; }" },
    sources: ["https://developer.mozilla.org/es/"],
    isPublished: false,
    order: 1,
    hints: [
      { level: 1, text: "a" },
      { level: 2, text: "b" },
      { level: 3, text: "c" },
    ],
    tests: [
      { name: "visible", isHidden: false, spec: { code: "assert.ok(true)" } },
      { name: "oculta", isHidden: true, spec: { code: "assert.ok(true)" } },
    ],
    ...overrides,
  });
}

describe("contentSeedExerciseSchema", () => {
  it("acepta un LAB guiado completo", () => {
    expect(exerciseRuleViolations(exercise())).toEqual([]);
  });

  it("exige concepto, competencia válida y documentación oficial", () => {
    expect(() => exercise({ concepts: [] })).toThrow(/concepto/);
    expect(() => exercise({ competencies: ["C15"] })).toThrow(
      "La competencia debe ser C1–C14 o AWS-C1–AWS-C15",
    );
    expect(() => exercise({ sources: [] })).toThrow(/documentación oficial/);
  });
});

describe("exerciseRuleViolations", () => {
  it("un ejercicio guiado declara las tres pistas", () => {
    const problems = exerciseRuleViolations(exercise({ hints: [{ level: 1, text: "a" }] }));

    expect(problems).toContain("un LAB/DEBUG guiado declara las 3 pistas progresivas");
  });

  it("un ejercicio autónomo (Nivel 3) no puede tener pistas", () => {
    const problems = exerciseRuleViolations(exercise({ ladder: "AUTONOMOUS" }));

    expect(problems).toContain("un ejercicio autónomo (Nivel 3) no puede tener pistas");
  });

  it("rechaza pistas con el mismo nivel y pruebas con el mismo nombre", () => {
    const problems = exerciseRuleViolations(
      exercise({
        ladder: "SEMI",
        hints: [
          { level: 1, text: "a" },
          { level: 1, text: "b" },
        ],
        tests: [
          { name: "igual", isHidden: false, spec: { code: "x" } },
          { name: "igual", isHidden: true, spec: { code: "x" } },
        ],
      }),
    );

    expect(problems).toEqual(
      expect.arrayContaining(["las pistas repiten nivel", "hay pruebas con el mismo nombre"]),
    );
  });

  it("un LAB necesita lenguaje, código inicial, solución y pruebas visible y oculta", () => {
    const problems = exerciseRuleViolations(
      exercise({
        language: null,
        starterCode: null,
        solution: null,
        tests: [{ name: "solo visible", isHidden: false, spec: { code: "x" } }],
      }),
    );

    expect(problems).toEqual(
      expect.arrayContaining([
        "requiere language",
        "requiere starterCode",
        "requiere la solución oficial",
        "requiere una prueba oculta",
      ]),
    );
  });

  describe("QUIZ y FLASHCARD", () => {
    const quiz = (overrides: Record<string, unknown> = {}) =>
      exercise({
        type: "QUIZ",
        ladder: "SEMI",
        hints: [],
        tests: [],
        language: null,
        starterCode: null,
        solution: null,
        quiz: {
          correctOptionId: "a",
          options: [
            { id: "a", text: "Correcta", explanation: "Porque sí." },
            { id: "b", text: "Distractor uno", explanation: "Porque no." },
            { id: "c", text: "Distractor dos", explanation: "Tampoco." },
          ],
        },
        ...overrides,
      });

    it("acepta un quiz con explicación en cada opción", () => {
      expect(exerciseRuleViolations(quiz())).toEqual([]);
    });

    it("exige el objeto quiz", () => {
      expect(exerciseRuleViolations(quiz({ quiz: null }))).toContain(
        "un QUIZ requiere quiz (opciones y respuesta)",
      );
    });

    it("la opción correcta debe existir", () => {
      const problems = exerciseRuleViolations(
        quiz({
          quiz: {
            correctOptionId: "d",
            options: [
              { id: "a", text: "Uno", explanation: "x" },
              { id: "b", text: "Dos", explanation: "x" },
              { id: "c", text: "Tres", explanation: "x" },
            ],
          },
        }),
      );

      expect(problems).toContain("la opción correcta no existe");
    });

    it("prohíbe verdadero/falso y «todas las anteriores»", () => {
      const bad = quiz({
        quiz: {
          correctOptionId: "a",
          options: [
            { id: "a", text: "Verdadero", explanation: "x" },
            { id: "b", text: "Todas las anteriores", explanation: "x" },
            { id: "c", text: "Falso", explanation: "x" },
          ],
        },
      });

      expect(exerciseRuleViolations(bad)).toEqual(
        expect.arrayContaining(["prohibido verdadero/falso", "prohibido «todas/ninguna de las anteriores»"]),
      );
    });

    it("rechaza un quiz sin explicación en una opción", () => {
      expect(() =>
        quiz({
          quiz: {
            correctOptionId: "a",
            options: [
              { id: "a", text: "Uno", explanation: "x" },
              { id: "b", text: "Dos", explanation: "" },
              { id: "c", text: "Tres", explanation: "x" },
            ],
          },
        }),
      ).toThrow();
    });

    it("una FLASHCARD necesita reverso y no admite quiz", () => {
      const flashcard = (overrides: Record<string, unknown>) =>
        exercise({
          type: "FLASHCARD",
          ladder: "GUIDED",
          hints: [],
          tests: [],
          language: null,
          starterCode: null,
          solution: null,
          ...overrides,
        });

      expect(exerciseRuleViolations(flashcard({}))).toContain("una FLASHCARD requiere flashcard.back");
      expect(exerciseRuleViolations(flashcard({ flashcard: { back: "Reverso" } }))).toEqual([]);
    });
  });
});

describe("variantes de quiz de la semilla", () => {
  const quizExercise = (quiz: unknown): ContentSeedExercise =>
    exercise({
      type: "QUIZ",
      ladder: "SEMI",
      hints: [],
      tests: [],
      language: null,
      starterCode: null,
      solution: null,
      quiz,
    });

  const letterAt = (index: number): string => String.fromCharCode("a".charCodeAt(0) + index);

  const quizOptions = (...texts: string[]) =>
    texts.map((text, index) => ({
      id: letterAt(index),
      text,
      explanation: `Explicación de «${text}».`,
    }));

  const single = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    options: quizOptions(
      "Es el estado inicial de la promesa",
      "Es un estado intermedio inventado",
      "Es el nombre de la reacción registrada",
    ),
    correctOptionId: "a",
    ...overrides,
  });

  const multiple = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    kind: "multiple",
    options: quizOptions(
      "Es el estado inicial de la promesa",
      "Es un estado intermedio inventado",
      "Es el nombre de la reacción registrada",
      "Es el motivo del rechazo",
      "Es la cola de microtareas del motor",
    ),
    selectCount: 2,
    correctOptionIds: ["a", "c"],
    ...overrides,
  });

  const ordering = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    kind: "ordering",
    items: [
      { id: "a", text: "Crear la promesa", explanation: "El constructor devuelve la promesa pendiente." },
      { id: "b", text: "Resolverla con un valor", explanation: "Resolver fija el valor de éxito." },
      { id: "c", text: "Leer el valor con then", explanation: "then recibe el valor ya resuelto." },
    ],
    correctOrder: ["c", "a", "b"],
    ...overrides,
  });

  const matching = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    kind: "matching",
    left: [
      { id: "a", text: "pending", explanation: "Su pareja dice que aún no hay resultado." },
      { id: "b", text: "fulfilled", explanation: "Su pareja dice que terminó con éxito." },
      { id: "c", text: "rejected", explanation: "Su pareja dice que terminó con un error." },
    ],
    right: [
      { id: "1", text: "Terminada con éxito" },
      { id: "2", text: "Terminada con un error" },
      { id: "3", text: "Sin resultado todavía" },
    ],
    correctPairs: { a: "3", b: "1", c: "2" },
    ...overrides,
  });

  it("un quiz sin kind se completa como respuesta única", () => {
    expect(contentSeedQuizSchema.parse(single()).kind).toBe("single");
  });

  it("el mismo quiz con kind explícito sigue siendo de respuesta única", () => {
    expect(contentSeedQuizSchema.parse(single({ kind: "single" })).kind).toBe("single");
  });

  it("acepta un quiz de respuesta múltiple válido", () => {
    const built = quizExercise(multiple());

    expect(built.quiz?.kind).toBe("multiple");
    expect(exerciseRuleViolations(built)).toEqual([]);
  });

  it("acepta un quiz de ordenar válido", () => {
    const built = quizExercise(ordering());

    expect(built.quiz?.kind).toBe("ordering");
    expect(exerciseRuleViolations(built)).toEqual([]);
  });

  it("acepta un quiz de emparejar válido", () => {
    const built = quizExercise(matching());

    expect(built.quiz?.kind).toBe("matching");
    expect(exerciseRuleViolations(built)).toEqual([]);
  });

  it("rechaza un quiz de respuesta múltiple con cuatro opciones", () => {
    expect(() =>
      contentSeedQuizSchema.parse(multiple({ options: quizOptions("Uno", "Dos", "Tres", "Cuatro") })),
    ).toThrow("Un quiz de respuesta múltiple ofrece de 5 a 6 opciones");
  });

  it("rechaza un selectCount de cuatro", () => {
    expect(() => contentSeedQuizSchema.parse(multiple({ selectCount: 4 }))).toThrow();
  });

  it("rechaza un emparejamiento con siete elementos", () => {
    const sevenLeft = ["a", "b", "c", "d", "e", "f", "a"].map((id) => ({
      id,
      text: `Elemento ${id}`,
      explanation: `Justifica la pareja del elemento ${id}.`,
    }));
    const sevenRight = ["1", "2", "3", "4", "5", "6", "1"].map((id) => ({ id, text: `Pareja ${id}` }));

    expect(() => contentSeedQuizSchema.parse(matching({ left: sevenLeft, right: sevenRight }))).toThrow(
      "La columna izquierda ofrece de 3 a 6 elementos",
    );
  });

  describe("reglas de la respuesta múltiple", () => {
    it("las opciones repiten id", () => {
      const options = [
        ...quizOptions("Uno", "Dos", "Tres", "Cuatro"),
        { id: "a", text: "Cinco", explanation: "Explicación de «Cinco»." },
      ];
      const problems = exerciseRuleViolations(quizExercise(multiple({ options })));

      expect(problems).toContain("las opciones repiten id");
    });

    it("las opciones correctas deben existir", () => {
      const problems = exerciseRuleViolations(quizExercise(multiple({ correctOptionIds: ["a", "f"] })));

      expect(problems).toContain("las opciones correctas deben existir");
    });

    it("correctOptionIds repite opciones", () => {
      const problems = exerciseRuleViolations(quizExercise(multiple({ correctOptionIds: ["a", "a"] })));

      expect(problems).toContain("correctOptionIds repite opciones");
    });

    it("selectCount debe coincidir con el número de opciones correctas", () => {
      const problems = exerciseRuleViolations(quizExercise(multiple({ selectCount: 3 })));

      expect(problems).toContain("selectCount debe coincidir con el número de opciones correctas");
    });

    it("prohibido verdadero/falso", () => {
      const options = quizOptions("Verdadero", "Dos", "Tres", "Cuatro", "Cinco");

      expect(exerciseRuleViolations(quizExercise(multiple({ options })))).toContain("prohibido verdadero/falso");
    });

    it("prohibido «todas/ninguna de las anteriores»", () => {
      const options = quizOptions("Todas las anteriores", "Dos", "Tres", "Cuatro", "Cinco");

      expect(exerciseRuleViolations(quizExercise(multiple({ options })))).toContain(
        "prohibido «todas/ninguna de las anteriores»",
      );
    });
  });

  describe("reglas de ordenar", () => {
    it("los elementos repiten id", () => {
      const items = [
        { id: "a", text: "Uno", explanation: "Explicación del uno." },
        { id: "a", text: "Dos", explanation: "Explicación del dos." },
        { id: "b", text: "Tres", explanation: "Explicación del tres." },
      ];
      const problems = exerciseRuleViolations(quizExercise(ordering({ items, correctOrder: ["a", "b", "c"] })));

      expect(problems).toContain("los elementos repiten id");
    });

    it("correctOrder debe contener cada elemento exactamente una vez", () => {
      const problems = exerciseRuleViolations(quizExercise(ordering({ correctOrder: ["a", "b"] })));

      expect(problems).toContain("correctOrder debe contener cada elemento exactamente una vez");
    });

    it("los elementos no pueden venir ya en el orden correcto", () => {
      const problems = exerciseRuleViolations(quizExercise(ordering({ correctOrder: ["a", "b", "c"] })));

      expect(problems).toContain("los elementos no pueden venir ya en el orden correcto");
    });
  });

  describe("reglas de emparejar", () => {
    it("los elementos de la izquierda repiten id", () => {
      const left = [
        { id: "a", text: "pending", explanation: "Su pareja dice que aún no hay resultado." },
        { id: "a", text: "fulfilled", explanation: "Su pareja dice que terminó con éxito." },
        { id: "b", text: "rejected", explanation: "Su pareja dice que terminó con un error." },
      ];
      const problems = exerciseRuleViolations(quizExercise(matching({ left, correctPairs: { a: "2", b: "1" } })));

      expect(problems).toContain("los elementos de la izquierda repiten id");
    });

    it("los elementos de la derecha repiten id", () => {
      const right = [
        { id: "1", text: "Terminada con éxito" },
        { id: "1", text: "Terminada con un error" },
        { id: "2", text: "Sin resultado todavía" },
      ];
      const problems = exerciseRuleViolations(
        quizExercise(matching({ right, correctPairs: { a: "1", b: "1", c: "2" } })),
      );

      expect(problems).toContain("los elementos de la derecha repiten id");
    });

    it("debe haber tantos elementos a la derecha como a la izquierda", () => {
      const right = [
        { id: "1", text: "Terminada con éxito" },
        { id: "2", text: "Terminada con un error" },
        { id: "3", text: "Sin resultado todavía" },
        { id: "4", text: "Sin estado asignado" },
      ];
      const problems = exerciseRuleViolations(
        quizExercise(matching({ right, correctPairs: { a: "2", b: "3", c: "4" } })),
      );

      expect(problems).toContain("debe haber tantos elementos a la derecha como a la izquierda");
    });

    it("correctPairs debe emparejar cada elemento de la izquierda", () => {
      const problems = exerciseRuleViolations(quizExercise(matching({ correctPairs: { a: "2", b: "3" } })));

      expect(problems).toContain("correctPairs debe emparejar cada elemento de la izquierda");
    });

    it("las parejas deben apuntar a elementos de la derecha, sin repetir", () => {
      const problems = exerciseRuleViolations(
        quizExercise(matching({ correctPairs: { a: "2", b: "2", c: "3" } })),
      );

      expect(problems).toContain("las parejas deben apuntar a elementos de la derecha, sin repetir");
    });

    it("las parejas no pueden venir ya alineadas", () => {
      const problems = exerciseRuleViolations(
        quizExercise(matching({ correctPairs: { a: "1", b: "2", c: "3" } })),
      );

      expect(problems).toContain("las parejas no pueden venir ya alineadas");
    });
  });
});

describe("reglas de AUDIT", () => {
  const artifact = [
    "export function verificar(token: string) {",
    "  const payload = jwt.decode(token);",
    "  const usuario = usuarios.find((u) => u.correo === payload.correo);",
    "  if (!usuario) throw new Error(`No existe ${payload.correo}`);",
    "  return bcrypt.hashSync(payload.clave, 10);",
    "}",
  ].join("\n");

  const finding = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "f1",
    lines: [2, 2],
    label: "Línea 2: decodifica el token sin comprobar la firma",
    isDefect: true,
    severity: "critical",
    explanation: "El token se acepta sin validar la firma ni la expiración.",
    ...overrides,
  });

  /** Dos defectos reales (crítico y alto) y un acierto que parece sospechoso. */
  const findings = (): Record<string, unknown>[] => [
    finding(),
    finding({
      id: "f2",
      lines: [4, 4],
      label: "Línea 4: el error incluye el correo consultado",
      severity: "high",
      explanation: "El mensaje revela si el correo existe (enumeración de usuarios).",
    }),
    finding({
      id: "f3",
      lines: [5, 5],
      label: "Línea 5: bcrypt con coste 10",
      isDefect: false,
      severity: null,
      explanation: "El coste 10 sigue siendo aceptable: parece sospechoso y no lo es.",
    }),
  ];

  const withFinding = (
    index: number,
    overrides: Record<string, unknown>,
  ): Record<string, unknown>[] =>
    findings().map((item, position) => (position === index ? { ...item, ...overrides } : item));

  const audit = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    artifact: { language: "typescript", content: artifact },
    findings: findings(),
    verdict: "fix",
    ...overrides,
  });

  const auditExercise = (overrides: Record<string, unknown> = {}): ContentSeedExercise =>
    exercise({
      type: "AUDIT",
      ladder: "SEMI",
      hints: [],
      tests: [],
      language: null,
      starterCode: null,
      solution: null,
      ...overrides,
    });

  it("acepta una auditoría con dos defectos y un correcto sospechoso", () => {
    const built = auditExercise({ audit: audit() });

    expect(built.audit?.findings).toHaveLength(3);
    expect(exerciseRuleViolations(built)).toEqual([]);
  });

  it("un ejercicio sin audit lo deja en null", () => {
    expect(exercise().audit).toBeNull();
  });

  it("un AUDIT requiere audit (artefacto y hallazgos)", () => {
    expect(exerciseRuleViolations(auditExercise())).toContain(
      "un AUDIT requiere audit (artefacto y hallazgos)",
    );
  });

  it("solo un AUDIT declara audit", () => {
    expect(exerciseRuleViolations(exercise({ audit: audit() }))).toContain(
      "solo un AUDIT declara audit",
    );
  });

  it("un AUDIT declara al menos un defecto real", () => {
    const noDefects = findings().map((item) => ({ ...item, isDefect: false, severity: null }));
    const problems = exerciseRuleViolations(
      auditExercise({ audit: audit({ findings: noDefects }) }),
    );

    expect(problems).toContain("un AUDIT declara al menos un defecto real");
  });

  it("un AUDIT declara al menos un elemento correcto que parece sospechoso", () => {
    const allDefects = findings().map((item) => ({ ...item, isDefect: true, severity: "medium" }));
    const problems = exerciseRuleViolations(
      auditExercise({ audit: audit({ findings: allDefects }) }),
    );

    expect(problems).toContain(
      "un AUDIT declara al menos un elemento correcto que parece sospechoso",
    );
  });

  it("los hallazgos repiten id", () => {
    const problems = exerciseRuleViolations(
      auditExercise({ audit: audit({ findings: withFinding(1, { id: "f1" }) }) }),
    );

    expect(problems).toContain("los hallazgos repiten id");
  });

  it("los hallazgos van ordenados por línea", () => {
    const [first, second, third] = findings();
    const problems = exerciseRuleViolations(
      auditExercise({ audit: audit({ findings: [second, first, third] }) }),
    );

    expect(problems).toContain("los hallazgos van ordenados por línea");
  });

  it("dos hallazgos pueden empezar en la misma línea", () => {
    const problems = exerciseRuleViolations(
      auditExercise({ audit: audit({ findings: withFinding(1, { lines: [2, 4] }) }) }),
    );

    expect(problems).toEqual([]);
  });

  it("cada defecto real declara severidad", () => {
    const problems = exerciseRuleViolations(
      auditExercise({ audit: audit({ findings: withFinding(0, { severity: null }) }) }),
    );

    expect(problems).toContain("cada defecto real declara severidad");
  });

  it("la severidad solo se declara en defectos reales", () => {
    const problems = exerciseRuleViolations(
      auditExercise({ audit: audit({ findings: withFinding(2, { severity: "low" }) }) }),
    );

    expect(problems).toContain("la severidad solo se declara en defectos reales");
  });

  it("las líneas de un hallazgo salen del artefacto o están al revés", () => {
    const reversed = exerciseRuleViolations(
      auditExercise({ audit: audit({ findings: withFinding(2, { lines: [5, 4] }) }) }),
    );
    const outside = exerciseRuleViolations(
      auditExercise({ audit: audit({ findings: withFinding(2, { lines: [6, 9] }) }) }),
    );

    expect(reversed).toContain("las líneas de un hallazgo salen del artefacto o están al revés");
    expect(outside).toContain("las líneas de un hallazgo salen del artefacto o están al revés");
  });

  it("un artefacto con defectos críticos o altos no se acepta", () => {
    const problems = exerciseRuleViolations(auditExercise({ audit: audit({ verdict: "accept" }) }));

    expect(problems).toContain("un artefacto con defectos críticos o altos no se acepta");
  });

  it("acepta el veredicto accept si los defectos son medios o bajos", () => {
    const mild = [
      finding({ severity: "medium" }),
      finding({ id: "f2", lines: [4, 4], severity: "low" }),
      finding({ id: "f3", lines: [5, 5], isDefect: false, severity: null }),
    ];
    const problems = exerciseRuleViolations(
      auditExercise({ audit: audit({ findings: mild, verdict: "accept" }) }),
    );

    expect(problems).toEqual([]);
  });

  it("rechaza una auditoría con menos de tres hallazgos", () => {
    expect(() => auditExercise({ audit: audit({ findings: findings().slice(0, 2) }) })).toThrow();
  });

  it("solo un LAB o DEBUG declara harness", () => {
    const problems = exerciseRuleViolations(
      exercise({
        type: "FLASHCARD",
        harness: "aws",
        language: null,
        starterCode: null,
        solution: null,
        tests: [],
        hints: [],
        flashcard: { back: "Respuesta" },
      }),
    );

    expect(problems).toContain("solo un LAB o DEBUG declara harness");
  });

  it("un ejercicio con harness se escribe en typescript o javascript", () => {
    const problems = exerciseRuleViolations(exercise({ harness: "aws", language: "sql" }));

    expect(problems).toContain("un ejercicio con harness se escribe en typescript o javascript");
  });

  it("acepta un LAB con harness en typescript y lo deja en null por defecto", () => {
    expect(exerciseRuleViolations(exercise({ harness: "aws", language: "typescript" }))).toEqual([]);
    expect(exercise().harness).toBeNull();
  });
});


describe("reglas de CLOUD_LAB", () => {
  const check = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "c1",
    label: "El presupuesto existe",
    phase: "build",
    command: "aws budgets describe-budgets",
    expect: [{ path: "Budgets[0].BudgetLimit.Amount", op: "equals", value: "5.0" }],
    ...overrides,
  });

  const cloudLab = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    region: "us-east-1",
    tag: "codeai-lab=presupuesto",
    cost: {
      expectedUsd: 0,
      freeTier: "Los dos primeros presupuestos son gratuitos",
      source: "https://aws.amazon.com/aws-cost-management/pricing/",
      checkedOn: "2026-11-11",
    },
    prerequisites: ["Cuenta de AWS de práctica"],
    steps: [{ title: "Crea el presupuesto", instructions: "Abre la consola de Billing." }],
    checks: [check(), check({ id: "c2", label: "El presupuesto ya no existe", phase: "cleanup" })],
    ...overrides,
  });

  const cloudLabExercise = (overrides: Record<string, unknown> = {}): ContentSeedExercise =>
    exercise({
      type: "CLOUD_LAB",
      language: null,
      starterCode: null,
      solution: null,
      hints: [],
      tests: [],
      cloudLab: cloudLab(),
      ...overrides,
    });

  it("acepta un CLOUD_LAB completo y deja cloudLab en null por defecto", () => {
    expect(exerciseRuleViolations(cloudLabExercise())).toEqual([]);
    expect(exercise().cloudLab).toBeNull();
  });

  it("un CLOUD_LAB requiere cloudLab", () => {
    expect(exerciseRuleViolations(cloudLabExercise({ cloudLab: null }))).toContain(
      "un CLOUD_LAB requiere cloudLab",
    );
  });

  it("solo un CLOUD_LAB declara cloudLab", () => {
    expect(exerciseRuleViolations(exercise({ cloudLab: cloudLab() }))).toContain(
      "solo un CLOUD_LAB declara cloudLab",
    );
  });

  it("un CLOUD_LAB declara al menos una comprobación de limpieza", () => {
    const problems = exerciseRuleViolations(cloudLabExercise({ cloudLab: cloudLab({ checks: [check()] }) }));

    expect(problems).toContain("un CLOUD_LAB declara al menos una comprobación de limpieza");
  });

  it("las comprobaciones repiten id", () => {
    const checks = [check(), check({ phase: "cleanup" })];

    expect(exerciseRuleViolations(cloudLabExercise({ cloudLab: cloudLab({ checks }) }))).toContain(
      "las comprobaciones repiten id",
    );
  });

  it("un CLOUD_LAB no lleva pistas ni pruebas", () => {
    const withHints = cloudLabExercise({ hints: [{ level: 1, text: "a" }] });
    const withTests = cloudLabExercise({
      tests: [{ name: "visible", isHidden: false, spec: { code: "assert.ok(true)" } }],
    });

    expect(exerciseRuleViolations(withHints)).toContain("un CLOUD_LAB no lleva pistas ni pruebas");
    expect(exerciseRuleViolations(withTests)).toContain("un CLOUD_LAB no lleva pistas ni pruebas");
  });

  it("un CLOUD_LAB no es de nivel autónomo", () => {
    expect(exerciseRuleViolations(cloudLabExercise({ ladder: "AUTONOMOUS" }))).toContain(
      "un CLOUD_LAB no es de nivel autónomo",
    );
  });

  it("rechaza comandos que no son de solo lectura, regiones y etiquetas mal formadas", () => {
    const bad = (overrides: Record<string, unknown>): boolean =>
      contentSeedCloudLabSchema.safeParse(cloudLab(overrides)).success;

    expect(bad({ checks: [check({ command: "aws budgets delete-budget" })] })).toBe(false);
    expect(bad({ checks: [check({ command: "aws s3 ls" })] })).toBe(false);
    expect(bad({ region: "useast1" })).toBe(false);
    expect(bad({ tag: "lab=presupuesto" })).toBe(false);
    expect(bad({ checks: [check({ id: "check1" })] })).toBe(false);
    expect(bad({ checks: [check({ expect: [{ path: "a", op: "contains" }] })] })).toBe(false);
    expect(bad({})).toBe(true);
  });
});
