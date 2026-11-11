import type { EvaluatorCapabilities } from "../core.js";

export const capabilities: EvaluatorCapabilities = {
  name: "cfn",
  version: "0.1.0",
  modeled: [
    "Plantillas en JSON: secciones de primer nivel (AWSTemplateFormatVersion, Description, Metadata, Parameters, Mappings, Conditions, Transform, Resources, Rules y Outputs), con Resources obligatoria",
    "AWSTemplateFormatVersion: el único valor válido es 2010-09-09",
    "Nombres lógicos alfanuméricos y únicos entre parámetros y recursos",
    "Resources: cada recurso es un objeto con Type (AWS::ServicioNombre::TipoRecurso) y Properties (objeto, opcional)",
    "Parameters: cada parámetro es un objeto con Type",
    "Outputs: cada salida es un objeto con Value, un Export con Name si se declara, Description literal de hasta 1024 bytes y un máximo de 200 salidas",
    "Ref hacia un parámetro, un recurso o un pseudoparámetro (AWS::AccountId, AWS::NotificationARNs, AWS::NoValue, AWS::Partition, AWS::Region, AWS::StackId, AWS::StackName y AWS::URLSuffix)",
    "Fn::GetAtt con la forma [recurso, atributo] hacia un recurso de la plantilla",
    "Fn::Sub con cadena sola o con la forma [cadena, mapa]: variables ${Nombre} y ${Recurso.Atributo}, literales ${!Texto} y variables del mapa",
    "Fn::Join con la forma [delimitador, lista]",
    "DependsOn como cadena o lista de cadenas hacia recursos existentes",
    "Orden de creación a partir de Ref, Fn::GetAtt, Fn::Sub y DependsOn, y detección de dependencias circulares",
    "Reglas de seguridad configurables: grupo de seguridad con ingreso desde 0.0.0.0/0 en un puerto dado (SecurityGroupIngress, CidrIp, IpProtocol, FromPort y ToPort) y bucket de S3 sin PublicAccessBlockConfiguration (o con alguna de sus cuatro opciones sin activar)",
  ],
  notModeled: [
    "YAML y sus etiquetas cortas (!Ref, !GetAtt, !Sub): solo se evalúa JSON",
    "Los nombres de atributo de Fn::GetAtt y las propiedades de cada tipo de recurso: no se comprueba que existan",
    "Fn::GetAtt con la forma de cadena Recurso.Atributo en JSON",
    "Recursos Custom:: y tipos de terceros: se rechazan por no tener la forma AWS::ServicioNombre::TipoRecurso",
    "Condiciones, Mappings, Rules, Transform y macros: sus contenidos no se evalúan, y las referencias dentro de Metadata no se siguen",
    "Funciones intrínsecas distintas de Ref, Fn::GetAtt, Fn::Sub y Fn::Join (Fn::If, Fn::Select, Fn::FindInMap…): se recorren sus argumentos sin evaluarlas",
    "Referencias dinámicas {{resolve:...}}, parámetros de tipos de AWS (AWS::EC2::...) y sus restricciones",
    "Reglas de seguridad para IPv6 (CidrIpv6), números de protocolo y el recurso AWS::EC2::SecurityGroupIngress independiente",
    "Límites de tamaño de la plantilla y de número de recursos",
  ],
  sources: [
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-anatomy.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resources-section-structure.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/format-version-structure.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/pseudo-parameter-reference.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-ref.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-getatt.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-sub.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-join.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-dependson.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-ec2-securitygroup.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-ec2-securitygroup-ingress.html",
    "https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-s3-bucket-publicaccessblockconfiguration.html",
  ],
};

/** Problema encontrado en una plantilla; `path` apunta al lugar (por ejemplo `Resources.Web.Properties`). */
export type Issue = { path: string; message: string };

/** Regla de seguridad configurable para `securityIssues`. */
export type SecurityRule =
  | { type: "sg-open-ingress"; port: number }
  | { type: "s3-no-public-access-block"; requireAll?: boolean };

