import { describe, expect, it } from "vitest";
import type { PolicyDocument } from "../iam/index.js";
import { effectiveBlockPublicAccess, evaluateS3Access, isPolicyPublic } from "./index.js";
import type { S3Request } from "./index.js";

const OWNER = "111122223333";
const OTHER = "444455556666";
const BUCKET = "arn:aws:s3:::amzn-s3-demo-bucket";

const anonymous: S3Request = {
  principal: { type: "anonymous" },
  action: "s3:GetObject",
  resource: { arn: `${BUCKET}/a.txt`, accountId: OWNER },
};

const account2: S3Request = {
  principal: {
    type: "iam",
    arn: `arn:aws:iam::${OTHER}:user/cuenta2`,
    accountId: OTHER,
    identityPolicies: [
      { Version: "2012-10-17", Statement: { Effect: "Allow", Action: "s3:GetObject", Resource: "*" } },
    ],
  },
  action: "s3:GetObject",
  resource: { arn: `${BUCKET}/a.txt`, accountId: OWNER },
};

const publicStatement = {
  Effect: "Allow" as const,
  Principal: "*",
  Action: "s3:GetObject",
  Resource: `${BUCKET}/*`,
};
const account2Statement = {
  Effect: "Allow" as const,
  Principal: { AWS: `arn:aws:iam::${OTHER}:root` },
  Action: "s3:GetObject",
  Resource: `${BUCKET}/*`,
};
const cloudTrailStatement = {
  Effect: "Allow" as const,
  Principal: { Service: "cloudtrail.amazonaws.com" },
  Action: "s3:GetBucketAcl",
  Resource: BUCKET,
};

function policy(...statements: PolicyDocument["Statement"][]): PolicyDocument {
  return { Version: "2012-10-17", Statement: statements.flat() };
}

