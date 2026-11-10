import type { ExamDomain, QuizSubmissionInput } from "@codeai/shared";

import { gradeQuizAnswer, readQuizContent, type QuizContent } from "../exercises/quiz-grading";

/**
 * Puntuación pura del simulacro (S15-T4b).
 *
 * Recibe las preguntas del intento tal como las guarda el servicio (posición,
 * dominio, `config` y `solution` del ejercicio y la respuesta ya validada por
 * `quizSubmissionSchema`, o `null` si quedó en blanco) y devuelve los aciertos, el
 * porcentaje global y el desglose por dominio. No conoce Prisma ni HTTP y no
 * persiste nada: delega en `gradeQuizAnswer` (S14) para no duplicar las reglas de
 * cada variante.
 *
 * Una pregunta sin responder cuenta como fallo y una respuesta con forma inválida
 * también (decisión h): el resultado solo distingue acierto de fallo.
 */

export interface ScoringItem {
  readonly position: number;
  readonly domain: number;
  readonly exercise: { readonly config: unknown; readonly solution: unknown };
  readonly answer: QuizSubmissionInput | null;
}

export type AttemptScoring =
  | {
      readonly status: "scored";
      readonly correctCount: number;
      readonly scorePct: number;
      readonly domains: readonly {
        domain: number;
        name: string;
        correct: number;
        total: number;
        pct: number;
      }[];
      readonly items: readonly {
        position: number;
        correct: boolean;
        correctAnswer: QuizSubmissionInput;
        explanations: Record<string, string>;
      }[];
    }
  | { readonly status: "broken-content"; readonly position: number };

/** Porcentaje entero (`Math.round`); un total vacío vale 0 para no devolver `NaN`. */
function percentage(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((100 * correct) / total);
}

/** Nombre oficial del dominio según el registro de la certificación recibido. */
function nameOfDomain(domains: readonly ExamDomain[], domain: number): string {
  return domains.find((candidate) => candidate.id === domain)?.name ?? "";
}

/** Respuesta correcta con la misma forma que el cuerpo de `quiz-answers`. */
export function correctAnswerOf(quiz: QuizContent): QuizSubmissionInput {
  switch (quiz.kind) {
    case "single":
      return { optionId: quiz.correctOptionId };
    case "multiple":
      return { optionIds: [...quiz.correctOptionIds] };
    case "ordering":
      return { order: [...quiz.correctOrder] };
    case "matching":
      return { pairs: { ...quiz.correctPairs } };
  }
}

/**
 * Corrige el intento completo. La primera pregunta con contenido roto detiene el
 * cálculo: sin su `solution` no hay respuesta correcta ni explicaciones que dar,
 * y el servicio la reporta como error del servidor.
 */
export function scoreAttempt(
  items: readonly ScoringItem[],
  domains: readonly ExamDomain[],
): AttemptScoring {
  const tallies = new Map<number, { correct: number; total: number }>();
  const scoredItems: {
    position: number;
    correct: boolean;
    correctAnswer: QuizSubmissionInput;
    explanations: Record<string, string>;
  }[] = [];
  let correctCount = 0;

  for (const item of items) {
    const quiz = readQuizContent(item.exercise.config, item.exercise.solution);

    if (quiz === null) {
      return { status: "broken-content", position: item.position };
    }

    const grading = item.answer === null ? null : gradeQuizAnswer(item.exercise, item.answer);
    const correct = grading !== null && grading.status === "graded" && grading.result.correct;

    if (correct) {
      correctCount += 1;
    }

    const tally = tallies.get(item.domain) ?? { correct: 0, total: 0 };

    tally.correct += correct ? 1 : 0;
    tally.total += 1;
    tallies.set(item.domain, tally);

    scoredItems.push({
      position: item.position,
      correct,
      correctAnswer: correctAnswerOf(quiz),
      explanations: { ...quiz.explanations },
    });
  }

  // Un dominio solo entra en el mapa cuando tiene preguntas, así que el desglose
  // nunca muestra dominios con `total` cero.
  const domainScores = [...tallies.entries()]
    .sort(([left], [right]) => left - right)
    .map(([domain, tally]) => ({
      domain,
      name: nameOfDomain(domains, domain),
      correct: tally.correct,
      total: tally.total,
      pct: percentage(tally.correct, tally.total),
    }));

  return {
    status: "scored",
    correctCount,
    scorePct: percentage(correctCount, items.length),
    domains: domainScores,
    items: scoredItems,
  };
}