type JsonRecord = Record<string, unknown>;

const SECTIONS: readonly string[] = [
  "AWSTemplateFormatVersion",
  "Description",
  "Metadata",
  "Parameters",
  "Mappings",
  "Conditions",
  "Transform",
  "Resources",
  "Rules",
  "Outputs",
];

const PSEUDO_PARAMETERS: readonly string[] = [
  "AWS::AccountId",
  "AWS::NotificationARNs",
  "AWS::NoValue",
  "AWS::Partition",
  "AWS::Region",
  "AWS::StackId",
  "AWS::StackName",
  "AWS::URLSuffix",
];

const FORMAT_VERSION = "2010-09-09";
const MAX_OUTPUTS = 200;
const MAX_DESCRIPTION_BYTES = 1024;
const LOGICAL_ID = /^[A-Za-z0-9]+$/;
const RESOURCE_TYPE = /^AWS::[A-Za-z0-9]+::[A-Za-z0-9]+$/;
const PUBLIC_ACCESS_BLOCK_OPTIONS: readonly string[] = [
  "BlockPublicAcls",
  "BlockPublicPolicy",
  "IgnorePublicAcls",
  "RestrictPublicBuckets",
];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function join(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

function byteLength(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

interface Names {
  readonly parameters: ReadonlySet<string>;
  readonly resources: ReadonlySet<string>;
}

interface Analysis {
  issues: Issue[];
  dependencies: Map<string, Set<string>>;
  resourceNames: string[];
}

function scanValue(value: unknown, path: string, names: Names, issues: Issue[], deps: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanValue(item, `${path}[${index}]`, names, issues, deps));
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  const keys = Object.keys(value);
  if (keys.length === 1) {
    const key = keys[0] as string;
    const argument = value[key];
    const argumentPath = join(path, key);
    if (key === "Ref") {
      scanRef(argument, argumentPath, names, issues, deps);
      return;
    }
    if (key === "Fn::GetAtt") {
      scanGetAtt(argument, argumentPath, names, issues, deps);
      return;
    }
    if (key === "Fn::Sub") {
      scanSub(argument, argumentPath, names, issues, deps);
      return;
    }
    if (key === "Fn::Join") {
      scanJoin(argument, argumentPath, names, issues, deps);
      return;
    }
  }
  for (const key of keys) {
    scanValue(value[key], join(path, key), names, issues, deps);
  }
}

function scanRef(argument: unknown, path: string, names: Names, issues: Issue[], deps: Set<string>): void {
  if (typeof argument === "string") {
    if (PSEUDO_PARAMETERS.includes(argument) || names.parameters.has(argument)) {
      return;
    }
    if (names.resources.has(argument)) {
      deps.add(argument);
      return;
    }
    issues.push({
      path,
      message: `Ref apunta a «${argument}», que no es un parámetro, un recurso ni un pseudoparámetro de la plantilla.`,
    });
    return;
  }
  if (isRecord(argument)) {
    scanValue(argument, path, names, issues, deps);
    return;
  }
  issues.push({ path, message: "Ref debe llevar el nombre lógico (texto) de un parámetro o de un recurso." });
}

function scanGetAtt(argument: unknown, path: string, names: Names, issues: Issue[], deps: Set<string>): void {
  if (!Array.isArray(argument) || argument.length !== 2 || typeof argument[0] !== "string") {
    issues.push({
      path,
      message: "Fn::GetAtt debe ser una lista [nombre lógico del recurso, nombre del atributo].",
    });
    return;
  }
  const resource = argument[0];
  const attribute: unknown = argument[1];
  if (names.resources.has(resource)) {
    deps.add(resource);
  } else if (names.parameters.has(resource)) {
    issues.push({ path, message: `Fn::GetAtt solo admite recursos y «${resource}» es un parámetro.` });
  } else {
    issues.push({ path, message: `Fn::GetAtt apunta al recurso «${resource}», que no existe en la plantilla.` });
  }
  if (typeof attribute === "string") {
    if (attribute === "") {
      issues.push({ path, message: "Fn::GetAtt necesita el nombre del atributo." });
    }
  } else if (isRecord(attribute)) {
    scanValue(attribute, `${path}[1]`, names, issues, deps);
  } else {
    issues.push({ path, message: "El atributo de Fn::GetAtt debe ser un texto." });
  }
}

function scanSub(argument: unknown, path: string, names: Names, issues: Issue[], deps: Set<string>): void {
  let template: unknown = argument;
  const local = new Set<string>();
  if (Array.isArray(argument)) {
    template = argument[0];
    const map: unknown = argument[1];
    if (argument.length !== 2 || typeof template !== "string" || !isRecord(map)) {
      issues.push({ path, message: "Fn::Sub con lista debe ser [cadena, mapa de variables]." });
      return;
    }
    for (const key of Object.keys(map)) {
      local.add(key);
      scanValue(map[key], `${path}[1].${key}`, names, issues, deps);
    }
  }
  if (typeof template !== "string") {
    issues.push({ path, message: "Fn::Sub debe ser una cadena o una lista [cadena, mapa de variables]." });
    return;
  }
  for (const match of template.matchAll(/\$\{([^}]*)\}/g)) {
    const variable = match[1] ?? "";
    if (variable.startsWith("!")) {
      continue;
    }
    if (variable === "") {
      issues.push({ path, message: "Fn::Sub contiene una variable vacía ${}." });
      continue;
    }
    if (local.has(variable) || PSEUDO_PARAMETERS.includes(variable) || names.parameters.has(variable)) {
      continue;
    }
    const dot = variable.indexOf(".");
    const root = dot === -1 ? variable : variable.slice(0, dot);
    if (names.resources.has(root)) {
      deps.add(root);
    } else if (dot !== -1 && names.parameters.has(root)) {
      issues.push({ path, message: `La variable «\${${variable}}» usa un atributo, pero «${root}» es un parámetro.` });
    } else {
      issues.push({
        path,
        message: `La variable «\${${variable}}» de Fn::Sub no es un parámetro, un recurso, un pseudoparámetro ni una variable del mapa.`,
      });
    }
  }
}

