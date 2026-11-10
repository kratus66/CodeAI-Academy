import { describe, expect, it } from "vitest";
import { aws, listCapabilities, selfTest } from "../index.js";
import {
  canary,
  capabilities,
  evaluate,
  matchesAction,
  matchesResource,
  validatePolicy,
} from "./index.js";
import type { EvaluationInput, PolicyDocument } from "./index.js";

const ACCOUNT = "123456789012";
const USER = `arn:aws:iam::${ACCOUNT}:user/ana`;
const ROLE = `arn:aws:iam::${ACCOUNT}:role/rol`;
const SESSION = `arn:aws:sts::${ACCOUNT}:assumed-role/rol/sesion`;
const OBJECT = "arn:aws:s3:::bucket/key";

const allowAll: PolicyDocument = {
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }],
};

function input(overrides: Partial<EvaluationInput> = {}, principal = USER): EvaluationInput {
  return {
    request: {
      principal: { arn: principal, accountId: ACCOUNT },
      action: "s3:GetObject",
      resource: { arn: OBJECT, accountId: ACCOUNT },
    },
    ...overrides,
  };
}

describe("iam: capacidades y registro", () => {
  it("aws expone iam y el arnés lo registra con su canario", () => {
    expect(aws.iam.capabilities).toBe(capabilities);
    expect(listCapabilities().map((item) => item.name)).toContain("iam");
    expect(canary()).toBe(true);
    expect(selfTest()).toBe(true);
  });

  it("declara lo que no modela y solo cita fuentes oficiales", () => {
    const notModeled = capabilities.notModeled.join(" ");
    for (const word of ["Condition", "NotPrincipal", "KMS", "ACL", "cuenta de administración"]) {
      expect(notModeled, word).toContain(word);
    }
    expect(capabilities.sources.length).toBeGreaterThan(5);
    expect(capabilities.sources.every((url) => url.startsWith("https://docs.aws.amazon.com/"))).toBe(
      true,
    );
  });
});

describe("iam: comodines", () => {
  it("* y ? se combinan, y un patrón vacío solo coincide con la cadena vacía", () => {
    expect(matchesAction("s3:Get*Acl", "s3:GetObjectAcl")).toBe(true);
    expect(matchesAction("s3:Get*Acl", "s3:GetObject")).toBe(false);
    expect(matchesAction("s3:??t*", "s3:GetObject")).toBe(true);
    expect(matchesAction("", "")).toBe(true);
    expect(matchesAction("", "s3:GetObject")).toBe(false);
  });

  it("el * puede coincidir con una cadena vacía y varios * seguidos equivalen a uno", () => {
    expect(matchesAction("s3:**", "s3:")).toBe(true);
    expect(matchesAction("s3:Get**Object", "s3:GetObject")).toBe(true);
  });

  it("los patrones con caracteres de expresión regular se tratan como texto", () => {
    expect(matchesResource("arn:aws:s3:::a.b", "arn:aws:s3:::aXb")).toBe(false);
    expect(matchesResource("arn:aws:s3:::a.b", "arn:aws:s3:::a.b")).toBe(true);
    expect(matchesResource("arn:aws:s3:::a(b)+", "arn:aws:s3:::a(b)+")).toBe(true);
  });

  it("los recursos distinguen mayúsculas y las acciones no", () => {
    expect(matchesResource("arn:aws:s3:::Bucket", "arn:aws:s3:::bucket")).toBe(false);
    expect(matchesAction("S3:GETOBJECT", "s3:GetObject")).toBe(true);
  });

  it("un patrón largo con muchos * termina rápido sobre una cadena que no coincide", () => {
    const pattern = `${"a*".repeat(30)}b`;
    expect(matchesResource(pattern, "a".repeat(200))).toBe(false);
  });
});

