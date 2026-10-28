import type {
  UpdateProfileInput,
  UserListQuery,
  UserListResponse,
  UserProfile,
} from "@codeai/shared";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { UsersRepository } from "./users.repository";
import { USERS_REPOSITORY } from "./users.repository";
import { toUserProfile } from "./users.mapper";

/** Mismo texto para «no existe» y «desactivada»: no se filtra el estado de la cuenta. */
const USER_NOT_FOUND = "El usuario no existe";

/**
 * Perfil y preferencias del usuario (`contratos-api.md` §4.10).
 *
 * El identificador **siempre** llega del token (`AccessTokenPayload.sub`); este
 * servicio no acepta un `userId` de la ruta ni del cuerpo, así que ningún
 * estudiante puede leer ni editar el perfil de otro. El listado es la única
 * operación con alcance global y está restringida a `ADMIN`.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly repository: UsersRepository,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.repository.findById(userId);

    if (!user || !user.isActive) {
      throw new NotFoundException(USER_NOT_FOUND);
    }

    return toUserProfile(user);
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<UserProfile> {
    // Se comprueba antes de escribir: un token todavía vigente de una cuenta
    // desactivada no debe poder cambiar el perfil.
    const current = await this.repository.findById(userId);

    if (!current || !current.isActive) {
      throw new NotFoundException(USER_NOT_FOUND);
    }

    const updated = await this.repository.updateProfile(userId, input);

    if (!updated) {
      throw new NotFoundException(USER_NOT_FOUND);
    }

    return toUserProfile(updated);
  }

  async listUsers(query: UserListQuery): Promise<UserListResponse> {
    const { items, total } = await this.repository.list(query);

    return {
      data: items.map(toUserProfile),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }
}