function scanJoin(argument: unknown, path: string, names: Names, issues: Issue[], deps: Set<string>): void {
  if (!Array.isArray(argument) || argument.length !== 2 || typeof argument[0] !== "string") {
    issues.push({ path, message: "Fn::Join debe ser una lista [delimitador, lista de valores]." });
    return;
  }
  const values: unknown = argument[1];
  if (!Array.isArray(values) && !isRecord(values)) {
    issues.push({ path, message: "Fn::Join necesita una lista de valores como segundo elemento." });
    return;
  }
  scanValue(values, `${path}[1]`, names, issues, deps);
}

function analyze(template: unknown): Analysis {
  const issues: Issue[] = [];
  const dependencies = new Map<string, Set<string>>();
  const resourceNames: string[] = [];
  if (!isRecord(template)) {
    issues.push({ path: "", message: "La plantilla debe ser un objeto JSON." });
    return { issues, dependencies, resourceNames };
  }
  for (const key of Object.keys(template)) {
    if (!SECTIONS.includes(key)) {
      issues.push({ path: key, message: `La sección «${key}» no existe en una plantilla de CloudFormation.` });
    }
  }
  const version = template["AWSTemplateFormatVersion"];
  if (version !== undefined && version !== FORMAT_VERSION) {
    issues.push({
      path: "AWSTemplateFormatVersion",
      message: `AWSTemplateFormatVersion debe ser el texto «${FORMAT_VERSION}», el único valor válido.`,
    });
  }

  const parameters = template["Parameters"];
  const parameterNames = new Set<string>();
  if (parameters !== undefined) {
    if (!isRecord(parameters)) {
      issues.push({ path: "Parameters", message: "«Parameters» debe ser un objeto con los parámetros." });
    } else {
      for (const name of Object.keys(parameters)) {
        parameterNames.add(name);
        const path = `Parameters.${name}`;
        if (!LOGICAL_ID.test(name)) {
          issues.push({ path, message: `El nombre lógico «${name}» debe ser alfanumérico (A-Za-z0-9).` });
        }
        const parameter = parameters[name];
        if (!isRecord(parameter)) {
          issues.push({ path, message: `El parámetro «${name}» debe ser un objeto.` });
        } else if (typeof parameter["Type"] !== "string" || parameter["Type"] === "") {
          issues.push({ path: `${path}.Type`, message: `El parámetro «${name}» necesita el atributo Type.` });
        }
      }
    }
  }

  const resources = template["Resources"];
  if (resources === undefined) {
    issues.push({ path: "Resources", message: "Falta la sección obligatoria «Resources»." });
    return { issues, dependencies, resourceNames };
  }
  if (!isRecord(resources)) {
    issues.push({ path: "Resources", message: "«Resources» debe ser un objeto con los recursos." });
    return { issues, dependencies, resourceNames };
  }
  const resourceSet = new Set(Object.keys(resources));
  const names: Names = { parameters: parameterNames, resources: resourceSet };

  for (const name of resourceSet) {
    resourceNames.push(name);
    const path = `Resources.${name}`;
    if (!LOGICAL_ID.test(name)) {
      issues.push({ path, message: `El nombre lógico «${name}» debe ser alfanumérico (A-Za-z0-9).` });
    }
    if (parameterNames.has(name)) {
      issues.push({ path, message: `El nombre lógico «${name}» se repite entre un parámetro y un recurso.` });
    }
    const deps = new Set<string>();
    dependencies.set(name, deps);
    const resource = resources[name];
    if (!isRecord(resource)) {
      issues.push({ path, message: `El recurso «${name}» debe ser un objeto.` });
      continue;
    }
    const type = resource["Type"];
    if (typeof type !== "string" || type === "") {
      issues.push({ path: `${path}.Type`, message: `El recurso «${name}» necesita el atributo Type.` });
    } else if (!RESOURCE_TYPE.test(type)) {
      issues.push({
        path: `${path}.Type`,
        message: `El tipo «${type}» no tiene la forma AWS::ServicioNombre::TipoRecurso.`,
      });
    }
    const properties = resource["Properties"];
    if (properties !== undefined) {
      if (!isRecord(properties)) {
        issues.push({ path: `${path}.Properties`, message: `Properties de «${name}» debe ser un objeto.` });
      } else {
        scanValue(properties, `${path}.Properties`, names, issues, deps);
      }
    }
    const dependsOn = resource["DependsOn"];
    if (dependsOn !== undefined) {
      const list: unknown[] = Array.isArray(dependsOn) ? dependsOn : [dependsOn];
      list.forEach((target, index) => {
        const targetPath = Array.isArray(dependsOn) ? `${path}.DependsOn[${index}]` : `${path}.DependsOn`;
        if (typeof target !== "string") {
          issues.push({ path: targetPath, message: "DependsOn debe ser un nombre lógico o una lista de nombres." });
        } else if (!resourceSet.has(target)) {
          issues.push({ path: targetPath, message: `DependsOn apunta a «${target}», que no es un recurso de la plantilla.` });
        } else {
          deps.add(target);
        }
      });
    }
  }

  const outputs = template["Outputs"];
  if (outputs !== undefined) {
    if (!isRecord(outputs)) {
      issues.push({ path: "Outputs", message: "«Outputs» debe ser un objeto con las salidas." });
    } else {
      const outputNames = Object.keys(outputs);
      if (outputNames.length > MAX_OUTPUTS) {
        issues.push({ path: "Outputs", message: `Una plantilla admite como máximo ${MAX_OUTPUTS} salidas.` });
      }
      for (const name of outputNames) {
        const path = `Outputs.${name}`;
        if (!LOGICAL_ID.test(name)) {
          issues.push({ path, message: `El nombre lógico «${name}» debe ser alfanumérico (A-Za-z0-9).` });
        }
        const output = outputs[name];
        if (!isRecord(output)) {
          issues.push({ path, message: `La salida «${name}» debe ser un objeto.` });
          continue;
        }
        if (!Object.prototype.hasOwnProperty.call(output, "Value")) {
          issues.push({ path: `${path}.Value`, message: `La salida «${name}» necesita el atributo Value.` });
        } else {
          scanValue(output["Value"], `${path}.Value`, names, issues, new Set<string>());
        }
        const description = output["Description"];
        if (description !== undefined) {
          if (typeof description !== "string") {
            issues.push({ path: `${path}.Description`, message: "Description debe ser un texto literal." });
          } else if (byteLength(description) > MAX_DESCRIPTION_BYTES) {
            issues.push({
              path: `${path}.Description`,
              message: `Description admite como máximo ${MAX_DESCRIPTION_BYTES} bytes.`,
            });
          }
        }
        const exported = output["Export"];
        if (exported !== undefined) {
          if (!isRecord(exported) || !Object.prototype.hasOwnProperty.call(exported, "Name")) {
            issues.push({ path: `${path}.Export`, message: "Export debe ser un objeto con el atributo Name." });
          } else {
            scanValue(exported["Name"], `${path}.Export.Name`, names, issues, new Set<string>());
          }
        }
      }
    }
  }
  return { issues, dependencies, resourceNames };
}