describe("iam: validatePolicy", () => {
  const valid = {
    Version: "2012-10-17",
    Id: "politica",
    Statement: [{ Sid: "Uno", Effect: "Allow", Action: "s3:*", Resource: "*" }],
  };

  it("acepta una política válida con una sentencia suelta o en lista", () => {
    expect(validatePolicy(valid)).toEqual([]);
    expect(validatePolicy({ Statement: valid.Statement[0] })).toEqual([]);
  });

  it("rechaza lo que no es un objeto", () => {
    for (const value of [null, undefined, 5, "texto", [], true]) {
      expect(validatePolicy(value), String(value)).toEqual(["La política debe ser un objeto JSON."]);
    }
  });

  it("detecta Statement ausente o vacío, Version y elementos desconocidos", () => {
    expect(validatePolicy({ Version: "2012-10-17" })).toContain("Falta el elemento Statement.");
    expect(validatePolicy({ Statement: [] })).toContain(
      "Statement debe contener al menos una sentencia.",
    );
    expect(validatePolicy({ ...valid, Version: "2020-01-01" })).toContain(
      'Version debe ser "2008-10-17" o "2012-10-17".',
    );
    expect(validatePolicy({ ...valid, Extra: 1 }).join(" ")).toContain("«Extra»");
  });

  it("detecta problemas en las sentencias", () => {
    const cases: [unknown, string][] = [
      [{ Effect: "allow", Action: "s3:*", Resource: "*" }, "Effect"],
      [{ Effect: "Allow", Resource: "*" }, "Action o NotAction"],
      [{ Effect: "Allow", Action: "s3:*", NotAction: "s3:Get*", Resource: "*" }, "Action o NotAction"],
      [{ Effect: "Allow", Action: "s3:*" }, "Resource o NotResource"],
      [{ Effect: "Allow", Action: "s3", Resource: "*" }, "servicio:acción"],
      [{ Effect: "Allow", Action: [], Resource: "*" }, "no vacía"],
      [{ Effect: "Allow", Action: [1], Resource: "*" }, "debe ser una cadena"],
      [{ Sid: "con espacio", Effect: "Allow", Action: "s3:*", Resource: "*" }, "Sid"],
      [{ Effect: "Allow", Action: "s3:*", Resource: "*", Condition: "x" }, "Condition"],
      [{ Effect: "Allow", Action: "s3:*", Resource: "*", Condition: { Bool: "x" } }, "Bool"],
      [
        { Effect: "Allow", Action: "s3:*", Resource: "*", Principal: "*", NotPrincipal: "*" },
        "Principal y NotPrincipal",
      ],
      [{ Effect: "Allow", Action: "s3:*", Resource: "*", Principal: { Otro: "x" } }, "Otro"],
      [{ Effect: "Allow", Action: "s3:*", Resource: "*", Extra: 1 }, "Extra"],
      ["no es objeto", "debe ser un objeto"],
    ];
    for (const [statement, expected] of cases) {
      const problems = validatePolicy({ Statement: [statement] });
      expect(problems.join(" | "), JSON.stringify(statement)).toContain(expected);
    }
  });

  it("acepta Principal con * o con un mapa, y NotAction y NotResource", () => {
    expect(
      validatePolicy({
        Statement: [
          { Effect: "Allow", Principal: "*", NotAction: "iam:*", NotResource: "arn:aws:s3:::x" },
          { Effect: "Deny", Principal: { AWS: ["123456789012"] }, Action: "*", Resource: "*" },
        ],
      }),
    ).toEqual([]);
  });
});

