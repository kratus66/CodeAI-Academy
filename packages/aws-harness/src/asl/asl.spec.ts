import { describe, expect, it } from "vitest";
import { aws, listCapabilities, selfTest } from "../index.js";
import { canary, capabilities, reachableStates, validateStateMachine } from "./index.js";

const lambda = "arn:aws:lambda:region:123456789012:function:FUNCTION_NAME";
const paths = (def: unknown): string[] => validateStateMachine(def).map((issue) => issue.path);

describe("asl: registro y capacidades", () => {
  it("el canario pasa y el evaluador está registrado como aws.asl", () => {
    expect(canary()).toBe(true);
    expect(selfTest()).toBe(true);
    expect(aws.asl.validateStateMachine).toBe(validateStateMachine);
    expect(listCapabilities().map((item) => item.name)).toContain("asl");
  });

  it("declara qué modela y qué no, con fuentes oficiales", () => {
    expect(capabilities.name).toBe("asl");
    expect(capabilities.modeled.length).toBeGreaterThan(0);
    expect(capabilities.notModeled.join(" ")).toContain("JSONata");
    expect(capabilities.sources.every((url) => url.startsWith("https://docs.aws.amazon.com/step-functions/"))).toBe(true);
  });
});

describe("asl: entradas inválidas no lanzan", () => {
  it.each([null, undefined, 3, "texto", [], true])("validateStateMachine(%j) devuelve un problema", (input) => {
    expect(validateStateMachine(input)).toHaveLength(1);
    expect(reachableStates(input)).toEqual([]);
  });

  it("estructuras con forma incorrecta", () => {
    expect(paths({})).toEqual(["States", "StartAt"]);
    expect(paths({ StartAt: 3, States: [] })).toEqual(["States", "StartAt"]);
    expect(paths({ StartAt: "A", States: { A: 5 } })).toEqual(["States.A", "States"]);
    expect(paths({ StartAt: "A", States: { A: { Type: "Nada" } } })).toContain("States.A.Type");
    expect(paths({ StartAt: "A", States: { A: {} } })).toContain("States.A.Type");
    expect(paths({ Comment: 3, StartAt: "A", States: { A: { Type: "Succeed" } } })).toEqual(["Comment"]);
  });
});

describe("asl: StartAt, transiciones y alcance", () => {
  it("StartAt inexistente", () => {
    const issues = validateStateMachine({
      StartAt: "Falta",
      States: { A: { Type: "Pass", Next: "B" }, B: { Type: "Pass", End: true } },
    });
    expect(issues).toEqual([{ path: "StartAt", message: "StartAt apunta a «Falta», que no existe en States." }]);
  });

  it("Next inexistente con StartAt correcto", () => {
    expect(
      validateStateMachine({ StartAt: "A", States: { A: { Type: "Pass", Next: "Nada" }, B: { Type: "Succeed" } } }),
    ).toEqual([
      { path: "States.A.Next", message: "Next apunta a «Nada», que no existe en este bloque de estados." },
      { path: "States.B", message: "El estado «B» es inalcanzable desde StartAt «A»." },
    ]);
  });

  it("Next y End a la vez, End inválido y falta de ambos", () => {
    expect(paths({ StartAt: "A", States: { A: { Type: "Pass", Next: "B", End: true }, B: { Type: "Succeed" } } })).toEqual(["States.A"]);
    expect(paths({ StartAt: "A", States: { A: { Type: "Pass", End: "sí" } } })).toEqual(["States.A.End", "States.A", "States"]);
    expect(paths({ StartAt: "A", States: { A: { Type: "Pass", Next: "B" }, B: { Type: "Pass" } } })).toEqual(["States.B", "States"]);
    expect(paths({ StartAt: "A", States: { A: { Type: "Pass", Next: 3 } } })).toContain("States.A.Next");
  });

  it("máquina sin estados terminales y ciclos alcanzables", () => {
    const cycle = { StartAt: "A", States: { A: { Type: "Pass", Next: "B" }, B: { Type: "Pass", Next: "A" } } };
    expect(validateStateMachine(cycle)).toEqual([
      { path: "States", message: "Ningún estado es terminal: hace falta un Succeed, un Fail o un estado con End: true." },
    ]);
    expect(reachableStates(cycle)).toEqual(["A", "B"]);
  });

  it("Choice, Default y Catch cuentan como transiciones para el alcance", () => {
    const machine = {
      StartAt: "T",
      States: {
        T: { Type: "Task", Resource: lambda, Catch: [{ ErrorEquals: ["States.ALL"], Next: "Rescue" }], Next: "C" },
        C: { Type: "Choice", Choices: [{ Variable: "$.a", BooleanEquals: true, Next: "Yes" }], Default: "No" },
        Yes: { Type: "Succeed" },
        No: { Type: "Fail" },
        Rescue: { Type: "Succeed" },
        Orphan: { Type: "Succeed" },
      },
    };
    expect(reachableStates(machine)).toEqual(["T", "C", "Rescue", "Yes", "No"]);
    expect(paths(machine)).toEqual(["States.Orphan"]);
  });

  it("Succeed, Fail y Choice no admiten End", () => {
    expect(paths({ StartAt: "F", States: { F: { Type: "Fail", End: true } } })).toEqual(["States.F.End"]);
    expect(
      paths({
        StartAt: "C",
        States: {
          C: { Type: "Choice", Choices: [{ Variable: "$.a", IsNull: true, Next: "C" }], Default: "C", End: true, Next: "C" },
        },
      }),
    ).toEqual(["States.C.Next", "States.C.End"]);
  });
});

