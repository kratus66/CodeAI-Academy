import type {
  InterviewScenarioRecord,
  InterviewSessionRecord,
} from "./interview.repository";
import {
  INTERVIEW_APPROVED_COMPETENCY_LEVEL,
  type CreateInterviewSessionRecord,
  type FinishInterviewSessionRecord,
  type InterviewDataset,
  type InterviewRepository,
  type ListScenariosFilter,
  type SaveInterviewReviewRecord,
  type SaveInterviewSelfReviewRecord,
  type SaveInterviewTurnRecord,
  type ScenarioCatalogRow,
  type ScenariosPage,
} from "./interview.repository";

/** Evidencia acumulada que las pruebas pueden inspeccionar. */
export interface InMemoryEvidence {
  level: number;
  evidenceCount: number;
  lastEvaluated: Date;
}

function cloneScenario(scenario: InterviewScenarioRecord): InterviewScenarioRecord {
  return {
    ...scenario,
    competencies: [...scenario.competencies],
    phases: structuredClone(scenario.phases),
    rubric: structuredClone(scenario.rubric),
  };
}

function cloneSession(session: InterviewSessionRecord): InterviewSessionRecord {
  return {
    ...session,
    transcript: structuredClone(session.transcript),
    scores: structuredClone(session.scores),
    selfScores: structuredClone(session.selfScores),
    scenario: cloneScenario(session.scenario),
  };
}

/**
 * Adaptador en memoria de `InterviewRepository` (T5).
 *
 * Misma semántica que el adaptador Prisma —incluida la sesión abierta por
 * usuario y escenario— pero sin base de datos, para probar el servicio de forma
 * determinista. Los identificadores son correlativos y las fechas las pone el
 * reloj inyectado del servicio.
 */
export class InMemoryInterviewRepository implements InterviewRepository {
  private readonly scenarios: InterviewScenarioRecord[];
  private readonly sessions: InterviewSessionRecord[];
  private readonly evidence = new Map<string, InMemoryEvidence>();
  private nextSessionId = 1;

  constructor(dataset: InterviewDataset) {
    this.scenarios = dataset.scenarios.map(cloneScenario);
    this.sessions = (dataset.sessions ?? []).map(cloneSession);
  }

  async listPublishedScenarios(
    filter: ListScenariosFilter,
    userId: string,
  ): Promise<ScenariosPage> {
    const rows = this.scenarios
      .filter(
        (scenario) =>
          scenario.isPublished &&
          (filter.role === undefined || scenario.role === filter.role) &&
          (filter.level === undefined || scenario.level === filter.level) &&
          (filter.language === undefined || scenario.language === filter.language),
      )
      .sort(
        (left, right) =>
          left.level.localeCompare(right.level) ||
          left.title.localeCompare(right.title),
      )
      .map((scenario) => this.toCatalogRow(scenario, userId));

    const start = (filter.page - 1) * filter.pageSize;

    return {
      items: rows.slice(start, start + filter.pageSize),
      total: rows.length,
    };
  }

  async findPublishedScenarioBySlug(
    slug: string,
    userId: string,
  ): Promise<ScenarioCatalogRow | null> {
    const scenario = this.scenarios.find(
      (candidate) => candidate.slug === slug && candidate.isPublished,
    );

    return scenario === undefined ? null : this.toCatalogRow(scenario, userId);
  }

  async findOpenSession(
    userId: string,
    scenarioId: string,
  ): Promise<InterviewSessionRecord | null> {
    const session = this.sessions.find(
      (candidate) =>
        candidate.userId === userId &&
        candidate.scenario.id === scenarioId &&
        candidate.status === "IN_PROGRESS",
    );

    return session === undefined ? null : cloneSession(session);
  }

