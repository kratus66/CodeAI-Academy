import { describe, expect, it } from "vitest";
import { aws, listCapabilities, selfTest } from "../index.js";
import type { PolicyDocument } from "../iam/index.js";
import {
  canary,
  capabilities,
  effectiveBlockPublicAccess,
  evaluateS3Access,
  isPolicyPublic,
} from "./index.js";
import type { S3AccessInput, S3Request } from "./index.js";

const OWNER = "111122223333";
const BUCKET = "arn:aws:s3:::amzn-s3-demo-bucket";

const anonymous: S3Request = {
  principal: { type: "anonymous" },
  action: "s3:GetObject",
  resource: { arn: `${BUCKET}/a.txt`, accountId: OWNER },
};

const ownerUser: S3Request = {
  principal: { type: "iam", arn: `arn:aws:iam::${OWNER}:user/ana`, accountId: OWNER },
  action: "s3:GetObject",
  resource: { arn: `${BUCKET}/a.txt`, accountId: OWNER },
};

function publicPolicy(extra: Record<string, unknown> = {}): PolicyDocument {
  return {
    Version: "2012-10-17",
    Statement: [
      { Effect: "Allow", Principal: "*", Action: "s3:GetObject", Resource: `${BUCKET}/*`, ...extra },
    ],
  };
}

function run(input: Partial<S3AccessInput> & { request: S3Request }) {
  return evaluateS3Access({
    blockPublicAccess: {},
    bucketPolicy: null,
    objectOwnership: "BucketOwnerEnforced",
    ...input,
  });
}

describe("s3access: registro y capacidades", () => {
  it("se registra en el arnés y pasa su canario", () => {
    expect(canary()).toBe(true);
    expect(aws.s3access.capabilities).toBe(capabilities);
    expect(listCapabilities().map((item) => item.name)).toContain("s3access");
    expect(selfTest()).toBe(true);
  });

  it("declara lo que no modela y solo cita fuentes oficiales", () => {
    expect(capabilities.notModeled.some((item) => item.includes("ACL"))).toBe(true);
    expect(
      capabilities.sources.every((url) => url.startsWith("https://docs.aws.amazon.com/AmazonS3/")),
    ).toBe(true);
  });
});

describe("s3access: isPolicyPublic", () => {
  it("sin política o con solo Deny no es pública", () => {
    expect(isPolicyPublic(null)).toBe(false);
    expect(isPolicyPublic(undefined)).toBe(false);
    expect(
      isPolicyPublic({
        Version: "2012-10-17",
        Statement: { Effect: "Deny", Principal: "*", Action: "s3:*", Resource: "*" },
      }),
    ).toBe(false);
  });

  it("una política inválida se trata como pública y nunca lanza", () => {
    expect(isPolicyPublic("texto")).toBe(true);
    expect(isPolicyPublic({ Statement: 3 })).toBe(true);
  });

  it("principales con comodín o variables no son fijos; los ARN completos sí", () => {
    const withPrincipal = (principal: unknown): unknown => ({
      Version: "2012-10-17",
      Statement: { Effect: "Allow", Principal: principal, Action: "s3:GetObject", Resource: "*" },
    });
    expect(isPolicyPublic(withPrincipal({ AWS: "*" }))).toBe(true);
    expect(isPolicyPublic(withPrincipal({ AWS: "arn:aws:iam::111122223333:user/*" }))).toBe(true);
    expect(isPolicyPublic(withPrincipal({ AWS: "arn:aws:iam::111122223333:user/ana" }))).toBe(false);
  });

  it("aws:PrincipalOrgID fijo la hace no pública, pero con comodín no", () => {
    expect(
      isPolicyPublic(publicPolicy({ Condition: { StringEquals: { "aws:PrincipalOrgID": "o-abc123" } } })),
    ).toBe(false);
    expect(
      isPolicyPublic(publicPolicy({ Condition: { StringLike: { "aws:PrincipalOrgID": "o-*" } } })),
    ).toBe(true);
  });

  it("una variable de política no es un valor fijo", () => {
    expect(
      isPolicyPublic(
        publicPolicy({ Condition: { StringEquals: { "aws:SourceVpc": "${aws:username}" } } }),
      ),
    ).toBe(true);
  });

  it("los operadores negados y …IfExists no restringen", () => {
    expect(
      isPolicyPublic(publicPolicy({ Condition: { StringNotEquals: { "aws:SourceVpc": "vpc-1" } } })),
    ).toBe(true);
    expect(
      isPolicyPublic(publicPolicy({ Condition: { StringEqualsIfExists: { "aws:SourceVpc": "vpc-1" } } })),
    ).toBe(true);
  });

  it("todos los valores de la lista deben ser fijos", () => {
    expect(
      isPolicyPublic(
        publicPolicy({ Condition: { StringEquals: { "aws:SourceVpce": ["vpce-1", "vpce-2"] } } }),
      ),
    ).toBe(false);
    expect(
      isPolicyPublic(
        publicPolicy({ Condition: { StringLike: { "aws:SourceVpce": ["vpce-1", "vpce-*"] } } }),
      ),
    ).toBe(true);
  });

  it("aws:SourceIp inválido o un valor que no es texto cuenta como pública", () => {
    const withIp = (value: unknown): PolicyDocument =>
      publicPolicy({ Condition: { IpAddress: { "aws:SourceIp": value } } });
    expect(isPolicyPublic(withIp("no-es-ip"))).toBe(true);
    expect(isPolicyPublic(withIp("10.0.0.0/33"))).toBe(true);
    expect(isPolicyPublic(withIp("300.0.0.1"))).toBe(true);
    expect(isPolicyPublic(withIp(5))).toBe(true);
    expect(isPolicyPublic(withIp("10.0.0.0/8"))).toBe(false);
    expect(isPolicyPublic(withIp("203.0.113.7"))).toBe(false);
  });

  it("NotPrincipal con Allow concede a casi todos: es pública", () => {
    const doc: PolicyDocument = {
      Version: "2012-10-17",
      Statement: {
        Effect: "Allow",
        NotPrincipal: { AWS: "arn:aws:iam::111122223333:user/ana" },
        Action: "s3:GetObject",
        Resource: "*",
      },
    };
    expect(isPolicyPublic(doc)).toBe(true);
  });
});

