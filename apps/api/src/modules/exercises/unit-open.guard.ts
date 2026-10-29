import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common";

// El valor se necesita en tiempo de ejecución: Nest lo usa como token de inyección.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProgressService } from "../progress/progress.service";
import type { ExercisesRepository } from "./exercises.repository";
import { EXERCISES_REPOSITORY } from "./exercises.repository";

const UNIT_LOCKED =
  "Esta unidad está bloqueada: domina sus prerrequisitos para abrir su laboratorio.";

/**
 * Cierra el laboratorio de una unidad bloqueada. Las rutas llegan con el código
 * de la unidad (`units/:code`) o con el id del ejercicio, del que se deduce la
 * unidad. Va después de `JwtAuthGuard`: sin usuario no decide nada. Los
 * instructores y administradores no se bloquean.
 */
@Injectable()
export class UnitOpenGuard implements CanActivate {
  constructor(
    private readonly progress: ProgressService,
    @Inject(EXERCISES_REPOSITORY) private readonly exercises: ExercisesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { sub: string; role: string }; params: Record<string, string | undefined> }>();
    const user = request.user;

    if (!user) {
      return true;
    }

    const unitCode = request.params.code ?? (await this.unitCodeOf(request.params.id));

    // Un ejercicio o unidad inexistente lo responde el servicio con su 404.
    if (!unitCode) {
      return true;
    }

    if ((await this.progress.getUnitState(user.sub, unitCode, user.role)) === "LOCKED") {
      throw new UnprocessableEntityException(UNIT_LOCKED);
    }

    return true;
  }

  private async unitCodeOf(exerciseId: string | undefined): Promise<string | null> {
    if (!exerciseId) {
      return null;
    }

    return (await this.exercises.findPublished(exerciseId))?.unitCode ?? null;
  }
}
