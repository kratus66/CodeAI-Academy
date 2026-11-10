import {
  CERTIFICATION_REGISTRY,
  RANDOM_EXCLUDE_LAST_ATTEMPTS,
  quizSubmissionSchema,
  type CertificationCode,
  type ExamAttempt,
  examDomainScoreSchema,
  type ExamAttemptItem,
  type ExamDomainScore,
  type ExamFormCode,
  type ExamHistoryItem,
  type ExamItemUpdateResponse,
  type ExamReadiness,
  type ExamResult,
  type QuizSubmissionInput,
  type RealExamResult,
  type RegisterRealResultInput,
  type StartExamAttemptInput,
  type UpdateExamItemInput,
} from "@codeai/shared";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

import { gradeQuizAnswer } from "../exercises/quiz-grading";
import { ReviewService } from "../review/review.service";
import {
  assembleDomainBlock,
  assembleRandom,
  attemptDurationMinutes,
  isPastDeadline,
  remainingSeconds,
  type PoolQuestion,
} from "./exam.rules";
import { scoreAttempt, type AttemptScoring } from "./exam-scoring";
import {
  EXAMS_CLOCK,
  EXAMS_RANDOM,
  EXAMS_REPOSITORY,
  type AttemptItemRow,
  type AttemptRow,
  type ExamsRepository,
  type RealResultRow,
  type ReservedQuestionRow,
  type UpdateItemPatch,
} from "./exams.repository";
import { evaluateReadiness, type ReadinessAttempt } from "./readiness.rules";

export type ExamsClock = () => Date;
export type ExamsRandom = () => number;

const MINUTE_MS = 60_000;

const BETA_MESSAGE = "Esta certificación está en beta: el simulacro llegará con la guía definitiva";
const ALREADY_OPEN_MESSAGE = "Ya tienes un simulacro en curso de esta certificación";
const POOL_MESSAGE = "El banco reservado no alcanza para este simulacro";
const UNKNOWN_DOMAIN_MESSAGE = "Ese dominio no existe en el examen";
const NOT_FOUND_MESSAGE = "El simulacro no existe";
const ALREADY_SUBMITTED_MESSAGE = "El simulacro ya se entregó";
const TIME_UP_MESSAGE = "El tiempo terminó: tu simulacro se entregó automáticamente";
const BROKEN_CONTENT_MESSAGE = "El simulacro tiene una pregunta mal configurada";
const STILL_OPEN_MESSAGE = "El simulacro sigue en curso";
const FUTURE_DATE_MESSAGE = "La fecha del examen no puede ser futura";