describe("s3access: effectiveBlockPublicAccess", () => {
  it("sin configuración, todo está desactivado", () => {
    const off = {
      BlockPublicAcls: false,
      IgnorePublicAcls: false,
      BlockPublicPolicy: false,
      RestrictPublicBuckets: false,
    };
    expect(effectiveBlockPublicAccess(null)).toEqual(off);
    expect(effectiveBlockPublicAccess({})).toEqual(off);
    expect(effectiveBlockPublicAccess({ account: null, bucket: null })).toEqual(off);
  });
});

describe("s3access: evaluateS3Access", () => {
  it("un bucket sin política deniega al anónimo y no es público", () => {
    const result = run({ request: anonymous });
    expect(result.allowed).toBe(false);
    expect(result.isPublic).toBe(false);
    expect(result.reasons.join(" ")).toContain("no tiene política");
  });

  it("una política pública permite al anónimo y a una cuenta con permiso de identidad", () => {
    const bucketPolicy = publicPolicy();
    expect(run({ bucketPolicy, request: anonymous })).toMatchObject({ allowed: true, isPublic: true });
    expect(
      run({
        bucketPolicy,
        request: {
          ...anonymous,
          principal: {
            type: "iam",
            arn: "arn:aws:iam::444455556666:user/otro",
            accountId: "444455556666",
            identityPolicies: [
              {
                Version: "2012-10-17",
                Statement: { Effect: "Allow", Action: "s3:GetObject", Resource: "*" },
              },
            ],
          },
        },
      }).allowed,
    ).toBe(true);
  });

  it("una cuenta externa sin política de identidad no accede aunque el bucket sea público", () => {
    const result = run({
      bucketPolicy: publicPolicy(),
      request: {
        ...anonymous,
        principal: {
          type: "iam",
          arn: "arn:aws:iam::444455556666:user/otro",
          accountId: "444455556666",
        },
      },
    });
    expect(result.allowed).toBe(false);
  });

  it("una acción distinta de la concedida se deniega por defecto", () => {
    const result = run({
      bucketPolicy: publicPolicy(),
      request: { ...anonymous, action: "s3:PutObject" },
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("denegación implícita");
  });

  it("una denegación explícita prevalece sobre el permiso público", () => {
    const bucketPolicy: PolicyDocument = {
      Version: "2012-10-17",
      Statement: [
        { Effect: "Allow", Principal: "*", Action: "s3:GetObject", Resource: `${BUCKET}/*` },
        { Effect: "Deny", Principal: "*", Action: "s3:GetObject", Resource: `${BUCKET}/secreto/*` },
      ],
    };
    const result = run({
      bucketPolicy,
      request: { ...anonymous, resource: { arn: `${BUCKET}/secreto/a.txt`, accountId: OWNER } },
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("Denegación explícita");
  });

  it("la condición de la política se evalúa con el contexto de la solicitud", () => {
    const bucketPolicy = publicPolicy({
      Condition: { StringEquals: { "aws:SourceVpc": "vpc-91237329" } },
    });
    expect(run({ bucketPolicy, request: anonymous }).allowed).toBe(false);
    expect(
      run({ bucketPolicy, request: { ...anonymous, context: { "aws:SourceVpc": "vpc-91237329" } } }),
    ).toMatchObject({ allowed: true, isPublic: false });
  });

  it("RestrictPublicBuckets deja pasar a los usuarios de la cuenta propietaria", () => {
    const result = run({
      blockPublicAccess: { account: { RestrictPublicBuckets: true } },
      bucketPolicy: publicPolicy(),
      request: ownerUser,
    });
    expect(result.allowed).toBe(true);
    expect(result.isPublic).toBe(false);
    expect(result.reasons.join(" ")).toContain("cuenta propietaria");
  });

  it("IgnorePublicAcls y BlockPublicAcls no cambian el acceso por política", () => {
    const result = run({
      blockPublicAccess: { account: { BlockPublicAcls: true, IgnorePublicAcls: true } },
      bucketPolicy: publicPolicy(),
      request: anonymous,
    });
    expect(result.allowed).toBe(true);
    expect(result.reasons.join(" ")).toContain("activadas: BlockPublicAcls, IgnorePublicAcls");
  });

  it("sin objectOwnership se usa BucketOwnerEnforced, el valor por defecto", () => {
    const result = evaluateS3Access({
      blockPublicAccess: {},
      bucketPolicy: null,
      request: anonymous,
    });
    expect(result.reasons.join(" ")).toContain("BucketOwnerEnforced");
  });

  it("ObjectWriter con IgnorePublicAcls no avisa de ACL habilitadas", () => {
    const result = run({
      blockPublicAccess: { bucket: { IgnorePublicAcls: true } },
      objectOwnership: "ObjectWriter",
      request: anonymous,
    });
    expect(result.reasons.join(" ")).not.toContain("ACL están habilitadas");
  });

  it("es determinista y no modifica la entrada", () => {
    const input: S3AccessInput = {
      blockPublicAccess: { account: { RestrictPublicBuckets: true } },
      bucketPolicy: publicPolicy(),
      objectOwnership: "BucketOwnerEnforced",
      request: anonymous,
    };
    const copy = JSON.stringify(input);
    expect(evaluateS3Access(input)).toEqual(evaluateS3Access(input));
    expect(JSON.stringify(input)).toBe(copy);
  });
});

describe("s3access: entradas inválidas", () => {
  function bad(input: unknown) {
    return evaluateS3Access(input as S3AccessInput);
  }

  it("no lanza y devuelve motivos", () => {
    for (const input of [null, undefined, 3, "x", {}, { request: null }, { request: {} }]) {
      const result = bad(input);
      expect(result.allowed).toBe(false);
      expect(result.isPublic).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });

  it("detecta opciones de Block Public Access mal escritas", () => {
    expect(
      bad({ blockPublicAccess: { bucket: { BlockPublicAcls: "si" } }, request: anonymous }).reasons[0],
    ).toContain("verdadero o falso");
    expect(
      bad({ blockPublicAccess: { bucket: { Otra: true } }, request: anonymous }).reasons[0],
    ).toContain("Otra");
    expect(bad({ blockPublicAccess: 3, request: anonymous }).reasons[0]).toContain(
      "blockPublicAccess",
    );
    expect(bad({ blockPublicAccess: { account: 3 }, request: anonymous }).reasons[0]).toContain(
      "account",
    );
  });

  it("detecta una política de bucket inválida y un objectOwnership desconocido", () => {
    expect(bad({ bucketPolicy: { Statement: 3 }, request: anonymous }).reasons[0]).toContain(
      "política del bucket",
    );
    expect(bad({ objectOwnership: "Otro", request: anonymous }).reasons[0]).toContain(
      "objectOwnership",
    );
  });

  it("detecta una solicitud incompleta", () => {
    const result = bad({ request: { principal: { type: "iam" }, action: "", resource: {} } });
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
    expect(bad({ request: { ...ownerUser, principal: { type: "otro" } } }).reasons[0]).toContain(
      "principal",
    );
  });
});
