import { describe, expect, it } from "vitest";
import { aws, listCapabilities, selfTest } from "../index.js";
import { canary, capabilities, dependencyOrder, securityIssues, validateTemplate } from "./index.js";

const topic = (extra: Record<string, unknown> = {}) => ({ Type: "AWS::SNS::Topic", ...extra });

describe("cfn: registro y capacidades", () => {
  it("el canario pasa y el evaluador está registrado como aws.cfn", () => {
    expect(canary()).toBe(true);
    expect(selfTest()).toBe(true);
    expect(aws.cfn.validateTemplate).toBe(validateTemplate);
    expect(listCapabilities().map((item) => item.name)).toContain("cfn");
  });

  it("declara qué modela y qué no, con fuentes oficiales", () => {
    expect(capabilities.name).toBe("cfn");
    expect(capabilities.modeled.length).toBeGreaterThan(0);
    expect(capabilities.notModeled.join(" ")).toContain("YAML");
    expect(capabilities.sources.every((url) => url.startsWith("https://docs.aws.amazon.com/"))).toBe(true);
  });
});

describe("cfn: entradas inválidas no lanzan", () => {
  it.each([null, undefined, 3, "texto", [], true])("validateTemplate(%j) devuelve un problema", (input) => {
    expect(validateTemplate(input)).toHaveLength(1);
    expect(dependencyOrder(input)).toBeNull();
    expect(securityIssues(input, [{ type: "sg-open-ingress", port: 22 }])).toEqual([]);
  });

  it("secciones y recursos con forma incorrecta", () => {
    expect(validateTemplate({ Resources: [] })).toHaveLength(1);
    expect(validateTemplate({ Resources: { A: 1 } })).toHaveLength(1);
    expect(validateTemplate({ Resources: { A: topic({ Properties: [] }) } })).toHaveLength(1);
    expect(validateTemplate({ Resources: { A: {} } })).toHaveLength(1);
    expect(validateTemplate({ Resources: { A: topic() }, Extra: {} })).toHaveLength(1);
    expect(validateTemplate({ Parameters: [], Resources: { A: topic() } })).toHaveLength(1);
    expect(validateTemplate({ Outputs: 1, Resources: { A: topic() } })).toHaveLength(1);
  });

  it("un nombre repetido entre parámetro y recurso se informa", () => {
    const template = { Parameters: { A: { Type: "String" } }, Resources: { A: topic() } };
    expect(validateTemplate(template)).toHaveLength(1);
  });
});

describe("cfn: referencias", () => {
  const wrap = (properties: unknown) => ({ Resources: { A: topic({ Properties: properties }), B: topic() } });
  const withParameter = (value: unknown) => ({
    Parameters: { P: { Type: "String" } },
    Resources: { A: topic({ Properties: { X: value } }) },
  });

  it("Ref con forma incorrecta o hacia algo que no existe", () => {
    expect(validateTemplate(wrap({ X: { Ref: 3 } }))).toHaveLength(1);
    expect(validateTemplate(wrap({ X: { Ref: "Nada" } }))).toHaveLength(1);
    expect(validateTemplate(wrap({ X: { Ref: "B" } }))).toEqual([]);
    expect(validateTemplate(wrap({ X: { Ref: { "Fn::Sub": "${AWS::Region}" } } }))).toEqual([]);
  });

  it("Fn::GetAtt: forma, parámetro y atributo vacío", () => {
    expect(validateTemplate(wrap({ X: { "Fn::GetAtt": "B.Arn" } }))).toHaveLength(1);
    expect(validateTemplate(wrap({ X: { "Fn::GetAtt": ["B"] } }))).toHaveLength(1);
    expect(validateTemplate(wrap({ X: { "Fn::GetAtt": ["B", ""] } }))).toHaveLength(1);
    expect(validateTemplate(wrap({ X: { "Fn::GetAtt": ["B", 2] } }))).toHaveLength(1);
    expect(validateTemplate(wrap({ X: { "Fn::GetAtt": ["B", "TopicName"] } }))).toEqual([]);
    expect(validateTemplate(withParameter({ "Fn::GetAtt": ["P", "x"] }))).toHaveLength(1);
  });

  it("Fn::Sub: variables de recursos con atributo, de parámetros y de mapa", () => {
    expect(validateTemplate(wrap({ X: { "Fn::Sub": "${B.Arn}" } }))).toEqual([]);
    expect(validateTemplate(wrap({ X: { "Fn::Sub": "${Nada.Arn}" } }))).toHaveLength(1);
    expect(validateTemplate(wrap({ X: { "Fn::Sub": "${}" } }))).toHaveLength(1);
    expect(validateTemplate(wrap({ X: { "Fn::Sub": 5 } }))).toHaveLength(1);
    expect(validateTemplate(wrap({ X: { "Fn::Sub": ["${V}", "mal"] } }))).toHaveLength(1);
    expect(validateTemplate(wrap({ X: { "Fn::Sub": ["${V}", { V: { Ref: "Nada" } }] } }))).toHaveLength(1);
    expect(validateTemplate(withParameter({ "Fn::Sub": "${P.x}" }))).toHaveLength(1);
    expect(validateTemplate(withParameter({ "Fn::Sub": "${P}" }))).toEqual([]);
  });

  it("las referencias dentro de listas y objetos anidados se recorren con su ruta", () => {
    const issues = validateTemplate(wrap({ Lista: [{ Ref: "B" }, { Ref: "Nada" }] }));
    expect(issues.map((issue) => issue.path)).toEqual(["Resources.A.Properties.Lista[1].Ref"]);
  });

  it("Description de una salida: debe ser texto y no pasar de 1024 bytes", () => {
    const base = { Resources: { A: topic() } };
    expect(validateTemplate({ ...base, Outputs: { O: { Value: "x", Description: 5 } } })).toHaveLength(1);
    expect(validateTemplate({ ...base, Outputs: { O: { Value: "x", Description: "a".repeat(1025) } } })).toHaveLength(1);
    expect(validateTemplate({ ...base, Outputs: { O: { Value: "x", Description: "é".repeat(513) } } })).toHaveLength(1);
    expect(validateTemplate({ ...base, Outputs: { O: { Value: "x", Description: "a".repeat(1024) } } })).toEqual([]);
  });

  it("más de 200 salidas se informa", () => {
    const outputs: Record<string, unknown> = {};
    for (let index = 0; index < 201; index += 1) {
      outputs[`O${index}`] = { Value: "x" };
    }
    expect(validateTemplate({ Resources: { A: topic() }, Outputs: outputs })).toHaveLength(1);
  });
});