describe("asl: Choice", () => {
  const choice = (rule: unknown, extra: Record<string, unknown> = { Default: "Done" }) => ({
    StartAt: "C",
    States: { C: { Type: "Choice", Choices: [rule], ...extra }, Done: { Type: "Succeed" } },
  });

  it("Choices vacío y Default inexistente o inválido", () => {
    expect(
      paths({ StartAt: "C", States: { C: { Type: "Choice", Choices: [], Default: "Done" }, Done: { Type: "Succeed" } } }),
    ).toEqual(["States.C.Choices"]);
    expect(paths(choice({ Variable: "$.a", IsNull: true, Next: "Done" }, { Default: "Nada" }))).toEqual(["States.C.Default"]);
    expect(paths(choice({ Variable: "$.a", IsNull: true, Next: "Done" }, { Default: 3 }))).toEqual(["States.C.Default"]);
  });

  it("reglas sin operador, con varios operadores o sin Variable", () => {
    expect(paths(choice({ Variable: "$.a", Next: "Done" }))).toEqual(["States.C.Choices[0]"]);
    expect(paths(choice({ Variable: "$.a", NumericEquals: 1, StringEquals: "a", Next: "Done" }))).toEqual(["States.C.Choices[0]"]);
    expect(paths(choice({ NumericEquals: 1, Next: "Done" }))).toEqual(["States.C.Choices[0].Variable"]);
    expect(paths(choice({ Variable: "foo", NumericEquals: 1, Next: "Done" }))).toEqual(["States.C.Choices[0].Variable"]);
    expect(paths(choice("regla"))).toEqual(["States.C.Choices[0]"]);
  });

  it("tipos de valor de cada operador", () => {
    expect(paths(choice({ Variable: "$.a", NumericEquals: "1", Next: "Done" }))).toEqual(["States.C.Choices[0].NumericEquals"]);
    expect(paths(choice({ Variable: "$.a", StringEquals: 1, Next: "Done" }))).toEqual(["States.C.Choices[0].StringEquals"]);
    expect(paths(choice({ Variable: "$.a", BooleanEquals: "true", Next: "Done" }))).toEqual(["States.C.Choices[0].BooleanEquals"]);
    expect(paths(choice({ Variable: "$.a", IsPresent: 1, Next: "Done" }))).toEqual(["States.C.Choices[0].IsPresent"]);
    expect(paths(choice({ Variable: "$.a", TimestampLessThan: "2001-01-01 12:00:00", Next: "Done" }))).toEqual([
      "States.C.Choices[0].TimestampLessThan",
    ]);
    expect(paths(choice({ Variable: "$.a", NumericLessThanPath: "bar", Next: "Done" }))).toEqual([
      "States.C.Choices[0].NumericLessThanPath",
    ]);
    expect(paths(choice({ Variable: "$.a", NumericLessThanEqualsPath: "$.b", Next: "Done" }))).toEqual([]);
  });

  it("And, Or y Not con contenido incorrecto", () => {
    expect(paths(choice({ And: [], Next: "Done" }))).toEqual(["States.C.Choices[0].And"]);
    expect(paths(choice({ Or: "x", Next: "Done" }))).toEqual(["States.C.Choices[0].Or"]);
    expect(paths(choice({ Not: [], Next: "Done" }))).toEqual(["States.C.Choices[0].Not"]);
    expect(paths(choice({ Not: { Variable: "$.a", IsNull: true, Next: "Done" }, Next: "Done" }))).toEqual([
      "States.C.Choices[0].Not.Next",
    ]);
    expect(
      paths(choice({ Or: [{ Variable: "$.a", IsNull: true }, { Variable: "$.b", NumericEquals: 2 }], Next: "Done" })),
    ).toEqual([]);
  });

  it("regla de primer nivel sin Next o con Next inexistente", () => {
    expect(paths(choice({ Variable: "$.a", IsNull: true }))).toEqual(["States.C.Choices[0].Next"]);
    expect(paths(choice({ Variable: "$.a", IsNull: true, Next: "Nada" }))).toEqual(["States.C.Choices[0].Next"]);
  });

  it("en JSONata las reglas se validan solo por su Next", () => {
    const machine = {
      QueryLanguage: "JSONata",
      StartAt: "C",
      States: {
        C: {
          Type: "Choice",
          Choices: [{ Condition: "{% $x = 1 %}", Next: "Done" }, { Condition: "{% $x = 2 %}" }],
          Default: "Done",
        },
        Done: { Type: "Succeed" },
      },
    };
    expect(paths(machine)).toEqual(["States.C.Choices[1]"]);
  });
});

