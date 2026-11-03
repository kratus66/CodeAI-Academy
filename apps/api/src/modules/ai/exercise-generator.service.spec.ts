import type { ExerciseDraftRequest } from "@codeai/shared";
import { describe, expect, it } from "vitest";

import { ExerciseGeneratorService } from "./exercise-generator.service";
import type {
  AiCompletionResult,
  AiProvider,
  AiProviderMessage,
} from "./interfaces/ai-provider.interface";
import { MockAiProvider } from "./providers/mock.provider";

const SOURCE = "https://developer.mozilla.org/es/docs/Web/JavaScript/Reference/Global_Objects/Promise";

const QUIZ_REQUEST: ExerciseDraftRequest = {
  unitCode: "U2.3.2",
  concept: "promesas",
  type: "QUIZ",
  ladder: "GUIDED",
  competencies: ["C2"],
  allowedSources: [SOURCE],
};

const LAB_REQUEST: ExerciseDraftRequest = {
  ...QUIZ_REQUEST,
  type: "LAB",
  ladder: "AUTONOMOUS",
  language: "javascript",
};

function quizDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "promesas-estados",
    type: "QUIZ",
    title: "Estados de una promesa",
    statement: "¿Qué estado tiene una promesa que todavía no terminó?",
    ladder: "GUIDED",
    difficulty: 2,
    concepts: ["promesas"],
    competencies: ["C2"],
    estimatedMin: 3,
    language: null,
    starterCode: null,
    solution: null,
    quiz: {
      options: [
        { id: "a", text: "pending", explanation: "Es el estado inicial: aún no hay resultado." },
        { id: "b", text: "resolved", explanation: "Eso ocurre cuando ya terminó con éxito." },
        { id: "c", text: "closed", explanation: "Ese estado no existe en las promesas." },
      ],
      correctOptionId: "a",
    },
    flashcard: null,
    sources: [SOURCE],
    hints: [
      { level: 1, text: "Piensa en el momento antes del resultado." },
      { level: 2, text: "Hay tres estados en total." },
      { level: 3, text: "El primero se llama como la espera: pending." },
    ],
    tests: [],
    reviewedByHuman: false,
    ...overrides,
  };
}

function labDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return quizDraft({
    slug: "suma-segura",
    type: "LAB",
    title: "Suma segura",
    statement: "Implementa suma(a, b) que valide sus entradas.",
    ladder: "AUTONOMOUS",
    language: "javascript",
    starterCode: "function suma(a, b) {}",
    solution: { code: "function suma(a, b) { return a + b; }" },
    quiz: null,
    hints: [],
    tests: [
      { name: "suma", isHidden: false, weight: 1, spec: { code: "assert.strictEqual(suma(1, 2), 3);" } },
      { name: "negativos", isHidden: true, weight: 1, spec: { code: "assert.strictEqual(suma(-1, 1), 0);" } },
    ],
    ...overrides,
  });
}

/** Proveedor que devuelve una respuesta distinta por llamada. */
class ScriptedProvider implements AiProvider {
  readonly name = "scripted";
  readonly received: AiProviderMessage[][] = [];
  private index = 0;

  constructor(private readonly replies: readonly string[]) {}

  complete(messages: AiProviderMessage[]): Promise<AiCompletionResult> {
    this.received.push([...messages]);

    const reply = this.replies[Math.min(this.index, this.replies.length - 1)] ?? "";

    this.index += 1;

    return Promise.resolve({
      content: reply,
      usage: { promptTokens: 100, outputTokens: 50 },
      model: "scripted-1",
      latencyMs: 1,
      costUsd: 0.01,
    });
  }

  async *stream(): AsyncIterable<string> {
    yield await Promise.resolve("");
  }

  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

const json = (value: unknown): string => JSON.stringify(value);

describe("ExerciseGeneratorService", () => {
  it("entrega un borrador válido marcado como no revisado, con el consumo sumado", async () => {
    const service = new ExerciseGeneratorService(new ScriptedProvider([json(quizDraft())]));
    const result = await service.generate(QUIZ_REQUEST);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.slug).toBe("promesas-estados");
    expect(result.draft.reviewedByHuman).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.usage).toEqual({ promptTokens: 100, outputTokens: 50, costUsd: 0.01 });
  });

