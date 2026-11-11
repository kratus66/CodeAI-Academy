import type { CloudEvidenceInput } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import {
  CREDENTIALS_DETECTED,
  evaluateCloudEvidence,
  invalidJson,
  maskIdentifiers,
  missingEvidence,
  unknownCheck,
} from "./cloud-evidence";

const config = {
  region: "us-east-1",
  checks: [
    { id: "c1", label: "Presupuesto creado", phase: "build", command: "aws budgets describe-budgets" },
    { id: "c2", label: "Recursos eliminados", phase: "cleanup", command: "aws s3api list-buckets" },
  ],
};

const solution = {
  checks: [
    {
      id: "c1",
      expect: [
        { path: "Budgets[0].BudgetLimit.Amount", op: "equals", value: "5.0" },
        { path: "Budgets[0].BudgetName", op: "matches", value: "^codeai-" },
      ],
    },
    { id: "c2", expect: [{ path: "Buckets", op: "lengthEquals", value: 0 }] },
  ],
};

const GOOD_C1 = JSON.stringify({
  Budgets: [{ BudgetName: "codeai-lab", BudgetLimit: { Amount: "5.0", Unit: "USD" } }],
});
const GOOD_C2 = JSON.stringify({ Buckets: [] });

function body(
  evidence: Array<{ checkId: string; output: string }>,
  cleanupConfirmed = true,
): CloudEvidenceInput {
  return { evidence, cleanupConfirmed };
}

function single(
  expectation: { path: string; op: string; value?: unknown },
  output: string,
): boolean {
  const outcome = evaluateCloudEvidence(
    { checks: [{ id: "c1", expect: [expectation] }] },
    { checks: [{ id: "c1", label: "Uno", phase: "build", command: "aws x get-y" }] },
    body([{ checkId: "c1", output }]),
  );
  if (outcome.status !== "graded") throw new Error("se esperaba graded");
  return outcome.result.checks[0]?.passed ?? false;
}

describe("evaluateCloudEvidence · resultado", () => {
  it("PASSED si pasan todas las comprobaciones y se confirmó la limpieza", () => {
    const outcome = evaluateCloudEvidence(
      solution,
      config,
      body([
        { checkId: "c1", output: GOOD_C1 },
        { checkId: "c2", output: GOOD_C2 },
      ]),
    );
    expect(outcome.status).toBe("graded");
    if (outcome.status !== "graded") return;
    expect(outcome.result.outcome).toBe("PASSED");
    expect(outcome.result.checks.every((check) => check.passed)).toBe(true);
    expect(outcome.result.cleanupConfirmed).toBe(true);
  });

  it("PARTIAL si todo pasa pero la limpieza no está confirmada", () => {
    const outcome = evaluateCloudEvidence(
      solution,
      config,
      body(
        [
          { checkId: "c1", output: GOOD_C1 },
          { checkId: "c2", output: GOOD_C2 },
        ],
        false,
      ),
    );
    expect(outcome.status === "graded" && outcome.result.outcome).toBe("PARTIAL");
  });

  it("PARTIAL si pasa alguna comprobación y FAILED si no pasa ninguna", () => {
    const partial = evaluateCloudEvidence(
      solution,
      config,
      body([
        { checkId: "c1", output: GOOD_C1 },
        { checkId: "c2", output: JSON.stringify({ Buckets: [{}] }) },
      ]),
    );
    expect(partial.status === "graded" && partial.result.outcome).toBe("PARTIAL");
    const failed = evaluateCloudEvidence(
      solution,
      config,
      body([
        { checkId: "c1", output: "{}" },
        { checkId: "c2", output: JSON.stringify({ Buckets: [{}] }) },
      ]),
    );
    expect(failed.status === "graded" && failed.result.outcome).toBe("FAILED");
  });

  it("una comprobación sin evidencia no pasa y lo dice", () => {
    const outcome = evaluateCloudEvidence(solution, config, body([{ checkId: "c1", output: GOOD_C1 }]));
    expect(outcome.status).toBe("graded");
    if (outcome.status !== "graded") return;
    expect(outcome.result.outcome).toBe("PARTIAL");
    expect(outcome.result.checks[1]?.problems).toEqual([missingEvidence("c2")]);
  });
});