function order(analysis: Analysis): { placed: string[]; remaining: string[] } {
  const placed: string[] = [];
  const done = new Set<string>();
  let progress = true;
  while (progress) {
    progress = false;
    for (const name of analysis.resourceNames) {
      if (done.has(name)) {
        continue;
      }
      const deps = analysis.dependencies.get(name) ?? new Set<string>();
      if ([...deps].every((dep) => done.has(dep))) {
        done.add(name);
        placed.push(name);
        progress = true;
        break;
      }
    }
  }
  return { placed, remaining: analysis.resourceNames.filter((name) => !done.has(name)) };
}

function cycleMembers(analysis: Analysis, remaining: string[]): string[] {
  let members = [...remaining];
  let changed = true;
  while (changed) {
    changed = false;
    const set = new Set(members);
    const kept = members.filter((name) =>
      members.some((other) => analysis.dependencies.get(other)?.has(name) === true && set.has(other)),
    );
    if (kept.length !== members.length) {
      members = kept;
      changed = true;
    }
  }
  return members;
}

/** Valida estructura, referencias (Ref, Fn::GetAtt, Fn::Sub), pseudoparámetros y ciclos. Nunca lanza. */
export function validateTemplate(t: unknown): Issue[] {
  const analysis = analyze(t);
  const issues = [...analysis.issues];
  if (analysis.resourceNames.length > 0) {
    const { remaining } = order(analysis);
    if (remaining.length > 0) {
      const members = cycleMembers(analysis, remaining);
      issues.push({
        path: "Resources",
        message: `Hay una dependencia circular entre los recursos: ${members.join(", ")}.`,
      });
    }
  }
  return issues;
}

