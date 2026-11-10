import type {
  CertificationCode,
  ExamAttemptStatus,
  ExamFormCode,
  ExamMode,
} from "@codeai/shared";

import type {
  AttemptItemRow,
  AttemptRow,
  CreateAttemptInput,
  CreateRealResultInput,
  ExamsRepository,
  FinishAttemptInput,
  ReadinessFactsRow,
  RealResultRow,
  ReservedQuestionRow,
  UpdateItemPatch,
} from "./exams.repository";

/** Pregunta del banco junto a la certificación a la que pertenece. */
interface StoredQuestion {
  certification: CertificationCode;
  question: ReservedQuestionRow;
}

interface StoredItem {
  position: number;
  exerciseId: string;
  domain: number;
  answer: unknown | null;
  flagged: boolean;
  correct: boolean | null;
}

interface StoredAttempt {
  id: string;
  userId: string;
  certification: CertificationCode;
  mode: ExamMode;
  domain: number | null;
  extraTime: boolean;
  status: ExamAttemptStatus;
  orientative: boolean;
  startedAt: Date;
  deadlineAt: Date;
  submittedAt: Date | null;
  correctCount: number | null;
  scorePct: number | null;
  domainScores: unknown | null;
  items: Map<number, StoredItem>;
}

/**
 * Implementación en memoria de `ExamsRepository` para pruebas y entornos sin
 * base de datos (S15-T6a).
 *
 * Imita al adaptador Prisma: respeta la propiedad de los intentos, `finishAttempt`
 * solo cierra una vez, el historial va del más reciente al más antiguo y
 * `recentExerciseIds` mira únicamente los intentos terminados. No aplica reglas
 * de negocio: la puntuación y la decisión de «listo» viven en las reglas puras.
 */
export class InMemoryExamsRepository implements ExamsRepository {
  private readonly questions = new Map<string, StoredQuestion>();
  private readonly forms = new Map<CertificationCode, Map<ExamFormCode, string[]>>();
  private readonly attempts = new Map<string, StoredAttempt>();
  private readonly readiness = new Map<string, ReadinessFactsRow>();
  private readonly realResults = new Map<string, RealResultRow>();
  private sequence = 0;

  /** Siembra una pregunta del banco reservado de una certificación. */
  seedQuestion(certification: CertificationCode, question: ReservedQuestionRow): void {
    this.questions.set(question.exerciseId, {
      certification,
      question: copyQuestion(question),
    });
  }

  /** Siembra una forma fija con sus `slug` en orden. */
  seedForm(
    certification: CertificationCode,
    code: ExamFormCode,
    slugs: readonly string[],
  ): void {
    const forms = this.forms.get(certification) ?? new Map<ExamFormCode, string[]>();
    forms.set(code, [...slugs]);
    this.forms.set(certification, forms);
  }

  /**
   * Siembra los hechos ya calculados de una etapa. El adaptador en memoria no
   * los recalcula: los recibe tal cual para que la prueba fije el escenario.
   */
  seedReadinessFacts(userId: string, stageId: number, facts: ReadinessFactsRow): void {
    this.readiness.set(factsKey(userId, stageId), {
      ...facts,
      pendingUnitCodes: [...facts.pendingUnitCodes],
    });
  }

  async listReservedPool(certification: CertificationCode): Promise<ReservedQuestionRow[]> {
    return [...this.questions.values()]
      .filter((stored) => stored.certification === certification)
      .map((stored) => copyQuestion(stored.question));
  }

  async findFormSlugs(
    certification: CertificationCode,
    code: ExamFormCode,
  ): Promise<string[] | null> {
    const slugs = this.forms.get(certification)?.get(code);

    return slugs ? [...slugs] : null;
  }

  async countForms(certification: CertificationCode): Promise<number> {
    return this.forms.get(certification)?.size ?? 0;
  }

