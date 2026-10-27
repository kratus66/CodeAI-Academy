import type { HintRequestInput, HintResponseEnvelope } from "@codeai/shared";
import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import type { ExercisesRepository } from "./exercises.repository";
import { EXERCISES_REPOSITORY } from "./exercises.repository";
import type { HintRequestRepository } from "./hint-requests.repository";
import { HINT_REQUESTS_REPOSITORY } from "./hint-requests.repository";
import { selectHint } from "./hint-selection";

const EXERCISE_NOT_FOUND = "El ejercicio solicitado no existe o no está publicado";
const HINT_NOT_FOUND = "Este ejercicio no tiene una pista de ese nivel";
const HINT_PROGRESSION_REQUIRED =
  "Pide primero las pistas de los niveles anteriores: las pistas son progresivas";

/**
 * Pistas graduadas (`sprint-06-correccion-pistas.md` §4 y §6). Sirve **una**
 * pista del nivel pedido y registra el uso. El texto sale del catálogo tal cual:
 * no se interpola ni `solution` ni el código del estudiante. No conoce Prisma
 * ni HTTP.
 *
 * Repetir un nivel devuelve la misma pista; la idempotencia del registro vive
 * en `HintRequestRepository`. La cuota por minuto es de T12.
 */
@Injectable()
export class HintsService {
  constructor(
    @Inject(EXERCISES_REPOSITORY) private readonly exercises: ExercisesRepository,
    @Inject(HINT_REQUESTS_REPOSITORY) private readonly hintRequests: HintRequestRepository,
  ) {}

  /** El `userId` sale del token, nunca del cliente. */
  async requestHint(
    userId: string,
    exerciseId: string,
    body: HintRequestInput,
  ): Promise<HintResponseEnvelope> {
    const exercise = await this.exercises.findPublished(exerciseId);

    if (!exercise) {
      throw new NotFoundException(EXERCISE_NOT_FOUND);
    }

    const selection = selectHint({
      requestedLevel: body.level,
      availableLevels: exercise.hintLevels,
      usedLevels: await this.hintRequests.findUsedLevels(userId, exerciseId),
    });

    if (!selection.ok) {
      if (selection.reason === "PROGRESSION_REQUIRED") {
        throw new UnprocessableEntityException(HINT_PROGRESSION_REQUIRED);
      }

      throw new NotFoundException(HINT_NOT_FOUND);
    }

    const hint = await this.exercises.findHint(exerciseId, body.level);

    // El catálogo declara el nivel pero no tiene texto: no se registra el uso.
    if (!hint) {
      throw new NotFoundException(HINT_NOT_FOUND);
    }

    await this.hintRequests.recordRequest(userId, exerciseId, body.level);

    return {
      hint: {
        level: body.level,
        text: hint.text,
        nextLevelAvailable: selection.nextLevelAvailable,
      },
    };
  }
}
