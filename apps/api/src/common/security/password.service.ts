import { Injectable } from "@nestjs/common";
import { compare, hash } from "bcryptjs";

/**
 * Coste bcrypt exigido por el contrato (`contratos-api.md` §4.1). Subirlo
 * invalidaría los hashes existentes solo en tiempo de verificación, no de
 * lectura, así que se mantiene fijo y documentado.
 */
export const BCRYPT_COST = 12;

@Injectable()
export class PasswordService {
  /** Devuelve un hash bcrypt con sal aleatoria incluida. */
  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, BCRYPT_COST);
  }

  /**
   * Compara en tiempo (casi) constante. Un hash corrupto o de otro algoritmo
   * se trata como "no coincide" en lugar de romper el flujo de login.
   */
  async verify(
    plainPassword: string,
    passwordHash: string,
  ): Promise<boolean> {
    try {
      return await compare(plainPassword, passwordHash);
    } catch {
      return false;
    }
  }
}