/** Orden de creación (dependencias primero, desempate por orden de declaración); `null` si hay ciclo o no hay Resources. */
export function dependencyOrder(t: unknown): string[] | null {
  const analysis = analyze(t);
  if (!isRecord(t) || !isRecord(t["Resources"])) {
    return null;
  }
  const { placed, remaining } = order(analysis);
  return remaining.length > 0 ? null : placed;
}

function portOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

function opensPort(entry: unknown, port: number): boolean {
  if (!isRecord(entry) || entry["CidrIp"] !== "0.0.0.0/0") {
    return false;
  }
  const protocol = entry["IpProtocol"];
  if (protocol === "-1" || protocol === -1) {
    return true;
  }
  if (protocol !== "tcp" && protocol !== "udp") {
    return false;
  }
  const from = portOf(entry["FromPort"]);
  const to = portOf(entry["ToPort"]);
  return from !== null && to !== null && from <= port && port <= to;
}

/** Aplica las reglas de seguridad a los recursos de la plantilla. Nunca lanza. */
export function securityIssues(t: unknown, rules: readonly SecurityRule[]): Issue[] {
  const issues: Issue[] = [];
  if (!isRecord(t) || !isRecord(t["Resources"])) {
    return issues;
  }
  const resources = t["Resources"];
  for (const name of Object.keys(resources)) {
    const resource = resources[name];
    if (!isRecord(resource)) {
      continue;
    }
    const properties = isRecord(resource["Properties"]) ? resource["Properties"] : {};
    const base = `Resources.${name}.Properties`;
    for (const rule of rules) {
      if (rule.type === "sg-open-ingress" && resource["Type"] === "AWS::EC2::SecurityGroup") {
        const ingress = properties["SecurityGroupIngress"];
        if (Array.isArray(ingress)) {
          ingress.forEach((entry: unknown, index) => {
            if (opensPort(entry, rule.port)) {
              issues.push({
                path: `${base}.SecurityGroupIngress[${index}]`,
                message: `El grupo de seguridad «${name}» permite el ingreso desde 0.0.0.0/0 al puerto ${rule.port}.`,
              });
            }
          });
        }
      }
      if (rule.type === "s3-no-public-access-block" && resource["Type"] === "AWS::S3::Bucket") {
        const block = properties["PublicAccessBlockConfiguration"];
        if (block === undefined) {
          issues.push({
            path: `${base}.PublicAccessBlockConfiguration`,
            message: `El bucket «${name}» no declara PublicAccessBlockConfiguration.`,
          });
        } else if (rule.requireAll === true) {
          const config = isRecord(block) ? block : {};
          for (const option of PUBLIC_ACCESS_BLOCK_OPTIONS) {
            if (config[option] !== true) {
              issues.push({
                path: `${base}.PublicAccessBlockConfiguration.${option}`,
                message: `El bucket «${name}» no activa ${option} en PublicAccessBlockConfiguration.`,
              });
            }
          }
        }
      }
    }
  }
  return issues;
}