  async recentExerciseIds(
    userId: string,
    certification: CertificationCode,
    lastAttempts: number,
  ): Promise<Set<string>> {
    const limit = Math.max(0, Math.trunc(lastAttempts));
    const finished = [...this.attempts.values()]
      .filter(
        (attempt) =>
          attempt.userId === userId &&
          attempt.certification === certification &&
          attempt.status !== "in-progress",
      )
      .sort((a, b) => finishedAt(b) - finishedAt(a) || b.id.localeCompare(a.id))
      .slice(0, limit);

    const exerciseIds = new Set<string>();

    for (const attempt of finished) {
      for (const item of attempt.items.values()) {
        exerciseIds.add(item.exerciseId);
      }
    }

    return exerciseIds;
  }

  async findOpenAttemptId(
    userId: string,
    certification: CertificationCode,
  ): Promise<string | null> {
    let open: StoredAttempt | null = null;

    for (const attempt of this.attempts.values()) {
      if (
        attempt.userId !== userId ||
        attempt.certification !== certification ||
        attempt.status !== "in-progress"
      ) {
        continue;
      }

      if (open === null || attempt.startedAt.getTime() > open.startedAt.getTime()) {
        open = attempt;
      }
    }

    return open?.id ?? null;
  }

  async createAttempt(input: CreateAttemptInput): Promise<AttemptRow> {
    const id = `attempt-${(this.sequence += 1)}`;
    const items = new Map<number, StoredItem>();

    for (const item of input.items) {
      items.set(item.position, {
        position: item.position,
        exerciseId: item.exerciseId,
        domain: item.domain,
        answer: null,
        flagged: false,
        correct: null,
      });
    }

    const stored: StoredAttempt = {
      id,
      userId: input.userId,
      certification: input.certification,
      mode: input.mode,
      domain: input.domain,
      extraTime: input.extraTime,
      status: "in-progress",
      orientative: input.orientative,
      startedAt: input.startedAt,
      deadlineAt: input.deadlineAt,
      submittedAt: null,
      correctCount: null,
      scorePct: null,
      domainScores: null,
      items,
    };

    this.attempts.set(id, stored);

    return this.toAttemptRow(stored);
  }

  async findOwnedAttempt(userId: string, attemptId: string): Promise<AttemptRow | null> {
    const attempt = this.attempts.get(attemptId);

    if (!attempt || attempt.userId !== userId) {
      return null;
    }

    return this.toAttemptRow(attempt);
  }

  async updateItem(
    attemptId: string,
    position: number,
    patch: UpdateItemPatch,
  ): Promise<AttemptItemRow> {
    const item = this.attempts.get(attemptId)?.items.get(position);

    if (!item) {
      throw new Error(`Ítem inexistente en el intento ${attemptId}: posición ${position}`);
    }

    if (patch.answer !== undefined) {
      item.answer = patch.answer;
    }

    if (patch.flagged !== undefined) {
      item.flagged = patch.flagged;
    }

    return this.toItemRow(item);
  }

  async finishAttempt(attemptId: string, input: FinishAttemptInput): Promise<boolean> {
    const attempt = this.attempts.get(attemptId);

    if (!attempt || attempt.status !== "in-progress") {
      return false;
    }

    for (const entry of input.itemCorrectness) {
      if (!attempt.items.has(entry.position)) {
        throw new Error(
          `Correctitud para una posición inexistente: ${attemptId} → ${entry.position}`,
        );
      }
    }

    attempt.status = input.status === "SUBMITTED" ? "submitted" : "expired";
    attempt.submittedAt = input.submittedAt;
    attempt.correctCount = input.correctCount;
    attempt.scorePct = input.scorePct;
    attempt.domainScores = input.domainScores;

    for (const entry of input.itemCorrectness) {
      const item = attempt.items.get(entry.position);

      if (item) {
        item.correct = entry.correct;
      }
    }

    return true;
  }

