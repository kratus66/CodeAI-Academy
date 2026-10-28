import type {
  InterviewTurnPipelineInput,
  InterviewTurnPipelineResult,
} from "../ai/ai.service";

/**
 * Puerto de IA del módulo de entrevistas (`sprint-10-entrevistas.md` T8).
 *
 * Es una vista estrecha de `AiService`: la entrevista sólo necesita un turno
 * del proveedor con presupuesto, auditoría (`module: "interview"`), filtro de
 * fuga y degradación. La implementación la aporta S8 con `useExisting`, así que
 * las pruebas del servicio sustituyen este token sin construir toda la capa.
 */
export const INTERVIEW_AI = Symbol("INTERVIEW_AI");

export interface InterviewAiPort {
  interviewTurn(
    input: InterviewTurnPipelineInput,
  ): Promise<InterviewTurnPipelineResult>;
}
