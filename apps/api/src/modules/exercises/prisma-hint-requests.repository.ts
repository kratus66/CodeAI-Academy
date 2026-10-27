import { Injectable } from "@nestjs/common";

// Import de valor obligatorio: Nest resuelve `PrismaService` por `design:paramtypes`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../../database/prisma.service";
import type { HintRequestRepository } from "./hint-requests.repository";

/** Adaptador Prisma del puerto `HintRequestRepository`. */
@Injectable()
export class PrismaHintRequestsRepository implements HintRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUsedLevels(userId: string, exerciseId: string): Promise<number[]> {
    const rows = await this.prisma.hintRequest.findMany({
      where: { userId, exerciseId },
      select: { level: true },
    });

    return distinctAscending(rows.map((row) => row.level));
  }

  async findLevelsRequestedSince(
    userId: string,
    exerciseId: string,
    since: Date | null,
  ): Promise<number[]> {
    const rows = await this.prisma.hintRequest.findMany({
      where: {
        userId,
        exerciseId,
        ...(since === null ? {} : { lastRequestedAt: { gt: since } }),
      },
      select: { level: true },
    });

    return distinctAscending(rows.map((row) => row.level));
  }

  async recordRequest(userId: string, exerciseId: string, level: number): Promise<void> {
    await this.prisma.hintRequest.upsert({
      where: { userId_exerciseId_level: { userId, exerciseId, level } },
      create: { userId, exerciseId, level },
      update: { requests: { increment: 1 }, lastRequestedAt: new Date() },
    });
  }
}

function distinctAscending(levels: readonly number[]): number[] {
  return [...new Set(levels)].sort((a, b) => a - b);
}
