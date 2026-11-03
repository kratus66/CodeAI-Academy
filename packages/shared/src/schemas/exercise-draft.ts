import { z } from "zod";

import { LADDERS } from "../enums/exercise";
import { contentSeedExerciseSchema, contentSeedUnitSchema } from "./content";
import { sandboxLanguageSchema } from "./sandbox";

/** Tipos que la tubería de autoría asistida sabe generar y verificar. */
export const EXERCISE_DRAFT_TYPES = ["QUIZ", "FLASHCARD", "LAB", "DEBUG"] as const;

/**
 * Lo que se le pide al generador: qué concepto, de qué tipo y en qué escalón.
 * `allowedSources` es la lista cerrada de documentación citable: el generador no
 * puede inventar una fuente (`banco-ejercicios.md` §6).
 */
export const exerciseDraftRequestSchema = z.object({
  unitCode: contentSeedUnitSchema.shape.code,
  concept: z.string().min(1).max(120),
  type: z.enum(EXERCISE_DRAFT_TYPES),
  ladder: z.enum(LADDERS),
  difficulty: z.number().int().min(1).max(4).default(2),
  competencies: contentSeedExerciseSchema.shape.competencies,
  language: sandboxLanguageSchema.nullable().default(null),
  allowedSources: z.array(z.string().url()).min(1),
});

export type ExerciseDraftRequest = z.input<typeof exerciseDraftRequestSchema>;

/**
 * Borrador de ejercicio generado por IA: la misma forma que un ejercicio de la
 * semilla, sin publicación ni orden (los decide quien lo revisa) y siempre sin
 * revisión humana. Un borrador no acredita nada hasta que una persona lo valida.
 */
export const exerciseDraftSchema = contentSeedExerciseSchema
  .omit({ isPublished: true, order: true, maxAttempts: true })
  .extend({ reviewedByHuman: z.literal(false).default(false) });

export type ExerciseDraft = z.infer<typeof exerciseDraftSchema>;