  async listAttempts(
    userId: string,
    certification: CertificationCode,
  ): Promise<Omit<AttemptRow, "items">[]> {
    return [...this.attempts.values()]
      .filter(
        (attempt) =>
          attempt.userId === userId && attempt.certification === certification,
      )
      .sort(
        (a, b) =>
          b.startedAt.getTime() - a.startedAt.getTime() || b.id.localeCompare(a.id),
      )
      .map((attempt) => this.toAttemptSummary(attempt));
  }

  /**
   * El adaptador en memoria no usa `now`: los hechos llegan ya calculados por
   * `seedReadinessFacts`. El adaptador Prisma sí lo necesita para contar el
   * repaso atrasado de la etapa.
   */
  async readinessFacts(
    userId: string,
    stageId: number,
    _now: Date,
  ): Promise<ReadinessFactsRow> {
    const facts = this.readiness.get(factsKey(userId, stageId));

    if (!facts) {
      return {
        unitsTotal: 0,
        pendingUnitCodes: [],
        overdueReviewCount: 0,
        projectAvailable: false,
        bestReviewedProjectScore: null,
      };
    }

    return { ...facts, pendingUnitCodes: [...facts.pendingUnitCodes] };
  }

  async createRealResult(input: CreateRealResultInput): Promise<RealResultRow> {
    const id = `real-result-${(this.sequence += 1)}`;

    const stored: RealResultRow = {
      id,
      userId: input.userId,
      certification: input.certification,
      passed: input.passed,
      scaledScore: input.scaledScore,
      takenOn: input.takenOn,
      readyAtRegistration: input.readyAtRegistration,
      createdAt: new Date(),
    };

    this.realResults.set(id, stored);

    return { ...stored };
  }

  async latestRealResult(
    userId: string,
    certification: CertificationCode,
  ): Promise<RealResultRow | null> {
    let latest: RealResultRow | null = null;

    for (const stored of this.realResults.values()) {
      if (stored.userId !== userId || stored.certification !== certification) {
        continue;
      }

      if (latest === null || stored.createdAt.getTime() >= latest.createdAt.getTime()) {
        latest = stored;
      }
    }

    return latest ? { ...latest } : null;
  }

  private toAttemptRow(attempt: StoredAttempt): AttemptRow {
    return {
      ...this.toAttemptSummary(attempt),
      items: [...attempt.items.values()]
        .sort((a, b) => a.position - b.position)
        .map((item) => this.toItemRow(item)),
    };
  }

  private toAttemptSummary(attempt: StoredAttempt): Omit<AttemptRow, "items"> {
    return {
      id: attempt.id,
      userId: attempt.userId,
      certification: attempt.certification,
      mode: attempt.mode,
      domain: attempt.domain,
      extraTime: attempt.extraTime,
      status: attempt.status,
      orientative: attempt.orientative,
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      submittedAt: attempt.submittedAt,
      correctCount: attempt.correctCount,
      scorePct: attempt.scorePct,
      domainScores: attempt.domainScores,
    };
  }

  private toItemRow(item: StoredItem): AttemptItemRow {
    const stored = this.questions.get(item.exerciseId);

    if (!stored) {
      throw new Error(`Ítem sin pregunta en memoria: ${item.exerciseId}`);
    }

    return {
      position: item.position,
      exerciseId: item.exerciseId,
      domain: item.domain,
      answer: item.answer,
      flagged: item.flagged,
      correct: item.correct,
      question: copyQuestion(stored.question),
    };
  }
}

function copyQuestion(question: ReservedQuestionRow): ReservedQuestionRow {
  return { ...question, competencies: [...question.competencies] };
}

/** Momento en que el intento dejó de contar como abierto. */
function finishedAt(attempt: StoredAttempt): number {
  return (attempt.submittedAt ?? attempt.startedAt).getTime();
}

function factsKey(userId: string, stageId: number): string {
  return `${userId}:${stageId}`;
}