describe("asl: Retry y Catch", () => {
  const task = (extra: Record<string, unknown>) => ({
    StartAt: "T",
    States: { T: { Type: "Task", Resource: lambda, End: true, ...extra }, F: { Type: "Fail" } },
  });
  const inTask = (def: unknown): string[] => paths(def).filter((path) => path.startsWith("States.T"));

  it("Retry y Catch solo en Task, Parallel y Map", () => {
    expect(paths({ StartAt: "P", States: { P: { Type: "Pass", End: true, Retry: [] } } })).toEqual(["States.P.Retry"]);
    expect(paths({ StartAt: "P", States: { P: { Type: "Wait", Seconds: 1, End: true, Catch: [] } } })).toEqual(["States.P.Catch"]);
  });

  it("ErrorEquals ausente, vacío o con nombres incorrectos", () => {
    expect(inTask(task({ Retry: [{}] }))).toEqual(["States.T.Retry[0].ErrorEquals"]);
    expect(inTask(task({ Retry: [{ ErrorEquals: [] }] }))).toEqual(["States.T.Retry[0].ErrorEquals"]);
    expect(inTask(task({ Retry: [{ ErrorEquals: [3] }] }))).toEqual(["States.T.Retry[0].ErrorEquals[0]"]);
    expect(inTask(task({ Retry: [{ ErrorEquals: ["States.Inventado"] }] }))).toEqual(["States.T.Retry[0].ErrorEquals[0]"]);
    expect(inTask(task({ Retry: "no" }))).toEqual(["States.T.Retry"]);
    expect(inTask(task({ Retry: ["no"] }))).toEqual(["States.T.Retry[0]"]);
  });

  it("rangos de IntervalSeconds, MaxAttempts, BackoffRate, MaxDelaySeconds y JitterStrategy", () => {
    const bad = {
      ErrorEquals: ["E"],
      IntervalSeconds: 0,
      MaxAttempts: -1,
      BackoffRate: "2",
      MaxDelaySeconds: 31622401,
      JitterStrategy: "HALF",
    };
    expect(inTask(task({ Retry: [bad] }))).toEqual([
      "States.T.Retry[0].IntervalSeconds",
      "States.T.Retry[0].MaxAttempts",
      "States.T.Retry[0].BackoffRate",
      "States.T.Retry[0].MaxDelaySeconds",
      "States.T.Retry[0].JitterStrategy",
    ]);
    expect(
      inTask(task({ Retry: [{ ErrorEquals: ["E"], MaxAttempts: 0, MaxDelaySeconds: 31622400, JitterStrategy: "NONE" }] })),
    ).toEqual([]);
  });

  it("Catch sin Next, con Next inexistente y con States.ALL fuera de lugar", () => {
    expect(inTask(task({ Catch: [{ ErrorEquals: ["E"] }] }))).toEqual(["States.T.Catch[0].Next"]);
    expect(inTask(task({ Catch: [{ ErrorEquals: ["E"], Next: "Nada" }] }))).toEqual(["States.T.Catch[0].Next"]);
    expect(
      inTask(task({ Catch: [{ ErrorEquals: ["States.ALL"], Next: "F" }, { ErrorEquals: ["E"], Next: "F" }] })),
    ).toEqual(["States.T.Catch[0].ErrorEquals"]);
    expect(
      inTask(task({ Catch: [{ ErrorEquals: ["E"], Next: "F" }, { ErrorEquals: ["States.ALL"], Next: "F" }] })),
    ).toEqual([]);
  });
});