describe("evaluateCloudEvidence · operadores", () => {
  it("equals: igualdad estricta, números y cadenas no se mezclan", () => {
    expect(single({ path: "a", op: "equals", value: 5 }, '{"a":5}')).toBe(true);
    expect(single({ path: "a", op: "equals", value: 5 }, '{"a":"5"}')).toBe(false);
    expect(single({ path: "a", op: "equals", value: "x" }, '{"a":"x"}')).toBe(true);
    expect(single({ path: "a", op: "equals", value: null }, '{"a":null}')).toBe(true);
    expect(single({ path: "a", op: "equals", value: { b: [1, 2] } }, '{"a":{"b":[1,2]}}')).toBe(true);
    expect(single({ path: "a", op: "equals", value: { b: [1, 2] } }, '{"a":{"b":[2,1]}}')).toBe(false);
  });

  it("exists y absent", () => {
    expect(single({ path: "a.b", op: "exists" }, '{"a":{"b":false}}')).toBe(true);
    expect(single({ path: "a.b", op: "exists" }, '{"a":{}}')).toBe(false);
    expect(single({ path: "a.b", op: "absent" }, '{"a":{}}')).toBe(true);
    expect(single({ path: "a.b", op: "absent" }, '{"a":{"b":1}}')).toBe(false);
  });

  it("matches: expresión regular sobre cadenas y números; otros tipos no pasan", () => {
    expect(single({ path: "a", op: "matches", value: "^arn:aws:s3" }, '{"a":"arn:aws:s3:::x"}')).toBe(true);
    expect(single({ path: "a", op: "matches", value: "^arn:aws:s3" }, '{"a":"otra"}')).toBe(false);
    expect(single({ path: "a", op: "matches", value: "^\\d+$" }, '{"a":42}')).toBe(true);
    expect(single({ path: "a", op: "matches", value: ".*" }, '{"a":[1]}')).toBe(false);
    expect(single({ path: "a", op: "matches", value: ".*" }, "{}")).toBe(false);
  });

  it("lengthAtLeast y lengthEquals sobre arrays y cadenas", () => {
    expect(single({ path: "a", op: "lengthAtLeast", value: 2 }, '{"a":[1,2,3]}')).toBe(true);
    expect(single({ path: "a", op: "lengthAtLeast", value: 4 }, '{"a":[1,2,3]}')).toBe(false);
    expect(single({ path: "a", op: "lengthAtLeast", value: 2 }, '{"a":"ab"}')).toBe(true);
    expect(single({ path: "a", op: "lengthEquals", value: 3 }, '{"a":[1,2,3]}')).toBe(true);
    expect(single({ path: "a", op: "lengthEquals", value: 2 }, '{"a":[1,2,3]}')).toBe(false);
    expect(single({ path: "a", op: "lengthEquals", value: 2 }, '{"a":"ab"}')).toBe(true);
    expect(single({ path: "a", op: "lengthEquals", value: 1 }, '{"a":5}')).toBe(false);
    expect(single({ path: "a", op: "lengthEquals", value: 0 }, "{}")).toBe(false);
  });

  it("lee caminos con índices, también al inicio, y un camino inexistente es undefined", () => {
    expect(single({ path: "[1].k", op: "equals", value: "v" }, '[{"k":"u"},{"k":"v"}]')).toBe(true);
    expect(single({ path: "a[0][1]", op: "equals", value: 9 }, '{"a":[[1,9]]}')).toBe(true);
    expect(single({ path: "a[5]", op: "absent" }, '{"a":[1]}')).toBe(true);
    expect(single({ path: "a.b.c", op: "absent" }, '{"a":1}')).toBe(true);
    expect(single({ path: "toString", op: "absent" }, "{}")).toBe(true);
  });

  it("el problema no revela el valor leído ni el esperado", () => {
    const outcome = evaluateCloudEvidence(
      solution,
      config,
      body([{ checkId: "c1", output: JSON.stringify({ Budgets: [{ BudgetLimit: { Amount: "99.9" } }] }) }]),
    );
    expect(outcome.status).toBe("graded");
    if (outcome.status !== "graded") return;
    const text = JSON.stringify(outcome.result);
    expect(text).not.toContain("99.9");
    expect(text).not.toContain("5.0");
    expect(outcome.result.checks[0]?.problems).toContain(
      "No se cumple «matches» en Budgets[0].BudgetName",
    );
  });
});

