/**
 * Puerto de las solicitudes de pista. Registra qué niveles pidió cada usuario
 * por ejercicio; el servicio lo usa para la progresión 1→2→3 y para contar las
 * pistas del intento actual. No conoce Prisma ni Nest.
 */
export const HINT_REQUESTS_REPOSITORY = Symbol("HINT_REQUESTS_REPOSITORY");

export interface HintRequestRepository {
  /** Niveles distintos ya pedidos, ascendentes. Alimenta la progresión 1→2→3. */
  findUsedLevels(userId: string, exerciseId: string): Promise<number[]>;
  /**
   * Niveles distintos cuya última solicitud es **posterior** a `since`
   * (todos si `since` es `null`). T9 calcula `hintsUsed` del intento actual.
   */
  findLevelsRequestedSince(
    userId: string,
    exerciseId: string,
    since: Date | null,
  ): Promise<number[]>;
  /** Registra la solicitud. Repetir el mismo nivel no crea otra fila. */
  recordRequest(userId: string, exerciseId: string, level: number): Promise<void>;
}
