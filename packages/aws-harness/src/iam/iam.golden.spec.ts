import { describe, expect, it } from "vitest";
import { evaluate, matchesAction, matchesResource, validatePolicy } from "./index.js";
import type { EvaluationInput, PolicyDocument } from "./index.js";

const ACCOUNT = "123456789012";
const CARLOS = `arn:aws:iam::${ACCOUNT}:user/carlossalazar`;
const FULL_ACCESS: PolicyDocument = {
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }],
};

function policy(...statements: PolicyDocument["Statement"][]): PolicyDocument {
  return { Version: "2012-10-17", Statement: statements.flat() };
}

function request(
  principalArn: string,
  action: string,
  resourceArn: string,
  principalAccount = ACCOUNT,
  resourceAccount = ACCOUNT,
): EvaluationInput["request"] {
  return {
    principal: { arn: principalArn, accountId: principalAccount },
    action,
    resource: { arn: resourceArn, accountId: resourceAccount },
  };
}

const CARLOS_IDENTITY = policy([
  {
    Sid: "AllowS3ListRead",
    Effect: "Allow",
    Action: [
      "s3:GetBucketLocation",
      "s3:GetAccountPublicAccessBlock",
      "s3:ListAccessPoints",
      "s3:ListAllMyBuckets",
    ],
    Resource: "arn:aws:s3:::*",
  },
  {
    Sid: "AllowS3Self",
    Effect: "Allow",
    Action: "s3:*",
    Resource: [
      "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/*",
      "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar",
    ],
  },
  { Sid: "DenyS3Logs", Effect: "Deny", Action: "s3:*", Resource: "arn:aws:s3:::*log*" },
]);

const CARLOS_BUCKET_POLICY = policy([
  {
    Effect: "Allow",
    Principal: { AWS: CARLOS },
    Action: "s3:*",
    Resource: [
      "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/*",
      "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar",
    ],
  },
]);