describe("cfn: orden de dependencias y ciclos", () => {
  it("sin dependencias conserva el orden de declaración", () => {
    expect(dependencyOrder({ Resources: { B: topic(), A: topic() } })).toEqual(["B", "A"]);
  });

  it("un ciclo con Ref, GetAtt y DependsOn devuelve null y se informa con sus miembros", () => {
    const template = {
      Resources: {
        A: topic({ DependsOn: "B" }),
        B: topic({ Properties: { DisplayName: { Ref: "C" } } }),
        C: topic({ Properties: { DisplayName: { "Fn::GetAtt": ["A", "TopicName"] } } }),
        D: topic({ Properties: { DisplayName: { Ref: "A" } } }),
        E: topic(),
      },
    };
    expect(dependencyOrder(template)).toBeNull();
    expect(validateTemplate(template)).toEqual([
      { path: "Resources", message: "Hay una dependencia circular entre los recursos: A, B, C." },
    ]);
  });

  it("un recurso que se referencia a sí mismo es un ciclo", () => {
    const template = { Resources: { A: topic({ Properties: { DisplayName: { "Fn::Sub": "${A}" } } }) } };
    expect(dependencyOrder(template)).toBeNull();
  });

  it("las variables del mapa de Fn::Sub no crean dependencias", () => {
    const template = {
      Resources: { A: topic({ Properties: { X: { "Fn::Sub": ["${B}", { B: "valor" }] } } }), B: topic() },
    };
    expect(dependencyOrder(template)).toEqual(["A", "B"]);
  });
});

describe("cfn: reglas de seguridad", () => {
  const sg = (ingress: unknown) => ({
    Resources: {
      Sg: { Type: "AWS::EC2::SecurityGroup", Properties: { GroupDescription: "x", SecurityGroupIngress: ingress } },
    },
  });
  const rule = [{ type: "sg-open-ingress", port: 22 }] as const;

  it("el rango de puertos incluye o no el puerto pedido", () => {
    expect(securityIssues(sg([{ IpProtocol: "tcp", FromPort: 20, ToPort: 25, CidrIp: "0.0.0.0/0" }]), rule)).toHaveLength(1);
    expect(securityIssues(sg([{ IpProtocol: "udp", FromPort: "22", ToPort: "22", CidrIp: "0.0.0.0/0" }]), rule)).toHaveLength(1);
    expect(securityIssues(sg([{ IpProtocol: "tcp", FromPort: 23, ToPort: 25, CidrIp: "0.0.0.0/0" }]), rule)).toEqual([]);
    expect(securityIssues(sg([{ IpProtocol: "tcp", CidrIp: "0.0.0.0/0" }]), rule)).toEqual([]);
    expect(securityIssues(sg([{ IpProtocol: "icmp", FromPort: -1, ToPort: -1, CidrIp: "0.0.0.0/0" }]), rule)).toEqual([]);
    expect(securityIssues(sg([{ IpProtocol: "tcp", FromPort: 22, ToPort: 22, CidrIp: "10.0.0.0/8" }]), rule)).toEqual([]);
    expect(securityIssues(sg([{ IpProtocol: "tcp", FromPort: 22, ToPort: 22, CidrIp: { Ref: "P" } }]), rule)).toEqual([]);
  });

  it("varias entradas informan cada índice y las formas raras no lanzan", () => {
    const template = sg([
      { IpProtocol: "tcp", FromPort: 22, ToPort: 22, CidrIp: "0.0.0.0/0" },
      "texto",
      { IpProtocol: "tcp", FromPort: 22, ToPort: 22, CidrIp: "0.0.0.0/0" },
    ]);
    expect(securityIssues(template, rule).map((issue) => issue.path)).toEqual([
      "Resources.Sg.Properties.SecurityGroupIngress[0]",
      "Resources.Sg.Properties.SecurityGroupIngress[2]",
    ]);
    expect(securityIssues(sg("nada"), rule)).toEqual([]);
    expect(securityIssues({ Resources: { A: 1, B: { Type: "AWS::EC2::SecurityGroup" } } }, rule)).toEqual([]);
  });

  it("sin reglas no hay problemas y las reglas se aplican por tipo de recurso", () => {
    const template = {
      Resources: {
        Bucket: { Type: "AWS::S3::Bucket", Properties: { PublicAccessBlockConfiguration: "mal" } },
        Other: { Type: "AWS::SNS::Topic" },
      },
    };
    expect(securityIssues(template, [])).toEqual([]);
    expect(securityIssues(template, [{ type: "s3-no-public-access-block" }])).toEqual([]);
    expect(securityIssues(template, [{ type: "s3-no-public-access-block", requireAll: true }])).toHaveLength(4);
  });
});