  it("acepta el JSON envuelto en una valla de código", async () => {
    const service = new ExerciseGeneratorService(
      new ScriptedProvider(["```json\n" + json(quizDraft()) + "\n```"]),
    );

    expect((await service.generate(QUIZ_REQUEST)).ok).toBe(true);
  });

  it("reintenta una vez con los problemas concretos y acepta la corrección", async () => {
    const provider = new ScriptedProvider(["esto no es json", json(quizDraft())]);
    const result = await new ExerciseGeneratorService(provider).generate(QUIZ_REQUEST);

    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(provider.received[1]?.at(-1)?.content).toContain("la respuesta no es JSON válido");
    expect(result.usage.promptTokens).toBe(200);
  });

  it("rechaza tras dos intentos inválidos sin lanzar", async () => {
    const result = await new ExerciseGeneratorService(new ScriptedProvider(["no", "tampoco"])).generate(
      QUIZ_REQUEST,
    );

    expect(result).toMatchObject({ ok: false, reason: "invalid_output", attempts: 2 });
  });

  it("rechaza una fuente fuera de la lista cerrada", async () => {
    const bad = json(quizDraft({ sources: ["https://inventado.example/docs"] }));
    const result = await new ExerciseGeneratorService(new ScriptedProvider([bad, bad])).generate(QUIZ_REQUEST);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.join(" ")).toContain("sources solo admite la lista permitida");
  });

  it("rechaza un tipo o escalón distinto del pedido", async () => {
    const bad = json(quizDraft({ ladder: "SEMI" }));
    const result = await new ExerciseGeneratorService(new ScriptedProvider([bad, bad])).generate(QUIZ_REQUEST);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("ladder debe ser GUIDED");
  });

  it("rechaza un quiz donde la correcta delata por su longitud", async () => {
    const long = "pending, que es el estado inicial de toda promesa hasta que se resuelve o se rechaza";
    const bad = json(
      quizDraft({
        quiz: {
          options: [
            { id: "a", text: long, explanation: "Es el estado inicial: aún no hay resultado." },
            { id: "b", text: "ok", explanation: "Eso ocurre cuando ya terminó con éxito." },
            { id: "c", text: "no", explanation: "Ese estado no existe en las promesas." },
          ],
          correctOptionId: "a",
        },
      }),
    );
    const result = await new ExerciseGeneratorService(new ScriptedProvider([bad, bad])).generate(QUIZ_REQUEST);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toContain("la opción correcta es demasiado larga frente a los distractores");
  });

  it("acepta un LAB autónomo con pruebas visible y oculta", async () => {
    const result = await new ExerciseGeneratorService(new ScriptedProvider([json(labDraft())])).generate(
      LAB_REQUEST,
    );

    expect(result.ok).toBe(true);
  });

  it("rechaza un LAB sin prueba oculta o autónomo con pistas", async () => {
    const sinOculta = json(
      labDraft({
        tests: [{ name: "suma", isHidden: false, weight: 1, spec: { code: "assert.ok(true);" } }],
      }),
    );
    const conPistas = json(labDraft({ hints: [{ level: 1, text: "Suma los dos números." }] }));
    const service = (reply: string) => new ExerciseGeneratorService(new ScriptedProvider([reply, reply]));

    const a = await service(sinOculta).generate(LAB_REQUEST);
    const b = await service(conPistas).generate(LAB_REQUEST);

    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.problems).toContain("un ejercicio autónomo no lleva pistas");
  });

  it("devuelve provider_error si el proveedor cae, sin lanzar", async () => {
    const result = await new ExerciseGeneratorService(
      new MockAiProvider({ failWith: new Error("caído") }),
    ).generate(QUIZ_REQUEST);

    expect(result).toMatchObject({ ok: false, reason: "provider_error", attempts: 1 });
  });

  it("rechaza una petición mal formada sin llamar al proveedor", async () => {
    const provider = new MockAiProvider();
    const result = await new ExerciseGeneratorService(provider).generate({
      ...QUIZ_REQUEST,
      allowedSources: [],
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid_request", attempts: 0 });
    expect(provider.calls).toBe(0);
  });
});