describe("iam: misma cuenta, identidad y recurso", () => {
  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-basics.html
  it("Carlos guarda un archivo en el bucket de logs: la política de identidad lo deniega de forma explícita", () => {
    const result = evaluate({
      request: request(CARLOS, "s3:PutObject", "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar-logs/a.txt"),
      identityPolicies: [CARLOS_IDENTITY],
      resourcePolicy: CARLOS_BUCKET_POLICY,
    });
    expect(result.decision).toBe("ExplicitDeny");
    expect(result.matched).toContainEqual({ source: "identityPolicies[0]", sid: "DenyS3Logs" });
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-basics.html
  it("Carlos guarda un archivo en su bucket: la política de identidad y la de recurso lo permiten", () => {
    const result = evaluate({
      request: request(CARLOS, "s3:PutObject", "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/a.txt"),
      identityPolicies: [CARLOS_IDENTITY],
      resourcePolicy: CARLOS_BUCKET_POLICY,
    });
    expect(result.decision).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-basics.html
  it("si una política permite y la otra no, la solicitud sigue permitida", () => {
    const onlyIdentity = evaluate({
      request: request(CARLOS, "s3:PutObject", "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/a.txt"),
      identityPolicies: [CARLOS_IDENTITY],
    });
    const onlyResource = evaluate({
      request: request(CARLOS, "s3:PutObject", "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/a.txt"),
      resourcePolicy: CARLOS_BUCKET_POLICY,
    });
    expect(onlyIdentity.decision).toBe("Allow");
    expect(onlyResource.decision).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-basics.html
  it("si cualquiera de las dos políticas deniega de forma explícita, se deniega la solicitud", () => {
    const bucketPolicyWithDeny = policy([
      {
        Effect: "Allow",
        Principal: { AWS: CARLOS },
        Action: "s3:*",
        Resource: "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/*",
      },
      {
        Effect: "Deny",
        Principal: { AWS: CARLOS },
        Action: "s3:PutObject",
        Resource: "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/*",
      },
    ]);
    const result = evaluate({
      request: request(CARLOS, "s3:PutObject", "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/a.txt"),
      identityPolicies: [CARLOS_IDENTITY],
      resourcePolicy: bucketPolicyWithDeny,
    });
    expect(result.decision).toBe("ExplicitDeny");
    expect(result.matched).toContainEqual({ source: "resourcePolicy" });
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html
  it("por defecto todas las solicitudes se deniegan de forma implícita", () => {
    const result = evaluate({
      request: request(CARLOS, "s3:PutObject", "arn:aws:s3:::amzn-s3-demo-bucket-carlossalazar/a.txt"),
    });
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.matched).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html
  it("una denegación explícita prevalece sobre un permiso explícito", () => {
    const result = evaluate({
      request: request(CARLOS, "s3:GetObject", "arn:aws:s3:::any-bucket/key"),
      identityPolicies: [
        policy([
          { Sid: "Permiso", Effect: "Allow", Action: "s3:*", Resource: "*" },
          { Sid: "Bloqueo", Effect: "Deny", Action: "s3:GetObject", Resource: "*" },
        ]),
      ],
    });
    expect(result.decision).toBe("ExplicitDeny");
  });
});

describe("iam: denegación explícita frente a implícita", () => {
  const readOnlyIam = policy([
    {
      Sid: "AllowGetList",
      Effect: "Allow",
      Action: ["iam:Get*", "iam:List*"],
      Resource: "*",
    },
    { Sid: "DenyReports", Effect: "Deny", Action: "iam:*Report", Resource: "*" },
  ]);
  const iamRequest = (action: string): EvaluationInput["request"] =>
    request(CARLOS, action, "*");

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_AccessPolicyLanguage_Interplay.html
  it("iam:GetUser está permitida por iam:Get*", () => {
    expect(
      evaluate({ request: iamRequest("iam:GetUser"), identityPolicies: [readOnlyIam] }).decision,
    ).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_AccessPolicyLanguage_Interplay.html
  it("iam:CreatePolicy queda denegada de forma implícita", () => {
    expect(
      evaluate({ request: iamRequest("iam:CreatePolicy"), identityPolicies: [readOnlyIam] })
        .decision,
    ).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_AccessPolicyLanguage_Interplay.html
  it("iam:GetOrganizationsAccessReport queda denegada de forma explícita por DenyReports", () => {
    const result = evaluate({
      request: iamRequest("iam:GetOrganizationsAccessReport"),
      identityPolicies: [readOnlyIam],
    });
    expect(result.decision).toBe("ExplicitDeny");
    expect(result.matched).toContainEqual({ source: "identityPolicies[0]", sid: "DenyReports" });
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_AccessPolicyLanguage_Interplay.html
  it("otra política que conceda iam:GenerateCredentialReport no levanta la denegación explícita", () => {
    const grantReports = policy([
      { Effect: "Allow", Action: "iam:GenerateCredentialReport", Resource: "*" },
    ]);
    const result = evaluate({
      request: iamRequest("iam:GenerateCredentialReport"),
      identityPolicies: [readOnlyIam, grantReports],
    });
    expect(result.decision).toBe("ExplicitDeny");
  });
});

describe("iam: solicitudes entre cuentas", () => {
  const DEMO = "arn:aws:iam::111111111111:role/Demo";
  const demoIdentity = policy([
    { Sid: "AllowS3ListRead", Effect: "Allow", Action: "s3:ListAllMyBuckets", Resource: "*" },
    {
      Sid: "AllowS3ProductionObjectActions",
      Effect: "Allow",
      Action: "s3:*Object*",
      Resource: "arn:aws:s3:::amzn-s3-demo-bucket-production/*",
    },
    {
      Sid: "DenyS3Logs",
      Effect: "Deny",
      Action: "s3:*",
      Resource: ["arn:aws:s3:::*log*", "arn:aws:s3:::*log*/*"],
    },
  ]);
  const productionBucketPolicy = policy([
    {
      Effect: "Allow",
      Action: ["s3:GetObject*", "s3:PutObject*", "s3:ReplicateObject", "s3:RestoreObject"],
      Principal: { AWS: DEMO },
      Resource: "arn:aws:s3:::amzn-s3-demo-bucket-production/*",
    },
  ]);
  const crossRequest = (action: string, resourceArn: string): EvaluationInput["request"] =>
    request(DEMO, action, resourceArn, "111111111111", "222222222222");

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic-cross-account.html
  it("Carlos guarda en el bucket de logs de producción: la cuenta 111111111111 devuelve Deny", () => {
    const result = evaluate({
      request: crossRequest("s3:PutObject", "arn:aws:s3:::amzn-s3-demo-bucket-production-logs/a.txt"),
      identityPolicies: [demoIdentity],
    });
    expect(result.decision).toBe("ExplicitDeny");
    expect(result.matched).toContainEqual({ source: "identityPolicies[0]", sid: "DenyS3Logs" });
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic-cross-account.html
  it("Carlos guarda en el bucket de producción: las dos cuentas permiten y la decisión final es Allow", () => {
    const result = evaluate({
      request: crossRequest("s3:PutObject", "arn:aws:s3:::amzn-s3-demo-bucket-production/a.txt"),
      identityPolicies: [demoIdentity],
      resourcePolicy: productionBucketPolicy,
    });
    expect(result.decision).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic-cross-account.html
  it("el rol puede crear y editar objetos, pero no borrarlos, porque la política del bucket no incluye DeleteObject", () => {
    const result = evaluate({
      request: crossRequest("s3:DeleteObject", "arn:aws:s3:::amzn-s3-demo-bucket-production/a.txt"),
      identityPolicies: [demoIdentity],
      resourcePolicy: productionBucketPolicy,
    });
    expect(result.decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic-cross-account.html
  it("la política de recurso sola no basta: el solicitante necesita además una política de identidad", () => {
    const result = evaluate({
      request: crossRequest("s3:PutObject", "arn:aws:s3:::amzn-s3-demo-bucket-production/a.txt"),
      resourcePolicy: productionBucketPolicy,
    });
    expect(result.decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic-cross-account.html
  it("la política de identidad sola no basta: la política de recurso de la otra cuenta debe permitir", () => {
    const result = evaluate({
      request: crossRequest("s3:PutObject", "arn:aws:s3:::amzn-s3-demo-bucket-production/a.txt"),
      identityPolicies: [demoIdentity],
    });
    expect(result.decision).toBe("ImplicitDeny");
  });
});

describe("iam: límites de permisos", () => {
  const SHIRLEY = `arn:aws:iam::${ACCOUNT}:user/Shirley`;
  const boundary = policy([
    {
      Effect: "Allow",
      Action: ["s3:*", "cloudwatch:*", "ec2:*"],
      Resource: "*",
    },
  ]);
  const createUser = policy([{ Effect: "Allow", Action: "iam:CreateUser", Resource: "*" }]);

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html
  it("Shirley no puede crear un usuario: el límite de permisos no permite iam:CreateUser", () => {
    const result = evaluate({
      request: request(SHIRLEY, "iam:CreateUser", `arn:aws:iam::${ACCOUNT}:user/nuevo`),
      identityPolicies: [createUser],
      permissionsBoundary: boundary,
    });
    expect(result.decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html
  it("el límite de permisos no concede permisos por sí solo", () => {
    const result = evaluate({
      request: request(SHIRLEY, "s3:GetObject", "arn:aws:s3:::bucket/key"),
      permissionsBoundary: boundary,
    });
    expect(result.decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html
  it("los permisos efectivos son la intersección de la política de identidad y el límite", () => {
    const identity = policy([{ Effect: "Allow", Action: ["s3:*", "iam:CreateUser"], Resource: "*" }]);
    const allowed = evaluate({
      request: request(SHIRLEY, "s3:GetObject", "arn:aws:s3:::bucket/key"),
      identityPolicies: [identity],
      permissionsBoundary: boundary,
    });
    const blocked = evaluate({
      request: request(SHIRLEY, "iam:CreateUser", `arn:aws:iam::${ACCOUNT}:user/nuevo`),
      identityPolicies: [identity],
      permissionsBoundary: boundary,
    });
    expect(allowed.decision).toBe("Allow");
    expect(blocked.decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html
  it("una denegación explícita en el límite anula el permiso de la política de identidad", () => {
    const denyingBoundary = policy([
      { Effect: "Allow", Action: "s3:*", Resource: "*" },
      { Sid: "NoLogs", Effect: "Deny", Action: "s3:*", Resource: "arn:aws:s3:::*log*" },
    ]);
    const result = evaluate({
      request: request(SHIRLEY, "s3:GetObject", "arn:aws:s3:::mis-logs/key"),
      identityPolicies: [FULL_ACCESS],
      permissionsBoundary: denyingBoundary,
    });
    expect(result.decision).toBe("ExplicitDeny");
    expect(result.matched).toContainEqual({ source: "permissionsBoundary", sid: "NoLogs" });
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html
  it("una política de recurso que concede el permiso al ARN del usuario no la limita el límite de permisos", () => {
    const bucketPolicy = policy([
      {
        Effect: "Allow",
        Principal: { AWS: SHIRLEY },
        Action: "iam:CreateUser",
        Resource: "*",
      },
    ]);
    const result = evaluate({
      request: request(SHIRLEY, "iam:CreateUser", `arn:aws:iam::${ACCOUNT}:user/nuevo`),
      permissionsBoundary: boundary,
      resourcePolicy: bucketPolicy,
    });
    expect(result.decision).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html
  it("una política de recurso que concede el permiso al ARN del rol sí la limita el límite de permisos", () => {
    const ROLE = `arn:aws:iam::${ACCOUNT}:role/examplerole`;
    const result = evaluate({
      request: request(ROLE, "iam:CreateUser", `arn:aws:iam::${ACCOUNT}:user/nuevo`),
      permissionsBoundary: boundary,
      resourcePolicy: policy([
        { Effect: "Allow", Principal: { AWS: ROLE }, Action: "iam:CreateUser", Resource: "*" },
      ]),
    });
    expect(result.decision).toBe("ImplicitDeny");
  });
});

describe("iam: políticas de sesión", () => {
  const SESSION = `arn:aws:sts::${ACCOUNT}:assumed-role/examplerole/examplerolesessionname`;
  const ROLE = `arn:aws:iam::${ACCOUNT}:role/examplerole`;
  const sessionPolicy = policy([{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }]);
  const identity = policy([{ Effect: "Allow", Action: "s3:*", Resource: "*" }]);
  const object = "arn:aws:s3:::bucket/key";

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html
  it("los permisos de la sesión son la intersección de la política de identidad y la de sesión", () => {
    const allowed = evaluate({
      request: request(SESSION, "s3:GetObject", object),
      identityPolicies: [identity],
      sessionPolicies: [sessionPolicy],
    });
    const blocked = evaluate({
      request: request(SESSION, "s3:PutObject", object),
      identityPolicies: [identity],
      sessionPolicies: [sessionPolicy],
    });
    expect(allowed.decision).toBe("Allow");
    expect(blocked.decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html
  it("si no se pasó una política de sesión, la sesión no queda limitada", () => {
    const result = evaluate({
      request: request(SESSION, "s3:PutObject", object),
      identityPolicies: [identity],
    });
    expect(result.decision).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html
  it("la política de recurso que concede el permiso al ARN de la sesión no la limita la política de sesión", () => {
    const result = evaluate({
      request: request(SESSION, "s3:PutObject", object),
      sessionPolicies: [sessionPolicy],
      resourcePolicy: policy([
        { Effect: "Allow", Principal: { AWS: SESSION }, Action: "s3:PutObject", Resource: object },
      ]),
    });
    expect(result.decision).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html
  it("la política de recurso que concede el permiso al ARN del rol sí la limita la política de sesión", () => {
    const result = evaluate({
      request: request(SESSION, "s3:PutObject", object),
      sessionPolicies: [sessionPolicy],
      resourcePolicy: policy([
        { Effect: "Allow", Principal: { AWS: ROLE }, Action: "s3:PutObject", Resource: object },
      ]),
    });
    expect(result.decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html
  it("sesión, límite de permisos e identidad deben permitir a la vez, y un Deny en cualquiera anula", () => {
    const boundary = policy([{ Effect: "Allow", Action: "s3:*", Resource: "*" }]);
    const all = evaluate({
      request: request(SESSION, "s3:GetObject", object),
      identityPolicies: [identity],
      permissionsBoundary: boundary,
      sessionPolicies: [sessionPolicy],
    });
    const denyingSession = evaluate({
      request: request(SESSION, "s3:GetObject", object),
      identityPolicies: [identity],
      permissionsBoundary: boundary,
      sessionPolicies: [
        policy([
          { Effect: "Allow", Action: "s3:*", Resource: "*" },
          { Sid: "Bloqueo", Effect: "Deny", Action: "s3:GetObject", Resource: "*" },
        ]),
      ],
    });
    expect(all.decision).toBe("Allow");
    expect(denyingSession.decision).toBe("ExplicitDeny");
  });
});

describe("iam: SCP de Organizations", () => {
  const object = "arn:aws:s3:::bucket/key";
  const run = (action: string, scps: PolicyDocument[][]) =>
    evaluate({
      request: request(CARLOS, action, action.startsWith("s3:") ? object : "*"),
      identityPolicies: [FULL_ACCESS],
      scps,
    });
  const allowService = (...actions: string[]): PolicyDocument =>
    policy([{ Effect: "Allow", Action: actions, Resource: "*" }]);
  const denyService = (action: string): PolicyDocument =>
    policy([{ Effect: "Deny", Action: action, Resource: "*" }]);

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html
  it("con un Allow en la raíz, la UO y la cuenta, la acción permitida por identidad se permite", () => {
    expect(run("s3:GetObject", [[FULL_ACCESS], [FULL_ACCESS], [FULL_ACCESS]]).decision).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html
  it("si falta el Allow en la UO, la cuenta queda denegada de forma implícita", () => {
    const result = run("s3:GetObject", [[FULL_ACCESS], [], [FULL_ACCESS]]);
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).toContain("nivel 2");
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html
  it("un Deny en la UO prevalece sobre los Allow de la raíz y de la cuenta", () => {
    const result = run("s3:GetObject", [
      [FULL_ACCESS],
      [FULL_ACCESS, denyService("s3:*")],
      [FULL_ACCESS],
    ]);
    expect(result.decision).toBe("ExplicitDeny");
    expect(result.matched).toContainEqual({ source: "scps[1][1]" });
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html
  it("escenario 2: una UO que solo permite EC2 deja a sus cuentas solo con EC2", () => {
    const levels = [[FULL_ACCESS], [allowService("ec2:*")], [FULL_ACCESS]];
    expect(run("ec2:RunInstances", levels).decision).toBe("Allow");
    expect(run("s3:GetObject", levels).decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html
  it("escenario 3: un Deny en la raíz sin Allow deja a todas las cuentas sin acceso", () => {
    const levels = [[denyService("s3:*")], [FULL_ACCESS], [FULL_ACCESS]];
    expect(run("ec2:RunInstances", levels).decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html
  it("escenario 4: el Deny de EC2 en la UO de pruebas bloquea EC2 pero no el resto", () => {
    const levels = [[FULL_ACCESS], [FULL_ACCESS], [FULL_ACCESS, denyService("ec2:*")], [FULL_ACCESS]];
    expect(run("ec2:RunInstances", levels).decision).toBe("ExplicitDeny");
    expect(run("s3:GetObject", levels).decision).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html
  it("escenario 6: un Deny de S3 en la raíz prevalece sobre el Allow de S3 de la UO", () => {
    const levels = [[FULL_ACCESS, denyService("s3:*")], [allowService("s3:*")]];
    expect(run("s3:GetObject", levels).decision).toBe("ExplicitDeny");
    expect(run("ec2:RunInstances", levels).decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_evaluation.html
  it("escenario 7: dos SCP de lista de servicios en la raíz permiten solo IAM, EC2, S3 y CloudWatch", () => {
    const levels = [
      [allowService("iam:*", "ec2:*"), allowService("s3:*", "cloudwatch:*")],
      [FULL_ACCESS],
    ];
    expect(run("iam:GetUser", levels).decision).toBe("Allow");
    expect(run("ec2:RunInstances", levels).decision).toBe("Allow");
    expect(run("s3:GetObject", levels).decision).toBe("Allow");
    expect(run("cloudwatch:GetMetricData", levels).decision).toBe("Allow");
    expect(run("rds:CreateDBInstance", levels).decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html
  it("las SCP no conceden permisos: sin política de identidad no hay acceso aunque permitan todo", () => {
    const result = evaluate({
      request: request(CARLOS, "s3:GetObject", object),
      scps: [[FULL_ACCESS]],
    });
    expect(result.decision).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html
  it("con límite de permisos y SCP, el límite, la SCP y la política de identidad deben permitir", () => {
    const boundary = policy([{ Effect: "Allow", Action: "s3:*", Resource: "*" }]);
    const base = {
      request: request(CARLOS, "s3:GetObject", object),
      identityPolicies: [FULL_ACCESS],
    };
    expect(evaluate({ ...base, permissionsBoundary: boundary, scps: [[FULL_ACCESS]] }).decision).toBe(
      "Allow",
    );
    expect(
      evaluate({ ...base, permissionsBoundary: boundary, scps: [[allowService("ec2:*")]] }).decision,
    ).toBe("ImplicitDeny");
    expect(
      evaluate({
        ...base,
        permissionsBoundary: policy([{ Effect: "Allow", Action: "ec2:*", Resource: "*" }]),
        scps: [[FULL_ACCESS]],
      }).decision,
    ).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html
  it("la evaluación de denegaciones va primero: un Deny explícito gana aunque las SCP no permitan", () => {
    const result = evaluate({
      request: request(CARLOS, "s3:GetObject", object),
      identityPolicies: [policy([{ Effect: "Deny", Action: "s3:*", Resource: "*" }])],
      scps: [[allowService("ec2:*")]],
    });
    expect(result.decision).toBe("ExplicitDeny");
  });
});

describe("iam: RCP de Organizations", () => {
  const OUTSIDER = "arn:aws:iam::999999999999:role/externo";
  const bucket = "arn:aws:s3:::bucket-de-la-organizacion/key";
  const rcpFullAccess = policy([
    { Effect: "Allow", Principal: "*", Action: "*", Resource: "*" },
  ]);
  const rcpDeny = policy([
    {
      Effect: "Deny",
      Principal: "*",
      Action: "s3:PutBucketPublicAccessBlock",
      Resource: "*",
    },
  ]);
  const bucketPolicy = policy([
    { Effect: "Allow", Principal: { AWS: OUTSIDER }, Action: "s3:*", Resource: "*" },
  ]);

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps_evaluation.html
  it("un Deny en una RCP prevalece aunque la RCPFullAWSAccess permita", () => {
    const result = evaluate({
      request: request(
        CARLOS,
        "s3:PutBucketPublicAccessBlock",
        "arn:aws:s3:::bucket-de-la-organizacion",
      ),
      identityPolicies: [FULL_ACCESS],
      rcps: [[rcpFullAccess], [rcpFullAccess, rcpDeny]],
    });
    expect(result.decision).toBe("ExplicitDeny");
    expect(result.matched).toContainEqual({ source: "rcps[1][1]" });
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps_evaluation.html
  it("con la RCPFullAWSAccess en cada nivel las RCP no cambian el resultado", () => {
    const result = evaluate({
      request: request(CARLOS, "s3:GetObject", bucket),
      identityPolicies: [FULL_ACCESS],
      rcps: [[rcpFullAccess], [rcpFullAccess], [rcpFullAccess]],
    });
    expect(result.decision).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html
  it("si las RCP no tienen un Allow aplicable en un nivel, la decisión es Deny", () => {
    const result = evaluate({
      request: request(CARLOS, "s3:GetObject", bucket),
      identityPolicies: [FULL_ACCESS],
      rcps: [[rcpFullAccess], []],
    });
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).toContain("RCP");
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps.html
  it("una RCP de la cuenta propietaria se aplica al principal de otra cuenta que accede al recurso", () => {
    const denyS3 = policy([
      { Effect: "Deny", Principal: "*", Action: "s3:*", Resource: "*" },
    ]);
    const result = evaluate({
      request: request(OUTSIDER, "s3:GetObject", bucket, "999999999999", "111111111111"),
      identityPolicies: [FULL_ACCESS],
      resourcePolicy: bucketPolicy,
      rcps: [[rcpFullAccess, denyS3]],
    });
    expect(result.decision).toBe("ExplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_rcps.html
  it("las RCP no conceden permisos: sin política de identidad ni de recurso no hay acceso", () => {
    const result = evaluate({
      request: request(CARLOS, "s3:GetObject", bucket),
      rcps: [[rcpFullAccess]],
    });
    expect(result.decision).toBe("ImplicitDeny");
  });
});

describe("iam: sentencias con condiciones", () => {
  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-reqcontext.html
  it("la política de ejemplo con aws:PrincipalTag/dept: sin la clave en el contexto la sentencia no aplica", () => {
    const result = evaluate({
      request: request(CARLOS, "s3:CreateBucket", "arn:aws:s3:::amzn-s3-demo-bucket1"),
      identityPolicies: [
        policy([
          {
            Effect: "Allow",
            Action: "s3:CreateBucket",
            Resource: "arn:aws:s3:::amzn-s3-demo-bucket1",
            Condition: { StringEquals: { "aws:PrincipalTag/dept": "123" } },
          },
        ]),
      ],
    });
    expect(result.decision).toBe("ImplicitDeny");
    expect(result.reason).toBe(
      "Ninguna política de identidad ni de recurso permite la acción: denegación implícita.",
    );
    expect(result.matched).toEqual([]);
    const withTag = evaluate({
      request: {
        ...request(CARLOS, "s3:CreateBucket", "arn:aws:s3:::amzn-s3-demo-bucket1"),
        context: { "aws:PrincipalTag/dept": "123" },
      },
      identityPolicies: [
        policy([
          {
            Effect: "Allow",
            Action: "s3:CreateBucket",
            Resource: "arn:aws:s3:::amzn-s3-demo-bucket1",
            Condition: { StringEquals: { "aws:PrincipalTag/dept": "123" } },
          },
        ]),
      ],
    });
    expect(withTag.decision).toBe("Allow");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_notaction.html
  it("DenyAllUsersNotUsingMFA con NotAction iam:*: sin la clave de MFA (IfExists) deniega el resto; con MFA no tiene efecto", () => {
    const mfa = policy([
      {
        Sid: "DenyAllUsersNotUsingMFA",
        Effect: "Deny",
        NotAction: "iam:*",
        Resource: "*",
        Condition: { BoolIfExists: { "aws:MultiFactorAuthPresent": "false" } },
      },
    ]);
    const onIam = evaluate({
      request: request(CARLOS, "iam:GetUser", "*"),
      identityPolicies: [FULL_ACCESS, mfa],
    });
    const onS3 = evaluate({
      request: request(CARLOS, "s3:GetObject", "arn:aws:s3:::bucket/key"),
      identityPolicies: [FULL_ACCESS, mfa],
    });
    expect(onIam.decision).toBe("Allow");
    expect(onS3.decision).toBe("ExplicitDeny");
    expect(onS3.matched).toEqual([{ source: "identityPolicies[1]", sid: "DenyAllUsersNotUsingMFA" }]);
    const withMfa = evaluate({
      request: {
        ...request(CARLOS, "s3:GetObject", "arn:aws:s3:::bucket/key"),
        context: { "aws:MultiFactorAuthPresent": true },
      },
      identityPolicies: [FULL_ACCESS, mfa],
    });
    expect(withMfa.decision).toBe("Allow");
  });
});

describe("iam: comodines y elementos de la gramática", () => {
  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_action.html
  it("el prefijo y el nombre de la acción no distinguen mayúsculas: iam:ListAccessKeys es IAM:listaccesskeys", () => {
    expect(matchesAction("iam:ListAccessKeys", "IAM:listaccesskeys")).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_action.html
  it("s3:* se aplica a todas las acciones de S3 y no a las de otros servicios", () => {
    expect(matchesAction("s3:*", "s3:GetObject")).toBe(true);
    expect(matchesAction("s3:*", "ec2:StartInstances")).toBe(false);
    expect(matchesAction("*", "sqs:SendMessage")).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_action.html
  it("iam:*AccessKey* cubre CreateAccessKey, DeleteAccessKey, ListAccessKeys y UpdateAccessKey", () => {
    for (const name of ["CreateAccessKey", "DeleteAccessKey", "ListAccessKeys", "UpdateAccessKey"]) {
      expect(matchesAction("iam:*AccessKey*", `iam:${name}`), name).toBe(true);
    }
    expect(matchesAction("iam:*AccessKey*", "iam:GetUser")).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_grammar.html
  it("las acciones s3:Get* y s3:List* de la gramática cubren las acciones que empiezan por Get y List", () => {
    expect(matchesAction("s3:Get*", "s3:GetObject")).toBe(true);
    expect(matchesAction("s3:List*", "s3:ListBucket")).toBe(true);
    expect(matchesAction("s3:Get*", "s3:PutObject")).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_examples_iam_read-only-console-no-reports.html
  it("iam:Get* incluye GetUser y GetRole", () => {
    expect(matchesAction("iam:Get*", "iam:GetUser")).toBe(true);
    expect(matchesAction("iam:Get*", "iam:GetRole")).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_examples_s3_rw-bucket.html
  it("s3:*Object cubre GetObject, DeleteObject y PutObject, y no las acciones que no terminan en Object", () => {
    for (const name of ["GetObject", "DeleteObject", "PutObject"]) {
      expect(matchesAction("s3:*Object", `s3:${name}`), name).toBe(true);
    }
    expect(matchesAction("s3:*Object", "s3:GetObjectAcl")).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps_syntax.html
  it("ec2:Describe* solo cubre las acciones de EC2 que empiezan por Describe, y ? cubre un solo carácter", () => {
    expect(matchesAction("ec2:Describe*", "ec2:DescribeInstances")).toBe(true);
    expect(matchesAction("ec2:Describe*", "ec2:RunInstances")).toBe(false);
    expect(matchesAction("s3:Get?bject", "s3:GetObject")).toBe(true);
    expect(matchesAction("s3:Get?bject", "s3:GetObbject")).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_resource.html
  it("el nombre de usuario IAM del ARN distingue mayúsculas", () => {
    expect(matchesResource("arn:aws:iam::123456789012:user/Bob", "arn:aws:iam::123456789012:user/Bob")).toBe(true);
    expect(matchesResource("arn:aws:iam::123456789012:user/Bob", "arn:aws:iam::123456789012:user/bob")).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_resource.html
  it("arn:aws:iam::cuenta:user/accounting/* cubre los usuarios de la ruta /accounting", () => {
    const pattern = "arn:aws:iam::123456789012:user/accounting/*";
    expect(matchesResource(pattern, "arn:aws:iam::123456789012:user/accounting/ana")).toBe(true);
    expect(matchesResource(pattern, "arn:aws:iam::123456789012:user/ventas/ana")).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_resource.html
  it("el * de arn:aws:s3:::bucket/*/test/* cubre las ocho claves de la guía y no las tres que la guía excluye", () => {
    const pattern = "arn:aws:s3:::amzn-s3-demo-bucket/*/test/*";
    const included = [
      "1/test/object.jpg",
      "1/2/test/object.jpg",
      "1/2/test/3/object.jpg",
      "1/2/3/test/4/object.jpg",
      "1///test///object.jpg",
      "1/test/.jpg",
      "/test/object.jpg",
      "1/test/",
    ];
    const excluded = ["1-test/object.jpg", "test/object.jpg", "1/2/test.jpg"];
    for (const key of included) {
      expect(matchesResource(pattern, `arn:aws:s3:::amzn-s3-demo-bucket/${key}`), key).toBe(true);
    }
    for (const key of excluded) {
      expect(matchesResource(pattern, `arn:aws:s3:::amzn-s3-demo-bucket/${key}`), key).toBe(false);
    }
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_notaction.html
  it("NotAction con Allow permite todo lo de S3 salvo s3:DeleteBucket, y no afecta a recursos de otros servicios", () => {
    const notDelete = policy([
      { Effect: "Allow", NotAction: "s3:DeleteBucket", Resource: "arn:aws:s3:::*" },
    ]);
    const run = (action: string, arn: string) =>
      evaluate({ request: request(CARLOS, action, arn), identityPolicies: [notDelete] }).decision;
    expect(run("s3:GetObject", "arn:aws:s3:::bucket/key")).toBe("Allow");
    expect(run("s3:DeleteBucket", "arn:aws:s3:::bucket")).toBe("ImplicitDeny");
    expect(run("ec2:StartInstances", `arn:aws:ec2:us-east-2:${ACCOUNT}:instance/i-1`)).toBe(
      "ImplicitDeny",
    );
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_notaction.html
  it("NotAction iam:* con Allow y Resource * permite todas las acciones salvo las de IAM", () => {
    const notIam = policy([{ Effect: "Allow", NotAction: "iam:*", Resource: "*" }]);
    const run = (action: string) =>
      evaluate({ request: request(CARLOS, action, "*"), identityPolicies: [notIam] }).decision;
    expect(run("ec2:StartInstances")).toBe("Allow");
    expect(run("iam:CreateUser")).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_notresource.html
  it("NotResource con Deny bloquea todo S3 salvo la carpeta Payroll de HRBucket, y no concede nada por sí solo", () => {
    const denyOutsidePayroll = policy([
      {
        Effect: "Deny",
        Action: "s3:*",
        NotResource: ["arn:aws:s3:::HRBucket/Payroll", "arn:aws:s3:::HRBucket/Payroll/*"],
      },
    ]);
    const allowS3 = policy([{ Effect: "Allow", Action: "s3:*", Resource: "*" }]);
    const run = (arn: string, withAllow: boolean) =>
      evaluate({
        request: request(CARLOS, "s3:GetObject", arn),
        identityPolicies: withAllow ? [allowS3, denyOutsidePayroll] : [denyOutsidePayroll],
      }).decision;
    expect(run("arn:aws:s3:::HRBucket/Other/file", true)).toBe("ExplicitDeny");
    expect(run("arn:aws:s3:::OtroBucket/file", true)).toBe("ExplicitDeny");
    expect(run("arn:aws:s3:::HRBucket/Payroll/file", true)).toBe("Allow");
    expect(run("arn:aws:s3:::HRBucket/Payroll/file", false)).toBe("ImplicitDeny");
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_grammar.html
  it("la política de ejemplo con Version 2012-10-17 y varias acciones es válida según la gramática", () => {
    expect(
      validatePolicy({
        Version: "2012-10-17",
        Statement: [
          { Effect: "Allow", Action: ["s3:Get*", "s3:List*"], Resource: "arn:aws:s3:::bucket/*" },
        ],
      }),
    ).toEqual([]);
    expect(validatePolicy({ Version: "2012-10-17", Statement: { Effect: "Allow", Action: "cloudformation:*", Resource: "*" } })).toEqual([]);
  });
});