describe("evaluateCloudEvidence · respuesta inválida", () => {
  it("una salida que no es JSON da invalid-answer con el id de la comprobación", () => {
    const outcome = evaluateCloudEvidence(
      solution,
      config,
      body([
        { checkId: "c1", output: GOOD_C1 },
        { checkId: "c2", output: "no es json" },
      ]),
    );
    expect(outcome).toEqual({ status: "invalid-answer", message: invalidJson("c2") });
    expect(invalidJson("c2")).toBe("La salida de la comprobación c2 no es JSON válido");
  });

  it("una comprobación desconocida o repetida es invalid-answer", () => {
    expect(evaluateCloudEvidence(solution, config, body([{ checkId: "c9", output: "{}" }]))).toEqual({
      status: "invalid-answer",
      message: unknownCheck("c9"),
    });
    const repeated = evaluateCloudEvidence(
      solution,
      config,
      body([
        { checkId: "c1", output: "{}" },
        { checkId: "c1", output: "{}" },
      ]),
    );
    expect(repeated.status).toBe("invalid-answer");
  });

  it("las credenciales cortan antes de evaluar, aunque otra salida no sea JSON", () => {
    const withKey = evaluateCloudEvidence(
      solution,
      config,
      body([
        { checkId: "c1", output: "no es json" },
        { checkId: "c2", output: '{"AccessKeyId":"AKIAIOSFODNN7EXAMPLE"}' },
      ]),
    );
    expect(withKey).toEqual({ status: "invalid-answer", message: CREDENTIALS_DETECTED });
    expect(CREDENTIALS_DETECTED).toBe("La evidencia parece contener credenciales: no la envíes");
    const withSecret = evaluateCloudEvidence(
      solution,
      config,
      body([{ checkId: "c1", output: '{"x":"aws_secret_access_key"}' }]),
    );
    expect(withSecret).toEqual({ status: "invalid-answer", message: CREDENTIALS_DETECTED });
  });
});

describe("evaluateCloudEvidence · contenido roto", () => {
  const input = body([{ checkId: "c1", output: GOOD_C1 }]);
  const brokenOne = (expectation: unknown) =>
    evaluateCloudEvidence(
      { checks: [{ id: "c1", expect: [expectation] }] },
      { checks: [{ id: "c1", label: "Uno", phase: "build", command: "aws x get-y" }] },
      input,
    );

  it("config o solution que no son objetos, o sin checks", () => {
    expect(evaluateCloudEvidence(null, config, input)).toEqual({ status: "broken-content" });
    expect(evaluateCloudEvidence(solution, "texto", input)).toEqual({ status: "broken-content" });
    expect(evaluateCloudEvidence({}, config, input)).toEqual({ status: "broken-content" });
    expect(evaluateCloudEvidence(solution, { checks: [] }, input)).toEqual({ status: "broken-content" });
  });

  it("una comprobación de config sin su solución, o con ids repetidos", () => {
    expect(
      evaluateCloudEvidence({ checks: [solution.checks[0]] }, config, input),
    ).toEqual({ status: "broken-content" });
    expect(
      evaluateCloudEvidence(solution, { checks: [config.checks[0], config.checks[0]] }, input),
    ).toEqual({ status: "broken-content" });
  });

  it("una comprobación de config mal formada", () => {
    const bad = { checks: [{ id: "c1", label: "Uno", phase: "otra", command: "aws x get-y" }] };
    expect(evaluateCloudEvidence({ checks: [solution.checks[0]] }, bad, input)).toEqual({
      status: "broken-content",
    });
  });

  it("expectativas mal formadas", () => {
    expect(brokenOne({ path: "a", op: "inventado" }).status).toBe("broken-content");
    expect(brokenOne({ path: "", op: "exists" }).status).toBe("broken-content");
    expect(brokenOne({ path: "a..b", op: "exists" }).status).toBe("broken-content");
    expect(brokenOne({ path: "a[x]", op: "exists" }).status).toBe("broken-content");
    expect(brokenOne({ path: "a", op: "equals" }).status).toBe("broken-content");
    expect(brokenOne({ path: "a", op: "lengthEquals", value: "2" }).status).toBe("broken-content");
    expect(brokenOne({ path: "a", op: "lengthAtLeast", value: -1 }).status).toBe("broken-content");
    expect(brokenOne({ path: "a", op: "matches", value: 5 }).status).toBe("broken-content");
  });

  it("una expresión regular inválida es contenido roto", () => {
    expect(brokenOne({ path: "a", op: "matches", value: "([" }).status).toBe("broken-content");
  });
});

