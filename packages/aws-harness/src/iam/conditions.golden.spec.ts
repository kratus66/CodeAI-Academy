import { describe, expect, it } from "vitest";
import { evaluateConditions } from "./conditions.js";

type Context = Record<string, string | string[] | number | boolean>;

function holds(condition: unknown, context: Context): boolean {
  return evaluateConditions(condition, context).result === "true";
}

describe("condiciones doradas: cadenas", () => {
  const condition = { StringEquals: { "aws:PrincipalTag/job-category": "iamuser-admin" } };

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("StringEquals con aws:PrincipalTag/job-category: iamuser-admin coincide, dev-ops no y sin clave no", () => {
    expect(holds(condition, { "aws:PrincipalTag/job-category": "iamuser-admin" })).toBe(true);
    expect(holds(condition, { "aws:PrincipalTag/job-category": "dev-ops" })).toBe(false);
    expect(holds(condition, {})).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("StringEqualsIgnoreCase con ForAnyValue:StringEquals de aws:TagKeys distingue mayúsculas solo en la clave de etiqueta", () => {
    const createTags = {
      StringEqualsIgnoreCase: { "aws:RequestTag/environment": ["preprod", "storage"] },
      "ForAnyValue:StringEquals": { "aws:TagKeys": "environment" },
    };
    expect(
      holds(createTags, { "aws:TagKeys": ["environment"], "aws:RequestTag/environment": "preprod" }),
    ).toBe(true);
    expect(
      holds(createTags, { "aws:TagKeys": ["environment"], "aws:RequestTag/environment": "PreProd" }),
    ).toBe(true);
    expect(
      holds(createTags, { "aws:TagKeys": ["Environment"], "aws:RequestTag/environment": "preprod" }),
    ).toBe(false);
    expect(holds(createTags, { "aws:RequestTag/environment": "storage" })).toBe(false);
    expect(holds(createTags, { "aws:TagKeys": ["environment"] })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("con una clave ausente, un operador negado como StringNotLike es verdadero (aviso importante de la guía)", () => {
    expect(holds({ StringNotLike: { "aws:username": "admin*" } }, {})).toBe(true);
    expect(
      holds({ StringNotLike: { "aws:username": "admin*" } }, { "aws:username": "admin-ana" }),
    ).toBe(false);
    expect(holds({ StringNotEquals: { "aws:username": "ana" } }, {})).toBe(true);
  });
});

describe("condiciones doradas: numéricos y fechas", () => {
  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("NumericLessThanEquals con s3:max-keys: hasta 10 se cumple, más no, y sin la clave tampoco", () => {
    const condition = { NumericLessThanEquals: { "s3:max-keys": "10" } };
    expect(holds(condition, { "s3:max-keys": 10 })).toBe(true);
    expect(holds(condition, { "s3:max-keys": "5" })).toBe(true);
    expect(holds(condition, { "s3:max-keys": 11 })).toBe(false);
    expect(holds(condition, {})).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("los demás operadores numéricos comparan de forma estricta o inclusiva", () => {
    expect(holds({ NumericEquals: { "s3:max-keys": "10" } }, { "s3:max-keys": 10 })).toBe(true);
    expect(holds({ NumericLessThan: { "s3:max-keys": "10" } }, { "s3:max-keys": 10 })).toBe(false);
    expect(holds({ NumericGreaterThan: { "s3:max-keys": "10" } }, { "s3:max-keys": 11 })).toBe(true);
    expect(
      holds({ NumericGreaterThanEquals: { "s3:max-keys": "10" } }, { "s3:max-keys": 10 }),
    ).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("DateGreaterThan con aws:TokenIssueTime: una fecha posterior se cumple, una anterior no y sin la clave no", () => {
    const condition = { DateGreaterThan: { "aws:TokenIssueTime": "2020-01-01T00:00:01Z" } };
    expect(holds(condition, { "aws:TokenIssueTime": "2021-06-01T00:00:00Z" })).toBe(true);
    expect(holds(condition, { "aws:TokenIssueTime": "2019-12-31T23:59:59Z" })).toBe(false);
    expect(holds(condition, {})).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("DateLessThan acepta fechas ISO 8601 y la hora de época", () => {
    const condition = { DateLessThan: { "aws:CurrentTime": "2020-01-01T00:00:01Z" } };
    expect(holds(condition, { "aws:CurrentTime": "2019-05-01T10:00:00Z" })).toBe(true);
    expect(holds(condition, { "aws:CurrentTime": 1577836799 })).toBe(true);
    expect(holds(condition, { "aws:CurrentTime": 1577836801 })).toBe(false);
  });
});

describe("condiciones doradas: Bool, IP y ARN", () => {
  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("Bool con aws:SecureTransport igual a false: coincide con false, no con true y no sin la clave", () => {
    const condition = { Bool: { "aws:SecureTransport": "false" } };
    expect(holds(condition, { "aws:SecureTransport": false })).toBe(true);
    expect(holds(condition, { "aws:SecureTransport": "false" })).toBe(true);
    expect(holds(condition, { "aws:SecureTransport": true })).toBe(false);
    expect(holds(condition, {})).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("IpAddress con 203.0.113.0/24: 203.0.113.1 coincide, 198.51.100.1 no y sin aws:SourceIp no", () => {
    const condition = { IpAddress: { "aws:SourceIp": "203.0.113.0/24" } };
    expect(holds(condition, { "aws:SourceIp": "203.0.113.1" })).toBe(true);
    expect(holds(condition, { "aws:SourceIp": "198.51.100.1" })).toBe(false);
    expect(holds(condition, {})).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("IpAddress con IPv4 e IPv6 mezclados y NotIpAddress como su negación", () => {
    const both = { IpAddress: { "aws:SourceIp": ["203.0.113.0/24", "2001:DB8:1234:5678::/64"] } };
    expect(holds(both, { "aws:SourceIp": "2001:db8:1234:5678::1" })).toBe(true);
    expect(holds(both, { "aws:SourceIp": "2001:db8:1234:9999::1" })).toBe(false);
    expect(
      holds({ NotIpAddress: { "aws:SourceIp": "203.0.113.0/24" } }, { "aws:SourceIp": "198.51.100.1" }),
    ).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("ArnLike con aws:SourceArn (ArnEquals y ArnLike se comportan igual): misma cuenta coincide, otra no, ausente no", () => {
    const condition = {
      ArnLike: { "aws:SourceArn": "arn:aws:sns:us-west-2:123456789012:TOPIC-ID" },
    };
    expect(holds(condition, { "aws:SourceArn": "arn:aws:sns:us-west-2:123456789012:TOPIC-ID" })).toBe(
      true,
    );
    expect(holds(condition, { "aws:SourceArn": "arn:aws:sns:us-west-2:777788889999:TOPIC-ID" })).toBe(
      false,
    );
    expect(holds(condition, {})).toBe(false);
  });
});

describe("condiciones doradas: Null, IfExists y calificadores", () => {
  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("Null con aws:TokenIssueTime igual a false exige que la clave exista", () => {
    const condition = { Null: { "aws:TokenIssueTime": "false" } };
    expect(holds(condition, { "aws:TokenIssueTime": "2021-06-01T00:00:00Z" })).toBe(true);
    expect(holds(condition, {})).toBe(false);
    expect(holds({ Null: { "aws:TokenIssueTime": "true" } }, {})).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("StringLikeIfExists con ec2:InstanceType: t1.micro coincide, m2.micro no y sin la clave sí", () => {
    const condition = { StringLikeIfExists: { "ec2:InstanceType": ["t1.*", "t2.*", "m3.*"] } };
    expect(holds(condition, { "ec2:InstanceType": "t1.micro" })).toBe(true);
    expect(holds(condition, { "ec2:InstanceType": "m2.micro" })).toBe(false);
    expect(holds(condition, {})).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-single-vs-multi-valued-context-keys.html
  it("ForAllValues:StringEquals con aws:TagKeys y Null igual a false: solo las claves de la política y nunca sin claves", () => {
    const condition = {
      "ForAllValues:StringEquals": { "aws:TagKeys": ["environment", "cost-center"] },
      Null: { "aws:TagKeys": "false" },
    };
    expect(holds(condition, { "aws:TagKeys": ["environment"] })).toBe(true);
    expect(holds(condition, { "aws:TagKeys": ["cost-center"] })).toBe(true);
    expect(holds(condition, { "aws:TagKeys": ["environment", "cost-center"] })).toBe(true);
    expect(holds(condition, { "aws:TagKeys": ["environment", "dept"] })).toBe(false);
    expect(holds(condition, {})).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-single-vs-multi-valued-context-keys.html
  it("ForAllValues sin la clave en la solicitud es verdadero si no hay Null que lo impida", () => {
    const condition = { "ForAllValues:StringEquals": { "aws:TagKeys": ["environment"] } };
    expect(holds(condition, {})).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-single-vs-multi-valued-context-keys.html
  it("ForAnyValue:StringEquals con aws:TagKeys: basta una clave coincidente y sin la clave no coincide", () => {
    const condition = {
      "ForAnyValue:StringEquals": { "aws:TagKeys": ["environment", "cost-center"] },
    };
    expect(holds(condition, { "aws:TagKeys": ["environment"] })).toBe(true);
    expect(holds(condition, { "aws:TagKeys": ["cost-center"] })).toBe(true);
    expect(holds(condition, { "aws:TagKeys": ["environment", "dept"] })).toBe(true);
    expect(holds(condition, { "aws:TagKeys": ["dept"] })).toBe(false);
    expect(holds(condition, {})).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html
  it("ForAllValues:ArnLike con logs:LogGeneratingResourceArns: todos deben coincidir con algún patrón", () => {
    const key = "logs:LogGeneratingResourceArns";
    const condition = {
      "ForAllValues:ArnLike": {
        [key]: [
          "arn:aws:cloudfront::123456789012:distribution/*",
          "arn:aws:cloudfront::123456789012:distribution/support*",
        ],
      },
    };
    expect(
      holds(condition, { [key]: ["arn:aws:cloudfront::123456789012:distribution/costcenter"] }),
    ).toBe(true);
    expect(
      holds(condition, {
        [key]: [
          "arn:aws:cloudfront::123456789012:distribution/costcenter",
          "arn:aws:cloudfront::123456789012:distribution/support2025",
        ],
      }),
    ).toBe(true);
    expect(
      holds(condition, { [key]: ["arn:aws:cloudfront::777788889999:distribution/costcenter"] }),
    ).toBe(false);
    expect(holds(condition, {})).toBe(true);
  });
});

describe("condiciones doradas: varias claves y valores", () => {
  const principalArns = [
    "arn:aws:iam::222222222222:user/Ana",
    "arn:aws:iam::222222222222:user/Mary",
  ];
  const keys = {
    "aws:PrincipalTag/department": ["finance", "hr", "legal"],
    "aws:PrincipalTag/role": ["audit", "security"],
  };
  const arnLike = { StringEquals: keys, ArnLike: { "aws:PrincipalArn": principalArns } };
  const arnNotLike = { StringEquals: keys, ArnNotLike: { "aws:PrincipalArn": principalArns } };
  const base = {
    "aws:PrincipalTag/department": "legal",
    "aws:PrincipalTag/role": "audit",
  };

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-logic-multiple-context-keys-or-values.html
  it("varias claves se combinan con Y y varios valores de una clave con O", () => {
    expect(
      holds(arnLike, { ...base, "aws:PrincipalArn": "arn:aws:iam::222222222222:user/Mary" }),
    ).toBe(true);
    expect(
      holds(arnLike, {
        "aws:PrincipalTag/department": "hr",
        "aws:PrincipalTag/role": "audit",
        "aws:PrincipalArn": "arn:aws:iam::222222222222:user/Nikki",
      }),
    ).toBe(false);
    expect(
      holds(arnLike, {
        "aws:PrincipalTag/department": "hr",
        "aws:PrincipalTag/role": "payroll",
        "aws:PrincipalArn": "arn:aws:iam::222222222222:user/Mary",
      }),
    ).toBe(false);
    expect(
      holds(arnLike, {
        "aws:PrincipalTag/department": "hr",
        "aws:PrincipalArn": "arn:aws:iam::222222222222:user/Mary",
      }),
    ).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-logic-multiple-context-keys-or-values.html
  it("un operador negado con varios valores funciona como NOR: no debe coincidir ninguno", () => {
    expect(
      holds(arnNotLike, { ...base, "aws:PrincipalArn": "arn:aws:iam::222222222222:user/Nikki" }),
    ).toBe(true);
    expect(
      holds(arnNotLike, { ...base, "aws:PrincipalArn": "arn:aws:iam::222222222222:user/Mary" }),
    ).toBe(false);
    expect(
      holds(arnNotLike, { ...base, "aws:PrincipalArn": "arn:aws:iam::222222222222:user/Ana" }),
    ).toBe(false);
  });
});
