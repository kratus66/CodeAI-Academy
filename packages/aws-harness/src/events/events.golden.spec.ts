import { describe, expect, it } from "vitest";
import { matches, validatePattern } from "./index.js";

const instanceEvent = {
  version: "0",
  id: "7bf73129-1428-4cd3-a780-95db273d1602",
  "detail-type": "EC2 Instance State-change Notification",
  source: "aws.ec2",
  account: "123456789012",
  time: "2015-11-11T21:29:54Z",
  region: "us-east-1",
  resources: ["arn:aws:ec2:us-east-1:123456789012:instance/i-abcd1111"],
  detail: {
    "instance-id": "i-abcd1111",
    state: "pending",
  },
};

describe("events: casos dorados de la guía de usuario de Amazon EventBridge", () => {
  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern.html
  it("el patrón solo menciona source, detail-type y detail.state; el resto del evento se ignora", () => {
    const pattern = {
      source: ["aws.ec2"],
      "detail-type": ["EC2 Instance State-change Notification"],
      detail: { state: ["terminated"] },
    };
    expect(matches(pattern, { ...instanceEvent, detail: { ...instanceEvent.detail, state: "terminated" } })).toBe(
      true,
    );
    expect(matches(pattern, instanceEvent)).toBe(false);
    expect(matches(pattern, { source: "aws.ec2", detail: { state: "terminated" } })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern.html
  it("varios valores en el arreglo son una O: aws.ec2 o aws.fargate", () => {
    const pattern = { source: ["aws.ec2", "aws.fargate"] };
    expect(matches(pattern, { source: "aws.ec2" })).toBe(true);
    expect(matches(pattern, { source: "aws.fargate" })).toBe(true);
    expect(matches(pattern, { source: "aws.s3" })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-filtering-data-types.html
  it("el evento de Macie con score 1 y count 2 coincide con el patrón de valores anidados", () => {
    const pattern = {
      source: ["aws.macie"],
      "detail-type": ["Macie Finding"],
      detail: { severity: { score: [1] }, count: [2] },
    };
    const event = {
      "detail-type": "Macie Finding",
      source: "aws.macie",
      detail: { severity: { score: 1, description: "Low" }, count: 2 },
    };
    expect(matches(pattern, event)).toBe(true);
    expect(matches(pattern, { ...event, detail: { severity: { score: 3 }, count: 2 } })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns-null-values.html
  it("la cadena vacía y null no son intercambiables", () => {
    const event = {
      "detail-type": "EC2 Instance Launch Successful",
      source: "aws.autoscaling",
      resources: [],
      detail: { eventVersion: "", responseElements: null },
    };
    expect(matches({ detail: { eventVersion: [""] } }, event)).toBe(true);
    expect(matches({ detail: { responseElements: [null] } }, event)).toBe(true);
    expect(matches({ detail: { eventVersion: [null] } }, event)).toBe(false);
    expect(matches({ detail: { responseElements: [""] } }, event)).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns-arrays.html
  it("con un arreglo en el evento basta que la intersección no esté vacía", () => {
    const pattern = {
      resources: [
        "arn:aws:ec2:us-east-1:123456789012:instance/i-b188560f",
        "arn:aws:ec2:us-east-1:111122223333:instance/i-b188560f",
        "arn:aws:ec2:us-east-1:444455556666:instance/i-b188560f",
      ],
    };
    const event = {
      resources: [
        "arn:aws:autoscaling:us-east-1:123456789012:autoScalingGroup:eb56d16b-bbf0-401d-b893-d5978ed4a025:autoScalingGroupName/ASGTerminate",
        "arn:aws:ec2:us-east-1:123456789012:instance/i-b188560f",
      ],
    };
    expect(matches(pattern, event)).toBe(true);
    expect(matches(pattern, { resources: ["arn:aws:ec2:us-east-1:999999999999:instance/i-b188560f"] })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("prefix: el campo time empieza por 2017-10-02", () => {
    const pattern = { time: [{ prefix: "2017-10-02" }] };
    expect(matches(pattern, { time: "2017-10-02T18:43:48Z" })).toBe(true);
    expect(matches(pattern, { time: "2017-10-03T18:43:48Z" })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("prefix con equals-ignore-case: EventB, EVENTB, eventb", () => {
    const pattern = { detail: { service: [{ prefix: { "equals-ignore-case": "EventB" } }] } };
    expect(matches(pattern, { detail: { service: "EventBridge" } })).toBe(true);
    expect(matches(pattern, { detail: { service: "EVENTBRIDGE" } })).toBe(true);
    expect(matches(pattern, { detail: { service: "eventbridge" } })).toBe(true);
    expect(matches(pattern, { detail: { service: "S3" } })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("suffix: FileName termina en .png, y con equals-ignore-case también .PNG", () => {
    expect(matches({ FileName: [{ suffix: ".png" }] }, { FileName: "a.png" })).toBe(true);
    expect(matches({ FileName: [{ suffix: ".png" }] }, { FileName: "a.PNG" })).toBe(false);
    const insensitive = { detail: { FileName: [{ suffix: { "equals-ignore-case": ".png" } }] } };
    expect(matches(insensitive, { detail: { FileName: "a.PNG" } })).toBe(true);
    expect(matches(insensitive, { detail: { FileName: "a.txt" } })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("anything-but con cadenas, números y listas", () => {
    const state = { detail: { state: [{ "anything-but": "initializing" }] } };
    expect(matches(state, { detail: { state: "running" } })).toBe(true);
    expect(matches(state, { detail: { state: "initializing" } })).toBe(false);
    const limit = { detail: { "x-limit": [{ "anything-but": 123 }] } };
    expect(matches(limit, { detail: { "x-limit": 124 } })).toBe(true);
    expect(matches(limit, { detail: { "x-limit": 123 } })).toBe(false);
    const strings = { detail: { state: [{ "anything-but": ["stopped", "overloaded"] }] } };
    expect(matches(strings, { detail: { state: "overloaded" } })).toBe(false);
    expect(matches(strings, { detail: { state: "running" } })).toBe(true);
    const numbers = { detail: { "x-limit": [{ "anything-but": [100, 200, 300] }] } };
    expect(matches(numbers, { detail: { "x-limit": 200 } })).toBe(false);
    expect(matches(numbers, { detail: { "x-limit": 201 } })).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("anything-but con equals-ignore-case, prefix y suffix", () => {
    const insensitive = { detail: { state: [{ "anything-but": { "equals-ignore-case": "initializing" } }] } };
    expect(matches(insensitive, { detail: { state: "INITIALIZING" } })).toBe(false);
    expect(matches(insensitive, { detail: { state: "stopped" } })).toBe(true);
    const insensitiveList = {
      detail: { state: [{ "anything-but": { "equals-ignore-case": ["initializing", "stopped"] } }] },
    };
    expect(matches(insensitiveList, { detail: { state: "Stopped" } })).toBe(false);
    const prefix = { detail: { state: [{ "anything-but": { prefix: "init" } }] } };
    expect(matches(prefix, { detail: { state: "initializing" } })).toBe(false);
    expect(matches(prefix, { detail: { state: "running" } })).toBe(true);
    const prefixes = { detail: { state: [{ "anything-but": { prefix: ["init", "stop"] } }] } };
    expect(matches(prefixes, { detail: { state: "stopped" } })).toBe(false);
    const suffixes = { detail: { FileName: [{ "anything-but": { suffix: [".txt", ".rtf"] } }] } };
    expect(matches(suffixes, { detail: { FileName: "a.rtf" } })).toBe(false);
    expect(matches(suffixes, { detail: { FileName: "a.png" } })).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("anything-but con wildcard: excluye rutas que contienen /lib/ o /bin/", () => {
    const one = { detail: { FilePath: [{ "anything-but": { wildcard: "*/lib/*" } }] } };
    expect(matches(one, { detail: { FilePath: "/usr/lib/libc.so" } })).toBe(false);
    expect(matches(one, { detail: { FilePath: "/usr/share/doc.txt" } })).toBe(true);
    const several = { detail: { FilePath: [{ "anything-but": { wildcard: ["*/lib/*", "*/bin/*"] } }] } };
    expect(matches(several, { detail: { FilePath: "/usr/bin/ls" } })).toBe(false);
    expect(matches(several, { detail: { FilePath: "/usr/share/doc.txt" } })).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("numeric: rangos y valor exacto, todos a la vez", () => {
    const pattern = {
      detail: {
        "c-count": [{ numeric: [">", 0, "<=", 5] }],
        "d-count": [{ numeric: ["<", 10] }],
        "x-limit": [{ numeric: ["=", 3.018e2] }],
      },
    };
    expect(matches(pattern, { detail: { "c-count": 5, "d-count": 9, "x-limit": 301.8 } })).toBe(true);
    expect(matches(pattern, { detail: { "c-count": 0, "d-count": 9, "x-limit": 301.8 } })).toBe(false);
    expect(matches(pattern, { detail: { "c-count": 6, "d-count": 9, "x-limit": 301.8 } })).toBe(false);
    expect(matches(pattern, { detail: { "c-count": 3, "d-count": 10, "x-limit": 301.8 } })).toBe(false);
    expect(matches(pattern, { detail: { "c-count": 3, "d-count": 9, "x-limit": 300 } })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("cidr: direcciones de 10.0.0.0 a 10.0.0.255", () => {
    const pattern = { detail: { sourceIPAddress: [{ cidr: "10.0.0.0/24" }] } };
    expect(matches(pattern, { detail: { sourceIPAddress: "10.0.0.0" } })).toBe(true);
    expect(matches(pattern, { detail: { sourceIPAddress: "10.0.0.255" } })).toBe(true);
    expect(matches(pattern, { detail: { sourceIPAddress: "10.0.1.0" } })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("exists: true exige detail.state y false exige su ausencia", () => {
    const present = { detail: { state: [{ exists: true }] } };
    const absent = { detail: { state: [{ exists: false }] } };
    const withoutState = {
      "detail-type": ["EC2 Instance State-change Notification"],
      resources: ["arn:aws:ec2:us-east-1:123456789012:instance/i-02ebd4584a2ebd341"],
      detail: { "c-count": { c1: 100 } },
    };
    expect(matches(present, instanceEvent)).toBe(true);
    expect(matches(present, withoutState)).toBe(false);
    expect(matches(absent, withoutState)).toBe(true);
    expect(matches(absent, instanceEvent)).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("equals-ignore-case: detail-type sin distinguir mayúsculas", () => {
    const pattern = { "detail-type": [{ "equals-ignore-case": "ec2 instance state-change notification" }] };
    expect(matches(pattern, { "detail-type": "EC2 Instance State-change Notification" })).toBe(true);
    expect(matches(pattern, { "detail-type": "EC2 Spot Instance Request Fulfillment" })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("wildcard: dir/*.png y los escapes de * y de la barra invertida", () => {
    const png = { FileName: [{ wildcard: "dir/*.png" }] };
    expect(matches(png, { FileName: "dir/photo.png" })).toBe(true);
    expect(matches(png, { FileName: "dir/photo.jpg" })).toBe(false);
    expect(matches(png, { FileName: "other/photo.png" })).toBe(false);
    expect(matches({ name: [{ wildcard: "a\\*b" }] }, { name: "a*b" })).toBe(true);
    expect(matches({ name: [{ wildcard: "a\\*b" }] }, { name: "aXb" })).toBe(false);
    expect(matches({ name: [{ wildcard: "a\\\\b" }] }, { name: "a\\b" })).toBe(true);
    expect(validatePattern({ name: [{ wildcard: "a**b" }] })).toHaveLength(1);
    expect(validatePattern({ name: [{ wildcard: "a\\nb" }] })).toHaveLength(1);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("combinación de prefix, anything-but y numeric en un mismo patrón", () => {
    const pattern = {
      time: [{ prefix: "2017-10-02" }],
      detail: {
        state: [{ "anything-but": "initializing" }],
        "c-count": [{ numeric: [">", 0, "<=", 5] }],
        "d-count": [{ numeric: ["<", 10] }],
        "x-limit": [{ "anything-but": [100, 200, 300] }],
      },
    };
    const event = {
      time: "2017-10-02T18:43:48Z",
      detail: { state: "running", "c-count": 2, "d-count": 4, "x-limit": 150 },
    };
    expect(matches(pattern, event)).toBe(true);
    expect(matches(pattern, { ...event, detail: { ...event.detail, "x-limit": 200 } })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("$or: basta cumplir la condición de c-count, de d-count o de x-limit", () => {
    const pattern = {
      detail: {
        $or: [
          { "c-count": [{ numeric: [">", 0, "<=", 5] }] },
          { "d-count": [{ numeric: ["<", 10] }] },
          { "x-limit": [{ numeric: ["=", 3.018e2] }] },
        ],
      },
    };
    expect(matches(pattern, { detail: { "c-count": 3 } })).toBe(true);
    expect(matches(pattern, { detail: { "d-count": 9 } })).toBe(true);
    expect(matches(pattern, { detail: { "x-limit": 301.8 } })).toBe(true);
    expect(matches(pattern, { detail: { "c-count": 9, "d-count": 10, "x-limit": 300 } })).toBe(false);
    expect(matches({ $or: [{ Location: ["New York"] }, { Day: ["Monday"] }] }, { Day: "Monday" })).toBe(true);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern-operators.html
  it("$or con más de 1000 combinaciones se rechaza: el producto de los argumentos de cada arreglo", () => {
    const options = (count: number) => Array.from({ length: count }, (_, index) => ({ [`f${index}`]: ["x"] }));
    expect(validatePattern({ detail: { $or: options(3) } })).toEqual([]);
    const tooMany = { a: { $or: options(40) }, b: { $or: options(26) } };
    expect(validatePattern(tooMany)).toHaveLength(1);
    expect(matches(tooMany, { a: { f0: "x" }, b: { f0: "x" } })).toBe(false);
  });

  // Fuente: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-pattern.html
  it("si un campo se repite en el patrón, solo cuenta el último", () => {
    const duplicated = JSON.parse(
      '{"source":["aws.s3"],"source":["aws.sns"],"detail-type":["AWS API Call via CloudTrail"],"detail":{"eventSource":["s3.amazonaws.com"],"eventSource":["sns.amazonaws.com"]}}',
    ) as unknown;
    const unique = {
      source: ["aws.sns"],
      "detail-type": ["AWS API Call via CloudTrail"],
      detail: { eventSource: ["sns.amazonaws.com"] },
    };
    const sns = {
      source: "aws.sns",
      "detail-type": "AWS API Call via CloudTrail",
      detail: { eventSource: "sns.amazonaws.com" },
    };
    const s3 = { ...sns, source: "aws.s3", detail: { eventSource: "s3.amazonaws.com" } };
    expect(matches(duplicated, sns)).toBe(true);
    expect(matches(duplicated, s3)).toBe(false);
    expect(matches(unique, sns)).toBe(true);
    expect(matches(unique, s3)).toBe(false);
  });
});