describe("s3access: casos dorados de «The meaning of public» (Guía de usuario de Amazon S3)", () => {
  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html#access-control-block-public-access-policy-status
  it("Principal * con Resource * y s3:PutObject es una política pública", () => {
    expect(
      isPolicyPublic({
        Version: "2012-10-17",
        Statement: { Principal: "*", Resource: "*", Action: "s3:PutObject", Effect: "Allow" },
      }),
    ).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html#access-control-block-public-access-policy-status
  it("aws:SourceVpc con el valor vpc-* (comodín) sigue siendo pública", () => {
    expect(
      isPolicyPublic({
        Version: "2012-10-17",
        Statement: {
          Principal: "*",
          Resource: "*",
          Action: "s3:PutObject",
          Effect: "Allow",
          Condition: { StringLike: { "aws:SourceVpc": "vpc-*" } },
        },
      }),
    ).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html#access-control-block-public-access-policy-status
  it("aws:SourceVpc con el valor fijo vpc-91237329 la hace no pública", () => {
    expect(
      isPolicyPublic({
        Version: "2012-10-17",
        Statement: {
          Principal: "*",
          Resource: "*",
          Action: "s3:PutObject",
          Effect: "Allow",
          Condition: { StringEquals: { "aws:SourceVpc": "vpc-91237329" } },
        },
      }),
    ).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html#access-control-block-public-access-policy-status
  it("aws:SourceIp con un rango muy amplio (0.0.0.0/1) se evalúa como pública", () => {
    const withRange = (range: string): PolicyDocument => ({
      Version: "2012-10-17",
      Statement: { ...publicStatement, Condition: { IpAddress: { "aws:SourceIp": range } } },
    });
    expect(isPolicyPublic(withRange("0.0.0.0/1"))).toBe(true);
    expect(isPolicyPublic(withRange("203.0.113.0/24"))).toBe(false);
    expect(isPolicyPublic(withRange("2001:db8::/16"))).toBe(true);
    expect(isPolicyPublic(withRange("2001:db8::/32"))).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html#access-control-block-public-access-policy-status
  it("s3:DataAccessPointArn con comodín en el nombre del punto de acceso y cuenta fija no la hace pública", () => {
    const withArn = (arn: string): PolicyDocument => ({
      Version: "2012-10-17",
      Statement: {
        ...publicStatement,
        Condition: { StringLike: { "s3:DataAccessPointArn": arn } },
      },
    });
    expect(isPolicyPublic(withArn("arn:aws:s3:us-west-2:123456789012:accesspoint/*"))).toBe(false);
    expect(isPolicyPublic(withArn("arn:aws:s3:us-west-2:*:accesspoint/*"))).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html#access-control-block-public-access-policy-status
  it("una política con principales fijos (CloudTrail y la cuenta 2) no es pública", () => {
    expect(isPolicyPublic(policy(cloudTrailStatement, account2Statement))).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html#access-control-block-public-access-policy-status
  it("la sentencia pública hace pública toda la política, aunque las otras sean fijas", () => {
    expect(isPolicyPublic(policy(cloudTrailStatement, account2Statement, publicStatement))).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html#access-control-block-public-access-policy-status
  it("con RestrictPublicBuckets, la sentencia pública bloquea a la cuenta 2 aunque la política la nombre", () => {
    const result = evaluateS3Access({
      blockPublicAccess: { bucket: { RestrictPublicBuckets: true } },
      bucketPolicy: policy(cloudTrailStatement, account2Statement, publicStatement),
      objectOwnership: "BucketOwnerEnforced",
      request: account2,
    });
    expect(result.allowed).toBe(false);
    expect(result.isPublic).toBe(false);
    expect(result.reasons.join(" ")).toContain("RestrictPublicBuckets bloquea el acceso anónimo y entre cuentas");
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html#access-control-block-public-access-policy-status
  it("quitando la sentencia pública, la cuenta 2 recupera el acceso aunque RestrictPublicBuckets siga activa", () => {
    const result = evaluateS3Access({
      blockPublicAccess: { bucket: { RestrictPublicBuckets: true } },
      bucketPolicy: policy(cloudTrailStatement, account2Statement),
      objectOwnership: "BucketOwnerEnforced",
      request: account2,
    });
    expect(result.allowed).toBe(true);
    expect(result.isPublic).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html#access-control-block-public-access-policy-status
  it("RestrictPublicBuckets no afecta a una política no pública: sigue en vigor tal como está escrita", () => {
    const result = evaluateS3Access({
      blockPublicAccess: { account: { RestrictPublicBuckets: true } },
      bucketPolicy: policy(account2Statement),
      objectOwnership: "BucketOwnerEnforced",
      request: account2,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("s3access: casos dorados de Block Public Access (Guía de usuario de Amazon S3)", () => {
  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
  it("si la organización o la cuenta lo activa y el bucket lo desactiva, el bucket sigue protegido", () => {
    expect(
      effectiveBlockPublicAccess({
        account: { RestrictPublicBuckets: true },
        bucket: { RestrictPublicBuckets: false },
      }).RestrictPublicBuckets,
    ).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
  it("si la cuenta lo desactiva pero el bucket lo activa, el bucket sigue protegido por su configuración", () => {
    expect(
      effectiveBlockPublicAccess({
        account: { RestrictPublicBuckets: false },
        bucket: { RestrictPublicBuckets: true },
      }).RestrictPublicBuckets,
    ).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
  it("las cuatro opciones son independientes y se combinan una a una", () => {
    expect(
      effectiveBlockPublicAccess({
        account: { BlockPublicAcls: true, IgnorePublicAcls: true },
        bucket: { BlockPublicPolicy: true },
      }),
    ).toEqual({
      BlockPublicAcls: true,
      IgnorePublicAcls: true,
      BlockPublicPolicy: true,
      RestrictPublicBuckets: false,
    });
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
  it("BlockPublicPolicy no modifica las políticas existentes: la política pública sigue concediendo acceso", () => {
    const result = evaluateS3Access({
      blockPublicAccess: { account: { BlockPublicPolicy: true } },
      bucketPolicy: policy(publicStatement),
      objectOwnership: "BucketOwnerEnforced",
      request: anonymous,
    });
    expect(result.allowed).toBe(true);
    expect(result.isPublic).toBe(true);
    expect(result.reasons.join(" ")).toContain("no modifica la política que ya existe");
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
  it("quitar la opción vuelve a dejar pública una política pública", () => {
    const bucketPolicy = policy(publicStatement);
    const blocked = evaluateS3Access({
      blockPublicAccess: { bucket: { RestrictPublicBuckets: true } },
      bucketPolicy,
      objectOwnership: "BucketOwnerEnforced",
      request: anonymous,
    });
    const removed = evaluateS3Access({
      blockPublicAccess: { bucket: { RestrictPublicBuckets: false } },
      bucketPolicy,
      objectOwnership: "BucketOwnerEnforced",
      request: anonymous,
    });
    expect(blocked.allowed).toBe(false);
    expect(removed.allowed).toBe(true);
    expect(removed.isPublic).toBe(true);
  });
});

describe("s3access: casos dorados de Object Ownership (Guía de usuario de Amazon S3)", () => {
  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html
  it("BucketOwnerEnforced (valor por defecto) desactiva las ACL: el acceso depende solo de las políticas", () => {
    const result = evaluateS3Access({
      blockPublicAccess: {},
      bucketPolicy: null,
      objectOwnership: "BucketOwnerEnforced",
      request: anonymous,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toContain("Las ACL están desactivadas");
  });

  // Fuente: https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html
  it("BucketOwnerPreferred y ObjectWriter mantienen las ACL habilitadas", () => {
    for (const objectOwnership of ["BucketOwnerPreferred", "ObjectWriter"] as const) {
      const result = evaluateS3Access({
        blockPublicAccess: {},
        bucketPolicy: null,
        objectOwnership,
        request: anonymous,
      });
      expect(result.reasons.join(" ")).toContain("Las ACL están habilitadas");
    }
  });
});