describe("maskIdentifiers", () => {
  it("enmascara números de 12 dígitos y los ARN, sin tocar otros números", () => {
    expect(maskIdentifiers("cuenta 123456789012 y 1234567890123 y 12345678901")).toBe(
      "cuenta ************ y 1234567890123 y 12345678901",
    );
    expect(maskIdentifiers("arn:aws:iam::123456789012:role/Admin")).toBe(
      "arn:aws:iam::************:role/Admin",
    );
    expect(maskIdentifiers("arn:aws:sns:us-east-1:210987654321:alertas")).toBe(
      "arn:aws:sns:us-east-1:************:alertas",
    );
  });

  it("elimina ids de acceso", () => {
    expect(maskIdentifiers("clave AKIAIOSFODNN7EXAMPLE fin")).toBe("clave [credencial eliminada] fin");
  });

  it("una salida real anonimizada queda sin cuentas ni ARN con cuenta", () => {
    const output = JSON.stringify({
      Account: "123456789012",
      Arn: "arn:aws:iam::123456789012:user/estudiante",
      UserId: "AIDACKCEVSQ6C2EXAMPLE",
      Topics: ["arn:aws:sns:us-east-1:123456789012:presupuesto"],
    });
    const masked = maskIdentifiers(output);
    expect(masked).not.toMatch(/\d{12}/);
    expect(masked).toContain("arn:aws:iam::************:user/estudiante");
    expect(masked).toContain("arn:aws:sns:us-east-1:************:presupuesto");
  });
});

describe("evaluateCloudEvidence · lo que se guarda y se muestra", () => {
  const MARKER = "MARCADOR-SECRETO-123";

  it("storedSummary solo lleva checkId, passed y el número de problemas, sin la salida", () => {
    const outcome = evaluateCloudEvidence(
      solution,
      config,
      body([
        {
          checkId: "c1",
          output: JSON.stringify({ Budgets: [{ BudgetName: MARKER, Cuenta: "123456789012" }], [MARKER]: 1 }),
        },
        { checkId: "c2", output: JSON.stringify({ Buckets: [MARKER] }) },
      ]),
    );
    expect(outcome.status).toBe("graded");
    if (outcome.status !== "graded") return;
    expect(outcome.storedSummary).not.toContain(MARKER);
    expect(outcome.storedSummary).not.toContain("123456789012");
    expect(outcome.result.maskedSummary).not.toContain(MARKER);
    expect(JSON.stringify(outcome.result)).not.toContain(MARKER);
    expect(JSON.parse(outcome.storedSummary)).toEqual([
      { checkId: "c1", passed: false, problems: 2 },
      { checkId: "c2", passed: false, problems: 1 },
    ]);
  });

  it("maskedSummary no contiene números de cuenta ni ARN con cuenta", () => {
    const outcome = evaluateCloudEvidence(
      solution,
      { checks: [{ ...config.checks[0], label: "Cuenta 123456789012 arn:aws:iam::123456789012:root" }] },
      body([{ checkId: "c1", output: "{}" }]),
    );
    expect(outcome.status).toBe("graded");
    if (outcome.status !== "graded") return;
    expect(outcome.result.maskedSummary).not.toMatch(/\d{12}/);
  });
});