describe("iam: entradas inválidas (nunca lanzan)", () => {
  const invalid: unknown[] = [
    undefined,
    null,
    5,
    "texto",
    {},
    { request: null },
    { request: {} },
    { request: { principal: USER, action: "s3:GetObject", resource: OBJECT } },
    {
      request: {
        principal: { arn: USER, accountId: ACCOUNT },
        action: "",
        resource: { arn: OBJECT, accountId: ACCOUNT },
      },
    },
  ];

  it("devuelve ImplicitDeny con un motivo en español", () => {
    for (const value of invalid) {
      const result = evaluate(value as EvaluationInput);
      expect(result.decision, JSON.stringify(value)).toBe("ImplicitDeny");
      expect(result.reason).toContain("Entrada no válida");
      expect(result.matched).toEqual([]);
    }
  });

  it("una política mal formada produce ImplicitDeny y no se ignora en silencio", () => {
    const broken = { Statement: [{ Effect: "Deny", Resource: "*" }] } as unknown as PolicyDocument;
    const result = evaluate(input({ identityPolicies: [allowAll, broken] }));
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).toContain("identityPolicies[1]");
  });

  it("las listas con tipos equivocados no lanzan", () => {
    const bad = {
      identityPolicies: "x",
      scps: [5],
      rcps: "x",
      sessionPolicies: {},
    } as unknown as Partial<EvaluationInput>;
    expect(evaluate(input(bad)).decision).toBe("ImplicitDeny");
    expect(evaluate(input({ scps: [[null as unknown as PolicyDocument]] })).decision).toBe(
      "ImplicitDeny",
    );
    expect(
      evaluate(input({ identityPolicies: [undefined as unknown as PolicyDocument] })).decision,
    ).toBe("ImplicitDeny");
  });

  it("un principal que no es usuario, rol ni sesión de rol no está modelado", () => {
    for (const arn of [
      `arn:aws:iam::${ACCOUNT}:root`,
      `arn:aws:sts::${ACCOUNT}:federated-user/ana`,
      "s3.amazonaws.com",
    ]) {
      const result = evaluate(input({ identityPolicies: [allowAll] }, arn));
      expect(result.decision, arn).toBe("ImplicitDeny");
      expect(result.reason, arn).toContain("no modelado");
    }
  });

  it("si la cuenta del ARN del principal no coincide con accountId, avisa", () => {
    const result = evaluate({
      request: {
        principal: { arn: USER, accountId: "999999999999" },
        action: "s3:GetObject",
        resource: { arn: OBJECT, accountId: ACCOUNT },
      },
      identityPolicies: [allowAll],
    });
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).toContain("no coincide");
  });
});