const FORM_CODE_BY_MODE: Readonly<Record<string, ExamFormCode>> = {
  "form-a": "A",
  "form-b": "B",
  "form-c": "C",
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Respuesta guardada: la que no pasa el esquema cuenta como no respondida. */
function readAnswer(value: unknown): QuizSubmissionInput | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = quizSubmissionSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

function readDomainScores(value: unknown): ExamDomainScore[] {
  const parsed = examDomainScoreSchema.array().safeParse(value);

  return parsed.success ? parsed.data : [];
}

function toRealExamResult(row: RealResultRow): RealExamResult {
  return {
    id: row.id,
    certification: row.certification,
    passed: row.passed,
    scaledScore: row.scaledScore,
    takenOn: row.takenOn.toISOString().slice(0, 10),
    readyAtRegistration: row.readyAtRegistration,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Simulacros de examen: iniciar, leer, responder y entregar (S15-T7a).
 *
 * Nunca devuelve solución antes de entregar y el tiempo lo manda el servidor:
 * cualquier lectura o escritura de un intento vencido lo cierra antes de
 * responder (expiración perezosa). Un intento ajeno es indistinguible de uno
 * inexistente.
 */
@Injectable()
export class ExamsService {
  constructor(
    @Inject(EXAMS_REPOSITORY) private readonly repository: ExamsRepository,
    @Inject(EXAMS_CLOCK) private readonly now: ExamsClock,
    @Inject(EXAMS_RANDOM) private readonly random: ExamsRandom,
    @Inject(ReviewService) private readonly reviews: ReviewService,
  ) {}

  async start(
    userId: string,
    certification: CertificationCode,
    input: StartExamAttemptInput,
  ): Promise<ExamAttempt> {
    const definition = CERTIFICATION_REGISTRY[certification];

    if (definition.status === "beta") {
      throw new ConflictException(BETA_MESSAGE);
    }

    const openId = await this.repository.findOpenAttemptId(userId, certification);

    if (openId !== null) {
      const open = await this.repository.findOwnedAttempt(userId, openId);

      if (open !== null && isPastDeadline(open.deadlineAt, this.now())) {
        await this.finalize(open, "EXPIRED");
      } else {
        throw new ConflictException(ALREADY_OPEN_MESSAGE);
      }
    }

    if (
      input.mode === "domain" &&
      !definition.domains.some((domain) => domain.id === input.domain)
    ) {
      throw new BadRequestException(UNKNOWN_DOMAIN_MESSAGE);
    }

    const pool = await this.repository.listReservedPool(certification);
    const questions = await this.assemble(userId, certification, input, pool);
    const startedAt = this.now();
    const minutes = attemptDurationMinutes({
      definition,
      mode: input.mode,
      itemCount: questions.length,
      extraTime: input.extraTime,
    });

    const row = await this.repository.createAttempt({
      userId,
      certification,
      mode: input.mode,
      domain: input.mode === "domain" ? (input.domain ?? null) : null,
      extraTime: input.extraTime,
      orientative: questions.some((question) => !question.reviewedByHuman),
      startedAt,
      deadlineAt: new Date(startedAt.getTime() + minutes * MINUTE_MS),
      items: questions.map((question, index) => ({
        position: index + 1,
        exerciseId: question.exerciseId,
        domain: question.domain,
      })),
    });

    return this.toAttempt(row);
  }

  async get(userId: string, attemptId: string): Promise<ExamAttempt> {
    const attempt = await this.findOwned(userId, attemptId);

    if (attempt.status === "in-progress" && isPastDeadline(attempt.deadlineAt, this.now())) {
      await this.finalize(attempt, "EXPIRED");

      return this.toAttempt(await this.findOwned(userId, attemptId));
    }

    return this.toAttempt(attempt);
  }

  async updateItem(
    userId: string,
    attemptId: string,
    position: number,
    body: UpdateExamItemInput,
  ): Promise<ExamItemUpdateResponse> {
    const attempt = await this.findOwned(userId, attemptId);

    if (attempt.status !== "in-progress") {
      throw new ConflictException(ALREADY_SUBMITTED_MESSAGE);
    }

    if (isPastDeadline(attempt.deadlineAt, this.now())) {
      await this.finalize(attempt, "EXPIRED");
      throw new ConflictException(TIME_UP_MESSAGE);
    }

    const item = attempt.items.find((candidate) => candidate.position === position);

    if (item === undefined) {
      throw new BadRequestException(`La pregunta ${position} no existe en este simulacro`);
    }

    const patch: UpdateItemPatch = {};

    if (body.answer !== undefined) {
      if (body.answer !== null) {
        this.assertValidAnswer(item, body.answer);
      }

      patch.answer = body.answer;
      patch.answeredAt = body.answer === null ? null : this.now();
    }

    if (body.flagged !== undefined) {
      patch.flagged = body.flagged;
    }

    const updated = await this.repository.updateItem(attempt.id, position, patch);

    return {
      item: this.toItem(updated),
      remainingSeconds: remainingSeconds(attempt.deadlineAt, this.now()),
    };
  }

  async submit(userId: string, attemptId: string): Promise<ExamResult> {
    const attempt = await this.findOwned(userId, attemptId);

    if (attempt.status !== "in-progress") {
      throw new ConflictException(ALREADY_SUBMITTED_MESSAGE);
    }

    const status = isPastDeadline(attempt.deadlineAt, this.now()) ? "EXPIRED" : "SUBMITTED";
    const result = await this.finalize(attempt, status);

    if (result === null) {
      throw new ConflictException(ALREADY_SUBMITTED_MESSAGE);
    }

    return result;
  }

  async result(userId: string, attemptId: string): Promise<ExamResult> {
    const attempt = await this.findOwned(userId, attemptId);

    if (attempt.status !== "in-progress") {
      return this.resultOfClosed(attempt);
    }

    if (!isPastDeadline(attempt.deadlineAt, this.now())) {
      throw new ConflictException(STILL_OPEN_MESSAGE);
    }

    const closed = await this.finalize(attempt, "EXPIRED");

    return closed ?? this.resultOfClosed(await this.findOwned(userId, attemptId));
  }

  async history(userId: string, certification: CertificationCode): Promise<ExamHistoryItem[]> {
    const openId = await this.repository.findOpenAttemptId(userId, certification);

    if (openId !== null) {
      await this.get(userId, openId);
    }

    const attempts = await this.repository.listAttempts(userId, certification);
    const history: ExamHistoryItem[] = [];

    for (const attempt of attempts) {
      history.push({
        attemptId: attempt.id,
        mode: attempt.mode,
        domain: attempt.domain,
        status: attempt.status,
        orientative: attempt.orientative,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt === null ? null : attempt.submittedAt.toISOString(),
        scorePct: attempt.scorePct,
        questionCount: await this.questionCountOf(attempt),
      });
    }

    return history;
  }

  async readiness(userId: string, certification: CertificationCode): Promise<ExamReadiness> {
    const stageId = CERTIFICATION_REGISTRY[certification].stageId;
    const now = this.now();
    const [facts, formsAvailable, attempts, lastReal] = await Promise.all([
      this.repository.readinessFacts(userId, stageId, now),
      this.repository.countForms(certification),
      this.repository.listAttempts(userId, certification),
      this.repository.latestRealResult(userId, certification),
    ]);
    const evaluation = evaluateReadiness({
      now,
      units: { total: facts.unitsTotal, pendingCodes: facts.pendingUnitCodes },
      formsAvailable,
      attempts: attempts.map(
        (attempt): ReadinessAttempt => ({
          mode: attempt.mode,
          status: attempt.status,
          orientative: attempt.orientative,
          submittedAt: attempt.submittedAt,
          scorePct: attempt.scorePct,
          domainPcts: readDomainScores(attempt.domainScores).map((score) => score.pct),
        }),
      ),
      overdueReviewCount: facts.overdueReviewCount,
      project: {
        available: facts.projectAvailable,
        bestReviewedScore: facts.bestReviewedProjectScore,
      },
      defense: { available: false, done: false },
    });

    return {
      certification,
      stageId,
      ready: evaluation.ready,
      criteria: evaluation.criteria,
      evaluatedAt: now.toISOString(),
      lastRealResult: lastReal === null ? null : toRealExamResult(lastReal),
    };
  }

  async registerRealResult(
    userId: string,
    certification: CertificationCode,
    body: RegisterRealResultInput,
  ): Promise<RealExamResult> {
    if (body.takenOn > this.now().toISOString().slice(0, 10)) {
      throw new BadRequestException(FUTURE_DATE_MESSAGE);
    }

    const { ready } = await this.readiness(userId, certification);
    const saved = await this.repository.createRealResult({
      userId,
      certification,
      passed: body.passed,
      scaledScore: body.scaledScore ?? null,
      takenOn: new Date(`${body.takenOn}T00:00:00.000Z`),
      readyAtRegistration: ready,
    });

    return toRealExamResult(saved);
  }

  private resultOfClosed(attempt: AttemptRow): ExamResult {
    return this.buildResult(
      attempt,
      this.score(attempt),
      attempt.status === "expired" ? "expired" : "submitted",
      attempt.submittedAt ?? attempt.deadlineAt,
    );
  }

  /** Total de preguntas: sale de los dominios guardados o, si faltan, de los ítems. */
  private async questionCountOf(attempt: Omit<AttemptRow, "items">): Promise<number> {
    const scores = readDomainScores(attempt.domainScores);

    if (scores.length > 0) {
      return scores.reduce((sum, score) => sum + score.total, 0);
    }

    const full = await this.repository.findOwnedAttempt(attempt.userId, attempt.id);

    return full === null ? 0 : full.items.length;
  }

  private score(attempt: AttemptRow): Extract<AttemptScoring, { status: "scored" }> {
    const scoring = scoreAttempt(
      attempt.items.map((item) => ({
        position: item.position,
        domain: item.domain,
        exercise: { config: item.question.config, solution: item.question.solution },
        answer: readAnswer(item.answer),
      })),
      CERTIFICATION_REGISTRY[attempt.certification].domains,
    );

    if (scoring.status === "broken-content") {
      throw new InternalServerErrorException(BROKEN_CONTENT_MESSAGE);
    }

    return scoring;
  }

  private async findOwned(userId: string, attemptId: string): Promise<AttemptRow> {
    const attempt = await this.repository.findOwnedAttempt(userId, attemptId);

    if (attempt === null) {
      throw new NotFoundException(NOT_FOUND_MESSAGE);
    }

    return attempt;
  }

  /** Elige las preguntas del intento según el modo; lanza `409` si el banco no alcanza. */
  private async assemble(
    userId: string,
    certification: CertificationCode,
    input: StartExamAttemptInput,
    pool: readonly ReservedQuestionRow[],
  ): Promise<ReservedQuestionRow[]> {
    const formCode = FORM_CODE_BY_MODE[input.mode];

    if (formCode !== undefined) {
      const slugs = await this.repository.findFormSlugs(certification, formCode);

      if (slugs === null) {
        throw new ConflictException(`La forma ${formCode} todavía no existe`);
      }

      const bySlug = new Map(pool.map((question) => [question.slug, question]));
      const ordered: ReservedQuestionRow[] = [];

      for (const slug of slugs) {
        const question = bySlug.get(slug);

        if (question === undefined) {
          throw new ConflictException(POOL_MESSAGE);
        }

        ordered.push(question);
      }

      return ordered;
    }

    const recentExerciseIds = await this.repository.recentExerciseIds(
      userId,
      certification,
      RANDOM_EXCLUDE_LAST_ATTEMPTS,
    );
    const candidates: PoolQuestion[] = pool.map((question) => ({
      exerciseId: question.exerciseId,
      domain: question.domain,
    }));
    const assembly =
      input.mode === "domain" && input.domain !== undefined
        ? assembleDomainBlock({
            domain: input.domain,
            pool: candidates,
            recentExerciseIds,
            random: this.random,
          })
        : assembleRandom({
            definition: CERTIFICATION_REGISTRY[certification],
            pool: candidates,
            recentExerciseIds,
            random: this.random,
          });

    if (assembly.status === "insufficient") {
      throw new ConflictException(POOL_MESSAGE);
    }

    const byId = new Map(pool.map((question) => [question.exerciseId, question]));
    const questions: ReservedQuestionRow[] = [];

    for (const picked of assembly.items) {
      const question = byId.get(picked.exerciseId);

      if (question !== undefined) {
        questions.push(question);
      }
    }

    return questions;
  }

  /** Valida la forma de la respuesta; la corrección se descarta y nunca se devuelve. */
  private assertValidAnswer(item: AttemptItemRow, answer: QuizSubmissionInput): void {
    const grading = gradeQuizAnswer(
      { config: item.question.config, solution: item.question.solution },
      answer,
    );

    if (grading.status === "invalid-answer") {
      throw new BadRequestException(grading.message);
    }

    if (grading.status === "broken-content") {
      throw new InternalServerErrorException(BROKEN_CONTENT_MESSAGE);
    }
  }

  /**
   * Corrige y cierra el intento. Devuelve `null` si otro cierre se adelantó.
   * Cada pregunta fallada entra en el repaso con prioridad alta.
   */
  private async finalize(
    attempt: AttemptRow,
    status: "SUBMITTED" | "EXPIRED",
  ): Promise<ExamResult | null> {
    const scoring = this.score(attempt);
    const submittedAt = status === "EXPIRED" ? attempt.deadlineAt : this.now();
    const closed = await this.repository.finishAttempt(attempt.id, {
      status,
      submittedAt,
      correctCount: scoring.correctCount,
      scorePct: scoring.scorePct,
      domainScores: scoring.domains,
      itemCorrectness: scoring.items.map((item) => ({
        position: item.position,
        correct: item.correct,
      })),
    });

    if (!closed) {
      return null;
    }

    const failed = new Set(
      scoring.items.filter((item) => !item.correct).map((item) => item.position),
    );

    for (const item of attempt.items) {
      if (failed.has(item.position)) {
        await this.reviews.scheduleFromSubmission({
          userId: attempt.userId,
          exerciseId: item.exerciseId,
          outcome: "FAILED",
          score: 0,
          hintsUsed: 0,
        });
      }
    }

    return this.buildResult(
      attempt,
      scoring,
      status === "SUBMITTED" ? "submitted" : "expired",
      submittedAt,
    );
  }

  /** Arma el `ExamResult` con la corrección ya calculada; no escribe nada. */
  private buildResult(
    attempt: AttemptRow,
    scoring: Extract<AttemptScoring, { status: "scored" }>,
    status: ExamResult["status"],
    submittedAt: Date,
  ): ExamResult {
    const scoredByPosition = new Map(scoring.items.map((item) => [item.position, item]));
    const resultItems: ExamResult["items"] = [];

    for (const item of attempt.items) {
      const scored = scoredByPosition.get(item.position);

      if (scored === undefined) {
        continue;
      }

      resultItems.push({
        ...this.toItem(item),
        correct: scored.correct,
        correctAnswer: scored.correctAnswer,
        explanations: scored.explanations,
        unitCode: item.question.unitCode,
      });
    }

    return {
      attemptId: attempt.id,
      certification: attempt.certification,
      mode: attempt.mode,
      domain: attempt.domain,
      status,
      orientative: attempt.orientative,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: submittedAt.toISOString(),
      correctCount: scoring.correctCount,
      questionCount: attempt.items.length,
      scorePct: scoring.scorePct,
      domains: [...scoring.domains],
      items: resultItems,
    };
  }

  private toItem(item: AttemptItemRow): ExamAttemptItem {
    return {
      position: item.position,
      domain: item.domain,
      statement: item.question.statement,
      config: asRecord(item.question.config),
      answer: readAnswer(item.answer),
      flagged: item.flagged,
    };
  }

  private toAttempt(row: AttemptRow): ExamAttempt {
    const items = [...row.items]
      .sort((left, right) => left.position - right.position)
      .map((item) => this.toItem(item));

    return {
      id: row.id,
      certification: row.certification,
      mode: row.mode,
      domain: row.domain,
      extraTime: row.extraTime,
      status: row.status,
      orientative: row.orientative,
      startedAt: row.startedAt.toISOString(),
      deadlineAt: row.deadlineAt.toISOString(),
      submittedAt: row.submittedAt === null ? null : row.submittedAt.toISOString(),
      remainingSeconds:
        row.status === "in-progress" ? remainingSeconds(row.deadlineAt, this.now()) : 0,
      questionCount: items.length,
      answeredCount: items.filter((item) => item.answer !== null).length,
      items,
    };
  }
}
