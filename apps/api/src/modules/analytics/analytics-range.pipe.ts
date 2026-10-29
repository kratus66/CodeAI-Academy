import type { AnalyticsRangeQuery } from "@codeai/shared";
import { DEFAULT_ERROR_MESSAGE_BY_CODE, analyticsRangeQuerySchema } from "@codeai/shared";
import { BadRequestException, Injectable } from "@nestjs/common";
import type { PipeTransform } from "@nestjs/common";

import { toErrorDetails } from "../../common/pipes/zod-validation.pipe";

/**
 * Valida `?range=` con el contrato compartido. A diferencia de un `400`
 * genérico, publica `INVALID_RANGE` y `details[0].field = "range"` para que la
 * web distinga un rango mal escrito de un cuerpo inválido (`§4.2` y `§4.5`).
 */
@Injectable()
export class AnalyticsRangePipe implements PipeTransform<unknown, AnalyticsRangeQuery> {
  transform(value: unknown): AnalyticsRangeQuery {
    const result = analyticsRangeQuerySchema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        code: "INVALID_RANGE",
        message: DEFAULT_ERROR_MESSAGE_BY_CODE.INVALID_RANGE,
        details: toErrorDetails(result.error),
      });
    }

    return result.data;
  }
}