describe("iam: evaluación", () => {
  it("es determinista y no modifica la entrada", () => {
    const value = input({ identityPolicies: [allowAll] });
    const snapshot = JSON.stringify(value);
    const first = evaluate(value);
    const second = evaluate(value);
    expect(first).toEqual(second);
    expect(JSON.stringify(value)).toBe(snapshot);
  });

  it("las listas vacías de SCP y RCP equivalen a no tener Organizations", () => {
    expect(evaluate(input({ identityPolicies: [allowAll], scps: [], rcps: [] })).decision).toBe(
      "Allow",
    );
  });

  it("un nivel de SCP con una lista vacía de políticas deniega de forma implícita", () => {
    const result = evaluate(input({ identityPolicies: [allowAll], scps: [[allowAll], []] }));
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).toContain("SCP");
  });

  it("una denegación explícita en una SCP gana aunque la identidad permita", () => {
    const deny: PolicyDocument = {
      Statement: { Sid: "Bloqueo", Effect: "Deny", Action: "s3:*", Resource: "*" },
    };
    const result = evaluate(input({ identityPolicies: [allowAll], scps: [[allowAll, deny]] }));
    expect(result.decision).toBe("ExplicitDeny");
    expect(result.matched).toEqual([{ source: "scps[0][1]", sid: "Bloqueo" }]);
  });

  it("una SCP sin Allow bloquea incluso una concesión directa de la política de recurso", () => {
    const result = evaluate(
      input({
        scps: [[{ Statement: { Effect: "Allow", Action: "ec2:*", Resource: "*" } }]],
        resourcePolicy: {
          Statement: { Effect: "Allow", Principal: { AWS: USER }, Action: "s3:*", Resource: "*" },
        },
      }),
    );
    expect(result.decision).toBe("ImplicitDeny");
  });

  it("la política de recurso con Principal * en la misma cuenta se limita por el límite de permisos", () => {
    const resourcePolicy: PolicyDocument = {
      Statement: { Effect: "Allow", Principal: "*", Action: "s3:*", Resource: "*" },
    };
    const boundary: PolicyDocument = {
      Statement: { Effect: "Allow", Action: "ec2:*", Resource: "*" },
    };
    expect(evaluate(input({ resourcePolicy })).decision).toBe("Allow");
    expect(evaluate(input({ resourcePolicy, permissionsBoundary: boundary })).decision).toBe(
      "ImplicitDeny",
    );
  });

  it("la cuenta como principal (ID corto o ARN raíz) delega en la identidad", () => {
    for (const principal of [ACCOUNT, `arn:aws:iam::${ACCOUNT}:root`]) {
      const resourcePolicy: PolicyDocument = {
        Statement: { Effect: "Allow", Principal: { AWS: principal }, Action: "s3:*", Resource: "*" },
      };
      expect(evaluate(input({ resourcePolicy }, ROLE)).decision, principal).toBe("Allow");
    }
    const otherAccount: PolicyDocument = {
      Statement: {
        Effect: "Allow",
        Principal: { AWS: "111111111111" },
        Action: "s3:*",
        Resource: "*",
      },
    };
    expect(evaluate(input({ resourcePolicy: otherAccount })).decision).toBe("ImplicitDeny");
  });

  it("los principales Service, Federated y CanonicalUser no coinciden con un usuario IAM", () => {
    const resourcePolicy: PolicyDocument = {
      Statement: {
        Effect: "Allow",
        Principal: { Service: "s3.amazonaws.com", CanonicalUser: "abc" },
        Action: "s3:*",
        Resource: "*",
      },
    };
    expect(evaluate(input({ resourcePolicy })).decision).toBe("ImplicitDeny");
  });

  it("una sentencia de recurso sin Principal no concede nada", () => {
    const resourcePolicy: PolicyDocument = {
      Statement: { Effect: "Allow", Action: "s3:*", Resource: "*" },
    };
    expect(evaluate(input({ resourcePolicy })).decision).toBe("ImplicitDeny");
  });

  it("el principal que es un rol (sin sesión) no recibe políticas de sesión", () => {
    const session: PolicyDocument = {
      Statement: { Effect: "Allow", Action: "ec2:*", Resource: "*" },
    };
    expect(
      evaluate(input({ identityPolicies: [allowAll], sessionPolicies: [session] }, ROLE)).decision,
    ).toBe("Allow");
    expect(
      evaluate(input({ identityPolicies: [allowAll], sessionPolicies: [session] }, SESSION)).decision,
    ).toBe("ImplicitDeny");
  });

  it("la sesión se reconoce como el rol en la política de recurso, también con otra partición", () => {
    const china = "arn:aws-cn:sts::123456789012:assumed-role/rol/sesion";
    const resourcePolicy: PolicyDocument = {
      Statement: {
        Effect: "Allow",
        Principal: { AWS: "arn:aws-cn:iam::123456789012:role/rol" },
        Action: "s3:*",
        Resource: "*",
      },
    };
    expect(evaluate(input({ resourcePolicy }, china)).decision).toBe("Allow");
  });

  it("en solicitudes entre cuentas la identidad del principal necesita también el límite y la sesión", () => {
    const resourcePolicy: PolicyDocument = {
      Statement: { Effect: "Allow", Principal: { AWS: SESSION }, Action: "s3:*", Resource: "*" },
    };
    const request = {
      principal: { arn: SESSION, accountId: ACCOUNT },
      action: "s3:GetObject",
      resource: { arn: OBJECT, accountId: "222222222222" },
    };
    const boundary: PolicyDocument = {
      Statement: { Effect: "Allow", Action: "ec2:*", Resource: "*" },
    };
    expect(evaluate({ request, identityPolicies: [allowAll], resourcePolicy }).decision).toBe(
      "Allow",
    );
    expect(
      evaluate({
        request,
        identityPolicies: [allowAll],
        resourcePolicy,
        permissionsBoundary: boundary,
      }).decision,
    ).toBe("ImplicitDeny");
  });
});