  async createSession(
    input: CreateInterviewSessionRecord,
  ): Promise<InterviewSessionRecord | null> {
    const scenario = this.scenarios.find(
      (candidate) => candidate.id === input.scenarioId && candidate.isPublished,
    );

    if (scenario === undefined) {
      return null;
    }

    const session: InterviewSessionRecord = {
      id: `ses_${this.nextSessionId++}`,
      userId: input.userId,
      status: "IN_PROGRESS",
      phase: input.phase,
      turns: 0,
      transcript: structuredClone(input.transcript),
      scores: null,
      selfScores: null,
      feedback: null,
      degraded: false,
      startedAt: input.startedAt,
      lastTurnAt: null,
      finishedAt: null,
      reviewedAt: null,
      scenario: cloneScenario(scenario),
    };

    this.sessions.push(session);

    return cloneSession(session);
  }

  async findSessionById(
    sessionId: string,
  ): Promise<InterviewSessionRecord | null> {
    const session = this.sessions.find(
      (candidate) => candidate.id === sessionId,
    );

    return session === undefined ? null : cloneSession(session);
  }

  async saveTurn(
    input: SaveInterviewTurnRecord,
  ): Promise<InterviewSessionRecord | null> {
    const session = this.findMutable(input.sessionId);

    if (session === null) return null;

    session.transcript = structuredClone(input.transcript);
    session.turns = input.turns;
    session.phase = input.phase;
    session.lastTurnAt = input.lastTurnAt;
    session.degraded = input.degraded;

    return cloneSession(session);
  }

  async finishSession(
    input: FinishInterviewSessionRecord,
  ): Promise<InterviewSessionRecord | null> {
    const session = this.findMutable(input.sessionId);

    if (session === null) return null;

    session.status = "COMPLETED";
    session.finishedAt = input.finishedAt;

    return cloneSession(session);
  }

  async saveSelfReview(
    input: SaveInterviewSelfReviewRecord,
  ): Promise<InterviewSessionRecord | null> {
    const session = this.findMutable(input.sessionId);

    if (session === null) return null;

    session.selfScores = structuredClone(input.selfScores);

    return cloneSession(session);
  }

  async saveReview(
    input: SaveInterviewReviewRecord,
  ): Promise<InterviewSessionRecord | null> {
    const session = this.findMutable(input.sessionId);

    if (session === null) return null;

    session.status = "REVIEWED";
    session.scores = structuredClone(input.scores);
    session.feedback = input.feedback;
    session.reviewedAt = input.reviewedAt;

    return cloneSession(session);
  }

  async listSessionsByUser(userId: string): Promise<InterviewSessionRecord[]> {
    return this.sessions
      .filter((session) => session.userId === userId)
      .sort(
        (left, right) => right.startedAt.getTime() - left.startedAt.getTime(),
      )
      .map(cloneSession);
  }

  async expireStaleSessions(userId: string, before: Date): Promise<void> {
    for (const session of this.sessions) {
      if (session.userId !== userId || session.status !== "IN_PROGRESS") {
        continue;
      }

      const lastActivity = session.lastTurnAt ?? session.startedAt;

      if (lastActivity < before) {
        session.status = "ABANDONED";
      }
    }
  }

  async addCompetencyEvidence(
    userId: string,
    competency: string,
    evaluatedAt: Date,
  ): Promise<void> {
    const key = `${userId}:${competency}`;
    const current = this.evidence.get(key);

    this.evidence.set(key, {
      level: Math.max(
        current?.level ?? 0,
        INTERVIEW_APPROVED_COMPETENCY_LEVEL,
      ),
      evidenceCount: (current?.evidenceCount ?? 0) + 1,
      lastEvaluated: evaluatedAt,
    });
  }

  /** Sólo para pruebas: evidencia registrada por `addCompetencyEvidence`. */
  getEvidence(userId: string, competency: string): InMemoryEvidence | null {
    return this.evidence.get(`${userId}:${competency}`) ?? null;
  }

  private toCatalogRow(
    scenario: InterviewScenarioRecord,
    userId: string,
  ): ScenarioCatalogRow {
    return {
      ...cloneScenario(scenario),
      attempts: this.sessions.filter(
        (session) =>
          session.userId === userId && session.scenario.id === scenario.id,
      ).length,
    };
  }

  private findMutable(sessionId: string): InterviewSessionRecord | null {
    return (
      this.sessions.find((candidate) => candidate.id === sessionId) ?? null
    );
  }
}