export function canary(): boolean {
  const template = {
    Resources: {
      Ec2Instance: {
        Type: "AWS::EC2::Instance",
        Properties: { SecurityGroupIds: [{ Ref: "InstanceSecurityGroup" }, "sg-12a4c434"] },
      },
      InstanceSecurityGroup: {
        Type: "AWS::EC2::SecurityGroup",
        Properties: {
          GroupDescription: "Enable SSH access via port 22",
          SecurityGroupIngress: [{ IpProtocol: "tcp", FromPort: 22, ToPort: 22, CidrIp: "0.0.0.0/0" }],
        },
      },
      MyBucket: { Type: "AWS::S3::Bucket" },
    },
  };
  const sequence = dependencyOrder(template);
  if (
    validateTemplate(template).length !== 0 ||
    sequence === null ||
    sequence.indexOf("InstanceSecurityGroup") > sequence.indexOf("Ec2Instance")
  ) {
    return false;
  }
  const found = securityIssues(template, [
    { type: "sg-open-ingress", port: 22 },
    { type: "s3-no-public-access-block" },
  ]);
  if (found.length !== 2 || securityIssues(template, [{ type: "sg-open-ingress", port: 80 }]).length !== 0) {
    return false;
  }
  const cyclic = {
    Resources: {
      A: { Type: "AWS::SNS::Topic", DependsOn: "B" },
      B: { Type: "AWS::SNS::Topic", Properties: { DisplayName: { Ref: "A" } } },
    },
  };
  return dependencyOrder(cyclic) === null && validateTemplate(cyclic).length === 1;
}