describe("iam: condiciones y NotPrincipal", () => {
  const conditional = (effect: "Allow" | "Deny", action = "s3:*"): PolicyDocument => ({
    Statement: {
      Sid: "Cond",
      Effect: effect,
      Action: action,
      Resource: "*",
      Condition: { Bool: { "aws:SecureTransport": "true" } },
    },
  });

  it("una Allow con condición y la clave ausente no aplica: denegación implícita normal", () => {
    const result = evaluate(input({ identityPolicies: [conditional("Allow")] }));
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).toBe(
      "Ninguna política de identidad ni de recurso permite la acción: denegación implícita.",
    );
    expect(result.matched).toEqual([]);
  });

  it("la misma Allow con la clave en el contexto y verdadera concede el permiso", () => {
    const withContext = input({ identityPolicies: [conditional("Allow")] });
    withContext.request.context = { "aws:SecureTransport": true };
    const result = evaluate(withContext);
    expect(result.decision).toBe("Allow");
    expect(result.matched).toEqual([{ source: "identityPolicies[0]", sid: "Cond" }]);
    withContext.request.context = { "aws:SecureTransport": false };
    expect(evaluate(withContext).decision).toBe("ImplicitDeny");
  });

  it("una Allow con condición que no se aplica a la acción no cambia el motivo normal", () => {
    const result = evaluate(input({ identityPolicies: [conditional("Allow", "ec2:*")] }));
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).not.toContain("condiciones");
  });

  it("una Deny con condición y la clave ausente no aplica: la acción sigue permitida", () => {
    const result = evaluate(input({ identityPolicies: [allowAll, conditional("Deny")] }));
    expect(result.decision).toBe("Allow");
  });

  it("la misma Deny con la clave en el contexto y verdadera deniega explícitamente", () => {
    const withContext = input({ identityPolicies: [allowAll, conditional("Deny")] });
    withContext.request.context = { "aws:SecureTransport": "true" };
    const result = evaluate(withContext);
    expect(result.decision).toBe("ExplicitDeny");
    expect(result.matched).toEqual([{ source: "identityPolicies[1]", sid: "Cond" }]);
  });

  it("un operador fuera del subconjunto impide evaluar la sentencia y nunca se considera verdadero", () => {
    const unmodeled: PolicyDocument = {
      Statement: {
        Sid: "Raro",
        Effect: "Allow",
        Action: "s3:*",
        Resource: "*",
        Condition: { NumericNotEquals: { "s3:max-keys": "10" } },
      },
    };
    const result = evaluate(input({ identityPolicies: [unmodeled] }));
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).toBe("Operador no modelado: NumericNotEquals");
  });

  it("una Deny con condición no cambia una denegación implícita que ya existía", () => {
    const result = evaluate(input({ identityPolicies: [conditional("Deny")] }));
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).not.toContain("condiciones");
  });

  it("una Allow sin condición hace innecesaria la condicionada, y una Deny sin condición manda", () => {
    expect(
      evaluate(input({ identityPolicies: [allowAll, conditional("Allow")] })).decision,
    ).toBe("Allow");
    const unconditionalDeny: PolicyDocument = {
      Statement: { Effect: "Deny", Action: "s3:*", Resource: "*" },
    };
    expect(
      evaluate(input({ identityPolicies: [allowAll, conditional("Deny"), unconditionalDeny] }))
        .decision,
    ).toBe("ExplicitDeny");
  });

  it("NotPrincipal no está modelado: si decide, el resultado es ImplicitDeny con su motivo", () => {
    const resourcePolicy: PolicyDocument = {
      Statement: {
        Effect: "Allow",
        NotPrincipal: { AWS: "111111111111" },
        Action: "s3:*",
        Resource: "*",
      },
    };
    const result = evaluate(input({ resourcePolicy }));
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).toBe("La sentencia usa NotPrincipal: no está modelado");
  });
});