describe("asl: Parallel, Map, Wait y QueryLanguage", () => {
  it("Parallel sin Branches y ramas con errores internos", () => {
    expect(paths({ StartAt: "P", States: { P: { Type: "Parallel", End: true } } })).toEqual(["States.P.Branches"]);
    expect(
      paths({
        StartAt: "P",
        States: {
          P: {
            Type: "Parallel",
            End: true,
            Branches: [{ StartAt: "X", States: { X: { Type: "Succeed" }, Y: { Type: "Succeed" } } }, 5],
          },
        },
      }),
    ).toEqual(["States.P.Branches[0].States.Y", "States.P.Branches[1]"]);
  });

  it("Map sin ItemProcessor, con Iterator obsoleto, Mode y MaxConcurrency", () => {
    const sub = { StartAt: "X", States: { X: { Type: "Succeed" } } };
    expect(paths({ StartAt: "M", States: { M: { Type: "Map", End: true } } })).toEqual(["States.M.ItemProcessor"]);
    expect(paths({ StartAt: "M", States: { M: { Type: "Map", End: true, Iterator: sub } } })).toEqual([]);
    expect(
      paths({ StartAt: "M", States: { M: { Type: "Map", End: true, ItemProcessor: { ...sub, ProcessorConfig: { Mode: "EXTRA" } } } } }),
    ).toEqual(["States.M.ItemProcessor.ProcessorConfig.Mode"]);
    expect(
      paths({
        StartAt: "M",
        States: { M: { Type: "Map", End: true, ItemProcessor: sub, MaxConcurrency: -1, MaxConcurrencyPath: "$.n" } },
      }),
    ).toEqual(["States.M.MaxConcurrency", "States.M"]);
  });

  it("Wait con valores fuera de rango", () => {
    const wait = (extra: Record<string, unknown>) => ({ StartAt: "W", States: { W: { Type: "Wait", End: true, ...extra } } });
    expect(paths(wait({ Seconds: 100000000 }))).toEqual(["States.W.Seconds"]);
    expect(paths(wait({ Seconds: 0 }))).toEqual([]);
    expect(paths(wait({ Seconds: 1.5 }))).toEqual(["States.W.Seconds"]);
    expect(paths(wait({ Timestamp: "mañana" }))).toEqual(["States.W.Timestamp"]);
    expect(paths(wait({ SecondsPath: "seconds" }))).toEqual(["States.W.SecondsPath"]);
    expect(paths(wait({}))).toEqual(["States.W"]);
  });

  it("QueryLanguage inválido y mezcla no permitida en una máquina JSONata", () => {
    expect(paths({ QueryLanguage: "XPath", StartAt: "S", States: { S: { Type: "Succeed" } } })).toEqual(["QueryLanguage"]);
    expect(
      paths({ QueryLanguage: "JSONata", StartAt: "S", States: { S: { Type: "Succeed", QueryLanguage: "JSONPath" } } }),
    ).toEqual(["States.S.QueryLanguage"]);
    expect(paths({ StartAt: "S", States: { S: { Type: "Succeed", QueryLanguage: "JSONata" } } })).toEqual([]);
    expect(paths({ StartAt: "S", States: { S: { Type: "Succeed", QueryLanguage: 3 } } })).toEqual(["States.S.QueryLanguage"]);
  });

  it("en JSONata los campos numéricos aceptan expresiones", () => {
    const machine = {
      QueryLanguage: "JSONata",
      StartAt: "W",
      States: { W: { Type: "Wait", Seconds: "{% $states.input.n %}", End: true } },
    };
    expect(paths(machine)).toEqual([]);
  });
});

describe("asl: pureza", () => {
  it("no modifica la entrada y es determinista", () => {
    const machine = Object.freeze({
      StartAt: "A",
      States: Object.freeze({ A: Object.freeze({ Type: "Pass", Next: "Nada" }) }),
    });
    const first = validateStateMachine(machine);
    expect(validateStateMachine(machine)).toEqual(first);
    expect(first.map((issue) => issue.path)).toEqual(["States.A.Next", "States"]);
  });
});
