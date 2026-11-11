import { describe, expect, it } from "vitest";
import { reachableStates, validateStateMachine } from "./index.js";

const lambda = "arn:aws:lambda:region:123456789012:function:FUNCTION_NAME";

describe("asl: casos dorados de la Guía para desarrolladores de AWS Step Functions", () => {
  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/statemachine-structure.html
  it("el ejemplo Hello World con un estado Pass que es inicio y fin es válido", () => {
    const machine = {
      Comment: "A Hello World example of the Amazon States Language using a Pass state",
      StartAt: "HelloWorld",
      States: { HelloWorld: { Type: "Pass", Result: "Hello World!", End: true } },
    };
    expect(validateStateMachine(machine)).toEqual([]);
    expect(reachableStates(machine)).toEqual(["HelloWorld"]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html
  it("el ejemplo de la especificación con JSONata y un estado Choice es válido y alcanza todos sus estados", () => {
    const machine = {
      Comment: "An example of the Amazon States Language using a choice state.",
      QueryLanguage: "JSONata",
      StartAt: "FirstState",
      States: {
        FirstState: {
          Type: "Task",
          Assign: { foo: "{% $states.input.foo_input %}" },
          Resource: lambda,
          Next: "ChoiceState",
        },
        ChoiceState: {
          Type: "Choice",
          Default: "DefaultState",
          Choices: [
            { Next: "FirstMatchState", Condition: "{% $foo = 1 %}" },
            { Next: "SecondMatchState", Condition: "{% $foo = 2 %}" },
          ],
        },
        FirstMatchState: { Type: "Task", Resource: "arn:aws:lambda:region:123456789012:function:OnFirstMatch", Next: "NextState" },
        SecondMatchState: { Type: "Task", Resource: "arn:aws:lambda:region:123456789012:function:OnSecondMatch", Next: "NextState" },
        DefaultState: { Type: "Fail", Error: "DefaultStateError", Cause: "No Matches!" },
        NextState: { Type: "Task", Resource: lambda, End: true },
      },
    };
    expect(validateStateMachine(machine)).toEqual([]);
    expect(reachableStates(machine)).toEqual([
      "FirstState",
      "ChoiceState",
      "FirstMatchState",
      "SecondMatchState",
      "DefaultState",
      "NextState",
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-choice.html
  it("las reglas de Choice con JSONPath de la guía (numérica, cadena, nulo, And con IsPresent, comodín, marca de tiempo y Path) son válidas", () => {
    const machine = {
      StartAt: "Decide",
      States: {
        Decide: {
          Type: "Choice",
          Choices: [
            { Variable: "$.foo", NumericEquals: 1, Next: "FirstMatchState" },
            { Variable: "$.foo", StringEquals: "MyString", Next: "FirstMatchState" },
            { Variable: "$.foo", StringGreaterThan: "MyStringABC", Next: "FirstMatchState" },
            { Variable: "$.possiblyNullValue", IsNull: true, Next: "FirstMatchState" },
            {
              And: [
                { Variable: "$.keyThatMightNotExist", IsPresent: true },
                { Variable: "$.keyThatMightNotExist", StringEquals: "foo" },
              ],
              Next: "FirstMatchState",
            },
            { Variable: "$.foo", StringMatches: "log-*.txt", Next: "FirstMatchState" },
            { Variable: "$.foo", TimestampEquals: "2001-01-01T12:00:00Z", Next: "FirstMatchState" },
            { Variable: "$.foo", StringEqualsPath: "$.bar", Next: "FirstMatchState" },
          ],
          Default: "FirstMatchState",
        },
        FirstMatchState: { Type: "Succeed" },
      },
    };
    expect(validateStateMachine(machine)).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-choice.html
  it("la guía indica que Next solo aparece en las reglas de primer nivel: un Next dentro de And se marca", () => {
    const machine = {
      StartAt: "Decide",
      States: {
        Decide: {
          Type: "Choice",
          Choices: [
            {
              And: [
                { Variable: "$.a", IsPresent: true, Next: "Done" },
                { Not: { Variable: "$.a", StringEquals: "x" } },
              ],
              Next: "Done",
            },
          ],
          Default: "Done",
        },
        Done: { Type: "Succeed" },
      },
    };
    expect(validateStateMachine(machine)).toEqual([
      {
        path: "States.Decide.Choices[0].And[0].Next",
        message: "Next solo puede aparecer en una regla de primer nivel, no dentro de And, Or o Not.",
      },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-choice.html
  it("sin Default la guía avisa de que la máquina falla si ninguna regla se cumple", () => {
    const machine = {
      StartAt: "Decide",
      States: {
        Decide: { Type: "Choice", Choices: [{ Variable: "$.foo", NumericEquals: 1, Next: "Done" }] },
        Done: { Type: "Succeed" },
      },
    };
    expect(validateStateMachine(machine)).toEqual([
      {
        path: "States.Decide",
        message:
          "Advertencia: el Choice no tiene Default; si ninguna regla se cumple, la máquina falla al no poder hacer la transición.",
      },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-parallel.html
  it("el ejemplo de Parallel con LookupAddress y LookupPhone es válido y sus ramas son independientes", () => {
    const machine = {
      Comment: "Parallel Example.",
      StartAt: "LookupCustomerInfo",
      States: {
        LookupCustomerInfo: {
          Type: "Parallel",
          End: true,
          Branches: [
            {
              StartAt: "LookupAddress",
              States: {
                LookupAddress: { Type: "Task", Resource: "arn:aws:lambda:region:account-id:function:AddressFinder", End: true },
              },
            },
            {
              StartAt: "LookupPhone",
              States: {
                LookupPhone: { Type: "Task", Resource: "arn:aws:lambda:region:account-id:function:PhoneFinder", End: true },
              },
            },
          ],
        },
      },
    };
    expect(validateStateMachine(machine)).toEqual([]);
    expect(reachableStates(machine)).toEqual(["LookupCustomerInfo"]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-parallel.html
  it("la guía dice que un estado de una rama no puede tener un Next fuera de ella", () => {
    const machine = {
      StartAt: "Split",
      States: {
        Split: {
          Type: "Parallel",
          Next: "After",
          Branches: [
            { StartAt: "Add", States: { Add: { Type: "Task", Resource: lambda, Next: "After" } } },
          ],
        },
        After: { Type: "Succeed" },
      },
    };
    const issues = validateStateMachine(machine);
    expect(issues).toContainEqual({
      path: "States.Split.Branches[0].States.Add.Next",
      message: "Next apunta a «After», que no existe en este bloque de estados.",
    });
    expect(issues).toContainEqual({
      path: "States.Split.Branches[0].States",
      message: "Ningún estado es terminal: hace falta un Succeed, un Fail o un estado con End: true.",
    });
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-map-inline.html
  it("el ejemplo de Map en modo Inline con ItemProcessor y ProcessorConfig es válido", () => {
    const machine = {
      StartAt: "Validate All",
      States: {
        "Validate All": {
          Type: "Map",
          InputPath: "$.detail",
          ItemProcessor: {
            ProcessorConfig: { Mode: "INLINE" },
            StartAt: "Validate",
            States: {
              Validate: {
                Type: "Task",
                Resource: "arn:aws:states:::lambda:invoke",
                OutputPath: "$.Payload",
                Parameters: { FunctionName: "arn:aws:lambda:us-east-2:account-id:function:ship-val:$LATEST" },
                End: true,
              },
            },
          },
          End: true,
          ResultPath: "$.detail.shipped",
          ItemsPath: "$.shipped",
        },
      },
    };
    expect(validateStateMachine(machine)).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-wait.html
  it("los ejemplos de Wait con Seconds, Timestamp y TimestampPath son válidos", () => {
    const machine = {
      StartAt: "wait_ten_seconds",
      States: {
        wait_ten_seconds: { Type: "Wait", Seconds: 10, Next: "wait_until" },
        wait_until: { Type: "Wait", Timestamp: "2024-03-14T01:59:00Z", Next: "wait_expiry" },
        wait_expiry: { Type: "Wait", TimestampPath: "$.expirydate", Next: "NextState" },
        NextState: { Type: "Succeed" },
      },
    };
    expect(validateStateMachine(machine)).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-wait.html
  it("la guía exige exactamente uno entre Seconds, Timestamp, SecondsPath y TimestampPath", () => {
    const machine = {
      StartAt: "w",
      States: {
        w: { Type: "Wait", Seconds: 10, Timestamp: "2024-03-14T01:59:00Z", Next: "Done" },
        Done: { Type: "Succeed" },
      },
    };
    expect(validateStateMachine(machine)).toEqual([
      { path: "States.w", message: "Wait debe tener exactamente uno entre Seconds, Timestamp, SecondsPath y TimestampPath." },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-pass.html
  it("el ejemplo de Pass con Result y ResultPath es válido", () => {
    const machine = {
      StartAt: "No-op",
      States: {
        "No-op": {
          Type: "Pass",
          Result: { "x-datum": 0.381018, "y-datum": 622.2269926397355 },
          ResultPath: "$.coords",
          End: true,
        },
      },
    };
    expect(validateStateMachine(machine)).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-succeed.html
  it("un Succeed sin Next ni End es válido y con Next se marca", () => {
    const valid = { StartAt: "SuccessState", States: { SuccessState: { Type: "Succeed" } } };
    expect(validateStateMachine(valid)).toEqual([]);
    const invalid = {
      StartAt: "S",
      States: { S: { Type: "Succeed", Next: "S" } },
    };
    expect(validateStateMachine(invalid)).toEqual([
      { path: "States.S.Next", message: "Un estado Succeed no admite Next." },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-fail.html
  it("los ejemplos de Fail con Error y Cause, y con ErrorPath y CausePath son válidos; Cause y CausePath juntos no", () => {
    expect(
      validateStateMachine({ StartAt: "FailState", States: { FailState: { Type: "Fail", Cause: "Invalid response.", Error: "ErrorA" } } }),
    ).toEqual([]);
    expect(
      validateStateMachine({ StartAt: "FailState", States: { FailState: { Type: "Fail", CausePath: "$.Cause", ErrorPath: "$.Error" } } }),
    ).toEqual([]);
    expect(
      validateStateMachine({
        StartAt: "FailState",
        States: { FailState: { Type: "Fail", Cause: "x", CausePath: "$.Cause", Error: "E", ErrorPath: "$.Error" } },
      }),
    ).toEqual([
      { path: "States.FailState", message: "Un Fail puede tener Cause o CausePath, pero no ambos." },
      { path: "States.FailState", message: "Un Fail puede tener Error o ErrorPath, pero no ambos." },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
  it("el ejemplo de Retry con BackoffRate y los ejemplos con MaxDelaySeconds y States.ALL al final son válidos", () => {
    const withRetry = (retry: unknown) => ({
      StartAt: "X",
      States: { X: { Type: "Task", Resource: lambda, Retry: retry, End: true } },
    });
    expect(
      validateStateMachine(withRetry([{ ErrorEquals: ["States.Timeout"], IntervalSeconds: 3, MaxAttempts: 2, BackoffRate: 1 }])),
    ).toEqual([]);
    expect(
      validateStateMachine(
        withRetry([
          { ErrorEquals: ["States.Timeout"], IntervalSeconds: 3, MaxAttempts: 3, BackoffRate: 2, MaxDelaySeconds: 5, JitterStrategy: "FULL" },
        ]),
      ),
    ).toEqual([]);
    expect(
      validateStateMachine(withRetry([{ ErrorEquals: ["States.Timeout"], MaxAttempts: 0 }, { ErrorEquals: ["States.ALL"] }])),
    ).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
  it("la guía exige States.ALL solo y en el último retrier", () => {
    const machine = (retry: unknown) => ({
      StartAt: "X",
      States: { X: { Type: "Task", Resource: lambda, Retry: retry, End: true } },
    });
    expect(validateStateMachine(machine([{ ErrorEquals: ["States.ALL"] }, { ErrorEquals: ["States.Timeout"] }]))).toEqual([
      { path: "States.X.Retry[0].ErrorEquals", message: "States.ALL debe aparecer en el último elemento de la lista." },
    ]);
    expect(validateStateMachine(machine([{ ErrorEquals: ["States.ALL", "ErrorA"] }]))).toEqual([
      { path: "States.X.Retry[0].ErrorEquals", message: "States.ALL debe aparecer solo en ErrorEquals." },
    ]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
  it("el escenario complejo de Retry y Catch con States.ALL hacia Z es válido y alcanza Y y Z", () => {
    const machine = {
      StartAt: "X",
      States: {
        X: {
          Type: "Task",
          Resource: "arn:aws:states:region:123456789012:task:X",
          Next: "Y",
          Retry: [
            { ErrorEquals: ["ErrorA", "ErrorB"], IntervalSeconds: 1, BackoffRate: 2.0, MaxAttempts: 2 },
            { ErrorEquals: ["ErrorC"], IntervalSeconds: 5 },
          ],
          Catch: [{ ErrorEquals: ["States.ALL"], Next: "Z" }],
        },
        Y: { Type: "Succeed" },
        Z: { Type: "Succeed" },
      },
    };
    expect(validateStateMachine(machine)).toEqual([]);
    expect(reachableStates(machine)).toEqual(["X", "Y", "Z"]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
  it("los ejemplos de Catch con HandledError, States.TaskFailed y States.Timeout hacia un estado fallback son válidos", () => {
    const withCatch = (errors: string[], extra: Record<string, unknown> = {}) => ({
      Comment: "Hello World example which invokes a AWS Lambda function",
      StartAt: "HelloWorld",
      States: {
        HelloWorld: {
          Type: "Task",
          Resource: "arn:aws:lambda:region:123456789012:function:FailFunction",
          ...extra,
          Catch: [{ ErrorEquals: errors, Next: "fallback" }],
          End: true,
        },
        fallback: { Type: "Pass", Result: "Hello, AWS Step Functions!", End: true },
      },
    });
    expect(validateStateMachine(withCatch(["HandledError"]))).toEqual([]);
    expect(validateStateMachine(withCatch(["States.TaskFailed"]))).toEqual([]);
    expect(validateStateMachine(withCatch(["States.Timeout"], { TimeoutSeconds: 2 }))).toEqual([]);
  });

  // Fuente: https://docs.aws.amazon.com/step-functions/latest/dg/state-task.html
  it("TimeoutSeconds debe ser un entero positivo y HeartbeatSeconds menor que él", () => {
    const task = (extra: Record<string, unknown>) => ({
      StartAt: "T",
      States: { T: { Type: "Task", Resource: lambda, End: true, ...extra } },
    });
    expect(validateStateMachine(task({ TimeoutSeconds: 60, HeartbeatSeconds: 10 }))).toEqual([]);
    expect(validateStateMachine(task({ TimeoutSeconds: 0 }))).toEqual([
      { path: "States.T.TimeoutSeconds", message: "TimeoutSeconds debe ser un entero positivo distinto de cero." },
    ]);
    expect(validateStateMachine(task({ TimeoutSeconds: 10, HeartbeatSeconds: 10 }))).toEqual([
      { path: "States.T.HeartbeatSeconds", message: "HeartbeatSeconds debe ser menor que TimeoutSeconds." },
    ]);
    expect(validateStateMachine(task({ TimeoutSeconds: 10, TimeoutSecondsPath: "$.t" }))).toEqual([
      { path: "States.T", message: "Un Task no puede tener TimeoutSeconds y TimeoutSecondsPath a la vez." },
    ]);
  });
});
